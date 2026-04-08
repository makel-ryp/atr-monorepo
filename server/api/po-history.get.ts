export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`SELECT * FROM po_history`
  return rows
})
