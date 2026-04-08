export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`SELECT * FROM stock_pipeline ORDER BY created_at DESC`
  return rows
})
