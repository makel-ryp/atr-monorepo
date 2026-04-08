export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`SELECT * FROM edi_orders`
  return rows
})
