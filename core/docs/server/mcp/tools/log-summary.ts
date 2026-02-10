import { z } from 'zod'

export default defineMcpTool({
  description: `Returns an aggregate summary of context logs from logs.db — the pulse of the running system.

WHEN TO USE: Use this as a first check to understand what's happening:
- "Give me an overview of recent activity"
- "Are there any errors?"
- "Which features are most active?"

This is faster than recent-logs for getting the big picture. Use recent-logs to drill into specific slugs or errors after reviewing the summary.

INPUT:
- since: Time window like "5 minutes", "1 hour", "30 seconds" (optional, defaults to all time)

OUTPUT: Total log count, breakdown by slug (with last-seen timestamps), breakdown by level, and the 10 most recent errors.`,
  inputSchema: {
    since: z.string().optional().describe('Time window (e.g., "5 minutes", "1 hour"). Omit for all time.'),
  },
  handler: async ({ since }) => {
    const summary = getLogSummary(since)

    if (summary.total === 0) {
      const conn = getLogsDb()
      const hint = conn === null
        ? 'logs.db not found. Is the dev server running?'
        : 'No logs recorded yet. Context-wrapped code needs to execute in dev mode first.'
      return {
        content: [{ type: 'text', text: hint }],
      }
    }

    const lines: string[] = []

    lines.push(`## Log Summary${since ? ` (last ${since})` : ''}`)
    lines.push(`**Total entries:** ${summary.total}`)
    lines.push('')

    if (summary.byLevel.length > 0) {
      lines.push('### By Level')
      for (const { level, count } of summary.byLevel) {
        const icon = level === 'error' ? '!!' : level === 'warn' ? '!' : ' '
        lines.push(`  ${icon} ${level}: ${count}`)
      }
      lines.push('')
    }

    if (summary.bySlug.length > 0) {
      lines.push('### By Slug')
      for (const { slug, count, lastSeen } of summary.bySlug) {
        lines.push(`  ${slug}: ${count} entries (last: ${lastSeen})`)
      }
      lines.push('')
    }

    if (summary.recentErrors.length > 0) {
      lines.push('### Recent Errors')
      for (const err of summary.recentErrors) {
        lines.push(`  [${err.timestamp}] ${err.slug}: ${err.message}`)
        if (err.data) {
          lines.push(`    data: ${err.data}`)
        }
      }
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    }
  },
})
