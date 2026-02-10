// CONTEXT: context-oracle — SQLite backing store for context() runtime logging
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'

let db: InstanceType<typeof Database> | null | undefined
let insertStmt: ReturnType<InstanceType<typeof Database>['prepare']> | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),
  message TEXT NOT NULL,
  data TEXT,
  file_path TEXT,
  line_number INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_slug ON logs(slug);
CREATE INDEX IF NOT EXISTS idx_logs_slug_timestamp ON logs(slug, timestamp DESC);
`

let _root: string | undefined

function getProjectRoot(): string {
  if (_root) return _root
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'turbo.json'))) {
      _root = dir
      return dir
    }
    dir = dirname(dir)
  }
  _root = process.cwd()
  return _root
}

export function getLogsDb(): InstanceType<typeof Database> | null {
  // undefined = not yet initialized, null = failed to initialize
  if (db !== undefined) return db

  try {
    const dbPath = join(getProjectRoot(), 'logs.db')
    db = new Database(dbPath)
    db.exec(SCHEMA)
    return db
  }
  catch {
    db = null
    return null
  }
}

export function writeLog(
  slug: string,
  level: 'log' | 'warn' | 'error',
  message: string,
  data?: string
): void {
  try {
    const conn = getLogsDb()
    if (!conn) return

    if (!insertStmt) {
      insertStmt = conn.prepare('INSERT INTO logs (slug, level, message, data) VALUES (?, ?, ?, ?)')
    }
    insertStmt.run(slug, level, message, data ?? null)
  }
  catch {
    // Silent — logs.db is optional
  }
}
