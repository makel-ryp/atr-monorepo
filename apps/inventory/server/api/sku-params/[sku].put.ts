export default defineEventHandler(async (event) => {
  const sku = getRouterParam(event, 'sku')
  if (!sku) {
    throw createError({ statusCode: 400, message: 'sku param required' })
  }

  const body = await readBody(event)
  const updated_at = new Date().toISOString()

  const db = useDb()

  const allowed = [
    'lead_time_days', 'lead_time_buffer_days', 'min_stock_months', 'max_stock_months',
    'reorder_trigger_months', 'target_stock_months_9mo', 'target_stock_months_12mo',
    'moq', 'carton_qty', 'half_carton_qty', 'peak_months', 'off_peak_months',
    'peak_multiplier', 'reorder_exempt', 'supplier_name', 'shipping_method', 'notes',
  ]

  const updates: string[] = ['updated_at = ?']
  const values: unknown[] = [updated_at]

  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`)
      values.push(body[key])
    }
  }

  values.push(sku)
  const sql = `UPDATE sku_params SET ${updates.join(', ')} WHERE sku = ?`
  await db.prepare(sql).bind(...values).run()

  const { rows } = await db.sql`SELECT * FROM sku_params WHERE sku = ${sku}`
  return rows[0] ?? null
})
