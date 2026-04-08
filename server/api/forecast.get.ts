export default defineEventHandler(async (event) => {
  const { sku } = getQuery(event)
  if (!sku) {
    throw createError({ statusCode: 400, message: 'sku query param required' })
  }

  const db = useDb()
  const { rows } = await db.sql`
    SELECT date, actual_units, forecast_units, forecast_lower, forecast_upper
    FROM forecast_history
    WHERE sku = ${String(sku)}
    ORDER BY date ASC
  `
  return rows
})
