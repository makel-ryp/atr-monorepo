// CONTEXT: context-oracle — Read-only access to logs.db for MCP tools
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'

let db: InstanceType<typeof Database> | null | undefined

export function getLogsQueryDb(): InstanceType<typeof Database> | null {
  // Return cached connection if we have one
  if (db) return db

  try {
    // Running app cwd is docs/ (one level from root), logs.db lives at project root
    const dbPath = join(process.cwd(), '..', 'logs.db')
    if (!existsSync(dbPath)) {
      // Don't cache null — logs.db is created lazily by another process
      return null
    }
    db = new Database(dbPath, { readonly: true })
    return db
  }
  catch {
    return null
  }
}

export interface LogEntry {
  id: number
  slug: string
  level: string
  message: string
  data: string | null
  file_path: string | null
  line_number: number | null
  timestamp: string
}

export function queryRecentLogs(options: {
  slug?: string
  level?: string
  since?: string
  limit?: number
}): LogEntry[] {
  const conn = getLogsQueryDb()
  if (!conn) return []

  const conditions: string[] = []
  const params: any[] = []

  if (options.slug) {
    conditions.push('slug = ?')
    params.push(options.slug)
  }

  if (options.level) {
    conditions.push('level = ?')
    params.push(options.level)
  }

  if (options.since) {
    conditions.push("timestamp >= datetime('now', ?)")
    params.push(`-${options.since}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = options.limit ?? 50

  try {
    return conn.prepare(
      `SELECT id, slug, level, message, data, file_path, line_number, timestamp
       FROM logs ${where}
       ORDER BY timestamp DESC
       LIMIT ?`
    ).all(...params, limit) as LogEntry[]
  }
  catch {
    return []
  }
}

export interface LogSummary {
  total: number
  bySlug: { slug: string, count: number, lastSeen: string }[]
  byLevel: { level: string, count: number }[]
  recentErrors: LogEntry[]
}

export function getLogSummary(since?: string): LogSummary {
  const conn = getLogsQueryDb()
  if (!conn) return { total: 0, bySlug: [], byLevel: [], recentErrors: [] }

  const timeFilter = since
    ? "WHERE timestamp >= datetime('now', ?)"
    : ''
  const timeParams = since ? [`-${since}`] : []

  try {
    const total = conn.prepare(
      `SELECT COUNT(*) as count FROM logs ${timeFilter}`
    ).get(...timeParams) as { count: number }

    const bySlug = conn.prepare(
      `SELECT slug, COUNT(*) as count, MAX(timestamp) as lastSeen
       FROM logs ${timeFilter}
       GROUP BY slug
       ORDER BY count DESC`
    ).all(...timeParams) as { slug: string, count: number, lastSeen: string }[]

    const byLevel = conn.prepare(
      `SELECT level, COUNT(*) as count
       FROM logs ${timeFilter}
       GROUP BY level
       ORDER BY CASE level WHEN 'error' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END`
    ).all(...timeParams) as { level: string, count: number }[]

    const recentErrors = conn.prepare(
      `SELECT id, slug, level, message, data, file_path, line_number, timestamp
       FROM logs
       WHERE level = 'error' ${since ? "AND timestamp >= datetime('now', ?)" : ''}
       ORDER BY timestamp DESC
       LIMIT 10`
    ).all(...timeParams) as LogEntry[]

    return { total: total.count, bySlug, byLevel, recentErrors }
  }
  catch {
    return { total: 0, bySlug: [], byLevel: [], recentErrors: [] }
  }
}
