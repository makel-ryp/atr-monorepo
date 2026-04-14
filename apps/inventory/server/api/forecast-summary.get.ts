/**
 * GET /api/forecast-summary?skus=A,B,C
 *
 * Returns a structured forecast comparison per SKU:
 *   prev 30/60/90d actuals, next 30/60/90d forecast, next-vs-prev %,
 *   YTD current vs prior, QvQ (90-day quarters from forecast_history),
 *   and channel breakdown (shopify / amazon / edi).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const skusParam = query.skus as string | undefined

  if (!skusParam?.trim()) return []

  const skus = skusParam.split(',').map(s => s.trim()).filter(Boolean)
  if (!skus.length) return []
  if (skus.length > 20) {
    throw createError({ statusCode: 400, message: 'Too many SKUs requested (max 20)' })
  }

  const db = useDb()

  // Small tables — fetch all and filter in JS (avoids dynamic IN clause)
  const { rows: allMaster } = await db.sql`SELECT * FROM inventory_master`
  const { rows: allRolling } = await db.sql`SELECT * FROM rolling_windows`

  const masterBySku = new Map((allMaster as Record<string, unknown>[]).map(r => [String(r.sku), r]))
  const rollingBySku = new Map((allRolling as Record<string, unknown>[]).map(r => [String(r.sku), r]))

  // QvQ needs 270 days of daily actuals per SKU
  const today = new Date()
  const cutoffDate = new Date(today)
  cutoffDate.setDate(cutoffDate.getDate() - 270)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  // Query history per selected SKU individually (avoids variable-length IN clause)
  const historyBySku = new Map<string, Array<{ date: string; actual_units: number | null }>>()
  for (const sku of skus) {
    const { rows } = await db.sql`
      SELECT date, actual_units
      FROM forecast_history
      WHERE sku = ${sku}
        AND date >= ${cutoffStr}
        AND date <= ${todayStr}
      ORDER BY date ASC
    `
    historyBySku.set(sku, rows as { date: string; actual_units: number | null }[])
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  function pct(next: unknown, prev: unknown): number | null {
    const n = typeof next === 'number' ? next : null
    const p = typeof prev === 'number' ? prev : null
    if (n === null || p === null || p === 0) return null
    return Math.round(((n - p) / p) * 100)
  }

  function num(v: unknown): number | null {
    return typeof v === 'number' ? v : null
  }

  function daysAgo(days: number): string {
    const d = new Date(today)
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }

  function sumBetween(rows: { date: string; actual_units: number | null }[], from: string, to: string): number {
    return rows
      .filter(r => r.date > from && r.date <= to && r.actual_units !== null)
      .reduce((acc, r) => acc + (r.actual_units ?? 0), 0)
  }

  // ── per-SKU assembly ──────────────────────────────────────────────────────────

  return skus.map((sku) => {
    const m = (masterBySku.get(sku) ?? {}) as Record<string, unknown>
    const r = (rollingBySku.get(sku) ?? {}) as Record<string, unknown>
    const hist = historyBySku.get(sku) ?? []

    // QvQ — three 90-day periods working backwards from today
    const q0end   = todayStr
    const q0start = daysAgo(90)
    const q1start = daysAgo(180)
    const q2start = daysAgo(270)

    const q0 = sumBetween(hist, q0start, q0end)
    const q1 = sumBetween(hist, q1start, q0start)
    const q2 = sumBetween(hist, q2start, q1start)

    const prevD30 = num(m.total_30d)
    const prevD60 = num(m.total_60d)
    const prevD90 = num(m.total_90d)
    const nextD30 = num(m.forecast_30d)
    const nextD60 = num(m.forecast_60d)
    const nextD90 = num(m.forecast_90d)

    return {
      sku,
      product_title: m.product_title ?? null,
      run_date: m.run_date ?? null,
      forecast_method: m.forecast_method ?? null,

      // Previous periods (actuals)
      prev: {
        d30: prevD30,
        d60: prevD60,
        d90: prevD90,
      },

      // Forecast periods
      next: {
        d30: nextD30,
        d60: nextD60,
        d90: nextD90,
        lower_90d: m.forecast_lower_90d ?? null,
        upper_90d: m.forecast_upper_90d ?? null,
      },

      // Next vs prev change %
      vs_prev_pct: {
        d30: pct(nextD30, prevD30),
        d60: pct(nextD60, prevD60),
        d90: pct(nextD90, prevD90),
      },

      // Year-over-year (YTD from rolling_windows)
      yoy: {
        current_ytd: num(r.current_ytd),
        prior_ytd:   num(r.prior_ytd),
        change_pct:  num(r.yoy_change_pct),
      },

      // Quarter vs quarter (computed from forecast_history daily data)
      qvq: {
        q0,                                             // most recent 90d
        q1,                                             // prior 90d
        q2,                                             // 90d before that
        q0_label: `${q0start} – ${q0end}`,
        q1_label: `${q1start} – ${q0start}`,
        q2_label: `${q2start} – ${q1start}`,
        q0_vs_q1_pct: q1 > 0 ? Math.round(((q0 - q1) / q1) * 100) : null,
        q1_vs_q2_pct: q2 > 0 ? Math.round(((q1 - q2) / q2) * 100) : null,
      },

      // Channel breakdown
      channel: {
        shopify: { d30: num(m.shopify_30d), d60: num(m.shopify_60d), d90: num(m.shopify_90d) },
        amazon:  { d30: num(m.amazon_30d),  d60: num(m.amazon_60d),  d90: num(m.amazon_90d) },
        edi:     { d30: num(m.edi_30d),     d60: num(m.edi_60d),     d90: num(m.edi_90d) },
      },

      // Rolling velocity (from rolling_windows)
      rolling: {
        d7:   num(r.total_7d),
        d14:  num(r.total_14d),
        d30:  num(r.total_30d),
        d60:  num(r.total_60d),
        d90:  num(r.total_90d),
        d180: num(r.total_180d),
      },

      velocity: {
        avg_daily_30d: num(r.avg_daily_30d),
        avg_daily_90d: num(r.avg_daily_90d),
        trend: r.velocity_trend ?? null,
      },
    }
  })
})
