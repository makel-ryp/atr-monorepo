export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id, ...fields } = body

  if (!id) {
    throw createError({ statusCode: 400, message: 'id is required' })
  }

  const db = useDb()

  // Build SET clause from provided fields only
  const allowed = [
    'sku', 'type', 'qty_to_warehouse', 'qty_to_fba', 'total_quantity',
    'expected_arrival_warehouse', 'expected_arrival_fba', 'po_number',
    'notes', 'active', 'arrived_date', 'product_title',
  ]

  const updates: string[] = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = ?`)
      values.push(fields[key])
    }
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  values.push(id)
  const sql = `UPDATE stock_pipeline SET ${updates.join(', ')} WHERE id = ?`
  await db.prepare(sql).bind(...values).run()

  const { rows } = await db.sql`SELECT * FROM stock_pipeline WHERE id = ${id}`
  return rows[0] ?? null
})
