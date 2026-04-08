export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`SELECT * FROM rolling_windows`
  return rows
})
