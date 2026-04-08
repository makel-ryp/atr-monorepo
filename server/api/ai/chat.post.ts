import Anthropic from '@anthropic-ai/sdk'
import { createEventStream } from 'h3'

// ── Types ─────────────────────────────────────────────────────────────────────
interface InventoryRow {
  sku: string | null
  product_title: string | null
  current_stock: number | null
  avg_monthly_velocity: number | null
  months_of_stock: number | null
  order_status: string | null
  order_by_date: string | null
  days_until_order_deadline: number | null
  forecast_90d: number | null
  velocity_season_adjusted: number | null
  reorder_qty_9mo_adj: number | null
  reorder_qty_12mo_adj: number | null
  stockout_date: string | null
  velocity_trend: string | null
  yoy_change_pct: number | null
}

interface PipelineRow {
  sku: string | null
  product_title: string | null
  type: string | null
  qty_to_warehouse: number | null
  qty_to_fba: number | null
  total_quantity: number | null
  expected_arrival_warehouse: string | null
  expected_arrival_fba: string | null
  po_number: string | null
  active: string | null
}

// ── Static context (ported from advisor_context.py) ───────────────────────────
const _STATIC = `COMPANY: Rypstick Golf
Products: golf training aids
Channels: Shopify DTC, Amazon FBA (no FBM), B2B via EDI/SPS Commerce
Currency: USD

BUSINESS RULES:
- Lead time: 135 days order to warehouse receipt
- Lead time buffer: 14 days safety margin
- FBA check-in: additional 7 days after warehouse receipt
- Total lead time to FBA availability: 156 days
- Reorder trigger: months_of_stock < 4.5 months
- Max stock: never exceed 15.5 months
- Min order: always meet MOQ, round up to carton size

ORDER QUANTITIES (MOQ / Carton / Half-Carton):
- Rypstick (SKUs 2,3,4,5):            MOQ 300 / Carton 50 / Half 25
- ButterBlade (SKUs 40,41,42,46,47,48): MOQ 300 / Carton 50 / Half 25
- Ryp Radar (SKU 12):                  MOQ 100 / Carton 20
- Foamies (SKU 52):                    REORDER EXEMPT — 475 months on hand

PRODUCT SEASONALITY (critical for correct interpretation):

RYPSTICK + RYPR RADAR (SKUs 2, 3, 4, 5, 12):
  Out-of-season training product. People train when NOT on the course.
  Peak season:    October to March   (+35% velocity)
  Off-peak:       June to August     (-26% velocity)
  Shoulder:       April, May, September (base velocity)
  Low summer velocity = EXPECTED. High summer velocity = anomaly.

BUTTERBLADE (SKUs 40, 41, 42, 46, 47, 48):
  In-season putting trainer. Used while actively playing.
  Peak season:    April to September  (+30% velocity)
  Off-peak:       November to February (-23% velocity)
  Shoulder:       March, October (base velocity)
  Low winter velocity = EXPECTED. High winter velocity = anomaly.

ETA LOGIC:
- "Order by date" = planning estimate using 135-day default.
- "Confirmed ETA" = actual supplier-confirmed arrival (always use over estimate).
- Lead time risk: Chinese New Year (Jan/Feb), sea vs air freight, port delays.`

const _ROLE_INSTRUCTIONS = `You are an inventory advisor for Rypstick Golf. Help the buying and leadership \
team make fast, confident decisions.

RESPONSE STYLE:
- Direct and data-driven. Lead with numbers, not narrative.
- No filler ("Great question!", "Certainly!", "Of course!")
- Get to the point. Explain only when asked.
- When recommending order quantities always show math:
  velocity x target months - current stock = raw qty -> rounded to carton -> final order qty
- Flag urgency: CRITICAL / WARNING / OK
- State most likely conclusion first, alternatives briefly.

WHAT YOU CAN DO:
- Answer questions about inventory, velocity, forecasts
- Suggest order quantities using confirmed business rules
- Draft reorder summaries the user can copy into a PO/email
- Compare Shopify vs Amazon channel performance
- Identify seasonal risks and opportunities

ORDER QUANTITY FORMAT — always use this exact format:
  SKU {N} — {product_title}
  Current stock (w/pipeline): {X} units ({Y} months)
  Season-adjusted velocity: {Z} units/mo
  Raw quantity needed (9mo): {A} units
  After MOQ + carton rounding: {B} units  <- ORDER THIS
  Order by: {date}

WHAT YOU CANNOT DO:
- Place orders or trigger system actions
- Access data not in this context
- Predict external events not in sales data

CRITICAL: Never invent numbers. If a metric is not in the context, say \
"that data isn't in my current snapshot — run the pipeline and check back." \
Never guess.`

// ── Season helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

const RYP_PEAK  = new Set([10,11,12,1,2,3])
const RYP_OFFPK = new Set([6,7,8])
const BB_PEAK   = new Set([4,5,6,7,8,9])
const BB_OFFPK  = new Set([11,12,1,2])

function rypPhase(m: number) {
  if (RYP_PEAK.has(m))  return `PEAK (+35% velocity) — ${MONTH_NAMES[m-1]}`
  if (RYP_OFFPK.has(m)) return `OFF-PEAK (-26% velocity) — ${MONTH_NAMES[m-1]}`
  return `SHOULDER (base velocity) — ${MONTH_NAMES[m-1]}`
}

function bbPhase(m: number) {
  if (BB_PEAK.has(m))  return `PEAK (+30% velocity) — ${MONTH_NAMES[m-1]}`
  if (BB_OFFPK.has(m)) return `OFF-PEAK (-23% velocity) — ${MONTH_NAMES[m-1]}`
  return `SHOULDER (base velocity) — ${MONTH_NAMES[m-1]}`
}

function safe(val: unknown, def = 0): number {
  if (val === null || val === undefined || val === '' || val === 'N/A') return def
  const n = Number(val)
  return isNaN(n) ? def : n
}

function fmtDate(val: unknown): string {
  const s = String(val ?? '').trim()
  if (!s || s === 'N/A' || s === 'None' || s === 'null') return 'not set'
  return s
}

function normSku(sku: unknown): string {
  return String(sku ?? '').trim().replace(/^0+/, '') || '0'
}

// ── Snapshot builder (ported from advisor_context.py) ────────────────────────
function buildInventorySnapshot(master: InventoryRow[], pipelineRows: PipelineRow[]): string {
  const activePipeline = pipelineRows.filter(r => String(r.active ?? '').toUpperCase() === 'TRUE')

  const pipeBySku = new Map<string, PipelineRow[]>()
  for (const p of activePipeline) {
    const sku = normSku(p.sku)
    const arr = pipeBySku.get(sku) ?? []
    arr.push(p)
    pipeBySku.set(sku, arr)
  }

  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = [`LIVE INVENTORY SNAPSHOT — ${today}\n${'='.repeat(50)}`]

  const ACTIVE_SKUS = new Set(['2','3','4','5','12','40','41','42','46','47','48','52'])
  const activeRows = master
    .filter(r => ACTIVE_SKUS.has(normSku(r.sku)))
    .sort((a, b) => parseInt(normSku(a.sku)) - parseInt(normSku(b.sku)))

  for (const r of activeRows) {
    const sku = normSku(r.sku)
    const title = r.product_title ?? ''
    const exempt = sku === '52'
    const pipes = pipeBySku.get(sku) ?? []

    const currentStock = Math.round(safe(r.current_stock))
    const monthsCurrent = safe(r.months_of_stock)
    const whIncoming  = pipes.reduce((s, p) => s + Math.round(safe(p.qty_to_warehouse)), 0)
    const fbaIncoming = pipes.reduce((s, p) => s + Math.round(safe(p.qty_to_fba)), 0)
    const totalWithPipe = currentStock + whIncoming + fbaIncoming
    const velocity = safe(r.avg_monthly_velocity)
    const monthsWithPipe = velocity > 0 ? totalWithPipe / velocity : 9999
    const velAdj = safe(r.velocity_season_adjusted, velocity)
    const nextArrivals = pipes
      .map(p => p.expected_arrival_warehouse ?? '')
      .filter(Boolean)
      .sort()
    const nextArrival = nextArrivals[0] ?? 'none scheduled'

    lines.push(`\nSKU ${sku} — ${title}`)
    if (exempt) {
      lines.push('  STATUS: REORDER EXEMPT (Foamies — 475 months on hand)')
      lines.push(`  On hand: ${currentStock.toLocaleString()} units`)
    } else {
      lines.push(`  On hand:              ${currentStock.toLocaleString()} units`)
      lines.push(`  Pipeline incoming:    ${whIncoming.toLocaleString()} warehouse + ${fbaIncoming.toLocaleString()} FBA`)
      lines.push(`  Total w/ pipeline:    ${totalWithPipe.toLocaleString()} units`)
      lines.push(`  Months of stock:      ${monthsWithPipe.toFixed(1)} mo (current only: ${monthsCurrent.toFixed(1)} mo)`)
      lines.push(`  Monthly velocity:     ${velocity.toFixed(0)} units/mo (season-adj: ${velAdj.toFixed(0)})`)
      lines.push(`  90-day forecast:      ${safe(r.forecast_90d).toFixed(0)} units`)
      lines.push(`  Order status:         ${String(r.order_status ?? 'ok').toUpperCase()}`)
      lines.push(`  Order by:             ${fmtDate(r.order_by_date)} (${safe(r.days_until_order_deadline, 9999)} days)`)
      lines.push(`  Stockout date:        ${fmtDate(r.stockout_date)}`)
      lines.push(`  Reorder qty (9mo):    ${Math.round(safe(r.reorder_qty_9mo_adj)).toLocaleString()} units`)
      lines.push(`  Reorder qty (12mo):   ${Math.round(safe(r.reorder_qty_12mo_adj)).toLocaleString()} units`)
      lines.push(`  Next arrival:         ${nextArrival}`)
      if (r.velocity_trend) lines.push(`  Velocity trend:       ${r.velocity_trend}`)
      const yoy = safe(r.yoy_change_pct)
      if (yoy) lines.push(`  YoY change:           ${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`)
    }
  }

  lines.push(`\n${'='.repeat(50)}\nACTIVE PIPELINE ENTRIES:`)
  if (activePipeline.length) {
    for (const p of activePipeline) {
      const sku = normSku(p.sku)
      lines.push(
        `  SKU ${sku} ${p.product_title ?? ''}: ` +
        `${Math.round(safe(p.total_quantity)).toLocaleString()} units (${p.type ?? ''})` +
        `\n    Warehouse arrival: ${fmtDate(p.expected_arrival_warehouse)}  |  FBA arrival: ${fmtDate(p.expected_arrival_fba)}` +
        `\n    PO: ${p.po_number ?? 'not specified'}`
      )
    }
  } else {
    lines.push('  No stock in transit.')
  }

  const critical = activeRows.filter(r =>
    ['critical','warning'].includes(String(r.order_status ?? '').toLowerCase()) && normSku(r.sku) !== '52'
  ).sort((a, b) => safe(a.days_until_order_deadline, 9999) - safe(b.days_until_order_deadline, 9999))

  lines.push(`\n${'='.repeat(50)}\nCRITICAL ALERTS:`)
  if (critical.length) {
    for (const r of critical) {
      const sku = normSku(r.sku)
      lines.push(
        `  [${String(r.order_status ?? '').toUpperCase()}] SKU ${sku} ${r.product_title ?? ''}: ` +
        `${safe(r.days_until_order_deadline, 9999)} days to deadline\n` +
        `    Order ${Math.round(safe(r.reorder_qty_9mo_adj)).toLocaleString()} units by ${fmtDate(r.order_by_date)}`
      )
    }
  } else {
    lines.push('  No critical alerts at this time.')
  }

  const m = new Date().getMonth() + 1
  lines.push(
    `\n${'='.repeat(50)}\nTODAY: ${today}\n` +
    `RYPSTICK/RADAR SEASON: ${rypPhase(m)}\n` +
    `BUTTERBLADE SEASON:    ${bbPhase(m)}`
  )

  return lines.join('\n')
}

function buildSystemPrompt(master: InventoryRow[], pipeline: PipelineRow[]): string {
  const snapshot = buildInventorySnapshot(master, pipeline)
  return `${_ROLE_INSTRUCTIONS}\n\n${_STATIC}\n\n${snapshot}`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { messages } = body as { messages: { role: string; content: string }[] }

  const db = useDb()
  const { rows: master }   = await db.sql`SELECT * FROM inventory_master`
  const { rows: pipeline } = await db.sql`SELECT * FROM stock_pipeline`

  const systemPrompt = buildSystemPrompt(
    master as unknown as InventoryRow[],
    pipeline as unknown as PipelineRow[],
  )

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NUXT_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'ANTHROPIC_API_KEY not configured' })
  }

  const client = new Anthropic({ apiKey })
  const eventStream = createEventStream(event)

  ;(async () => {
    try {
      const stream = client.messages.stream({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
      })
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          await eventStream.push(JSON.stringify({ text: chunk.delta.text }))
        }
      }
    } catch (err) {
      await eventStream.push(JSON.stringify({ error: String(err) }))
    } finally {
      await eventStream.close()
    }
  })()

  return eventStream.send()
})
