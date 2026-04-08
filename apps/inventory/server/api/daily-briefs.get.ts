export default defineEventHandler(async () => {
  const db = useDb()
  const { rows } = await db.sql`
    SELECT * FROM daily_briefs
    ORDER BY date DESC
    LIMIT 30
  `
  return rows
})
