export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    sku,
    type,
    qty_to_warehouse = 0,
    qty_to_fba = 0,
    expected_arrival_warehouse,
    expected_arrival_fba = null,
    po_number = null,
    notes = null,
  } = body

  if (!sku || !expected_arrival_warehouse) {
    throw createError({ statusCode: 400, message: 'sku and expected_arrival_warehouse are required' })
  }

  const total_quantity = (qty_to_warehouse ?? 0) + (qty_to_fba ?? 0)
  const created_at = new Date().toISOString()

  const db = useDb()
  const { rows: inserted } = await db.sql`
    INSERT INTO stock_pipeline
      (sku, type, qty_to_warehouse, qty_to_fba, total_quantity,
       expected_arrival_warehouse, expected_arrival_fba, po_number, notes, active, created_at)
    VALUES
      (${sku}, ${type ?? null}, ${qty_to_warehouse}, ${qty_to_fba}, ${total_quantity},
       ${expected_arrival_warehouse}, ${expected_arrival_fba}, ${po_number}, ${notes}, 'TRUE', ${created_at})
    RETURNING *
  `
  return inserted[0]
})
