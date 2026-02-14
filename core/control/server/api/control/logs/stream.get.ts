export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const slug = query.slug as string | undefined
  const level = query.level as string | undefined

  const eventStream = createEventStream(event)

  let lastId = 0
  let closed = false

  eventStream.onClosed(() => {
    closed = true
  })

  // Poll for new entries every 1s and push them as SSE events
  const interval = setInterval(async () => {
    if (closed) {
      clearInterval(interval)
      return
    }

    try {
      const conn = getLogsQueryDb()
      if (!conn) return

      const conditions = ['id > ?']
      const params: any[] = [lastId]

      if (slug) {
        conditions.push('slug = ?')
        params.push(slug)
      }
      if (level) {
        conditions.push('level = ?')
        params.push(level)
      }

      const rows = conn.prepare(
        `SELECT id, slug, level, message, data, timestamp
         FROM logs
         WHERE ${conditions.join(' AND ')}
         ORDER BY id ASC
         LIMIT 50`
      ).all(...params) as { id: number, slug: string, level: string, message: string, data: string | null, timestamp: string }[]

      for (const row of rows) {
        lastId = row.id
        await eventStream.push({
          id: String(row.id),
          event: 'log',
          data: JSON.stringify(row)
        })
      }
    }
    catch {
      // DB not available, skip
    }
  }, 1000)

  // Initialize lastId to current max so we only stream NEW entries
  try {
    const conn = getLogsQueryDb()
    if (conn) {
      const result = conn.prepare('SELECT MAX(id) as maxId FROM logs').get() as { maxId: number } | undefined
      lastId = result?.maxId ?? 0
    }
  }
  catch {
    // ignore
  }

  // Send initial ping so client knows connection is established
  await eventStream.push({
    event: 'connected',
    data: JSON.stringify({ lastId })
  })

  return eventStream.send()
})
