export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`SELECT * FROM sku_params ORDER BY sku`
  return rows
})
