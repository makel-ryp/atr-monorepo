export default defineEventHandler(async () => {
  const db = useDb()

  // Get the most recent run_timestamp
  const { rows: latest } = await db.sql`
    SELECT run_timestamp FROM run_log
    ORDER BY run_timestamp DESC
    LIMIT 1
  `

  if (!latest || latest.length === 0) {
    return { last_run_at: null, steps: [], overall: 'unknown' }
  }

  const last_run_at = latest[0].run_timestamp as string

  const { rows: steps } = await db.sql`
    SELECT source, status, records_pulled, notes
    FROM run_log
    WHERE run_timestamp = ${last_run_at}
    ORDER BY id ASC
  `

  const statuses = steps.map((s: Record<string, unknown>) => s.status as string)
  let overall: 'ok' | 'error' | 'running' | 'unknown' = 'ok'
  if (statuses.includes('running')) overall = 'running'
  else if (statuses.includes('error')) overall = 'error'
  else if (statuses.length === 0) overall = 'unknown'

  return { last_run_at, steps, overall }
})
