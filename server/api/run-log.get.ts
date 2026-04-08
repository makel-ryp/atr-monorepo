export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`
    SELECT * FROM run_log
    ORDER BY run_timestamp DESC
    LIMIT 100
  `
  return rows
})
