import { z } from 'zod'

export default defineMcpTool({
  description: `Queries recent context logs from logs.db written by ctx.log() during development.

WHEN TO USE: Use this to inspect runtime behavior of the running dev server:
- "What happened in the rate-limiting handler?"
- "Show me recent errors"
- "What did the auth slug log in the last 5 minutes?"

INPUT:
- slug: Filter by feature slug (optional)
- level: Filter by log/warn/error (optional)
- since: Time window like "5 minutes", "1 hour", "30 seconds" (optional, SQLite datetime modifier format)
- limit: Max results, default 50 (optional)

NOTE: logs.db only has entries when the dev server runs with import.meta.dev = true and ctx.log() is called. If empty, the dev server may not be running or no context-wrapped code has executed yet.`,
  inputSchema: {
    slug: z.string().optional().describe('Filter by feature slug (e.g., "rate-limiting")'),
    level: z.enum(['log', 'warn', 'error']).optional().describe('Filter by log level'),
    since: z.string().optional().describe('Time window (e.g., "5 minutes", "1 hour", "30 seconds")'),
    limit: z.number().optional().describe('Max results (default 50)'),
  },
  handler: async ({ slug, level, since, limit }) => {
    const logs = queryRecentLogs({ slug, level, since, limit })

    if (logs.length === 0) {
      const conn = getLogsQueryDb()
      const hint = conn === null
        ? 'logs.db not found. Is the dev server running?'
        : 'No matching logs. Try broadening your filters or check that context-wrapped code has executed.'
      return {
        content: [{ type: 'text', text: hint }],
      }
    }

    const formatted = logs.map(log => ({
      slug: log.slug,
      level: log.level,
      message: log.message,
      data: log.data ? JSON.parse(log.data) : undefined,
      timestamp: log.timestamp,
    }))

    return {
      content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
    }
  },
})
