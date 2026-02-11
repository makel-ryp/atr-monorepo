import { join } from 'node:path'
import Database from 'better-sqlite3'

let db: InstanceType<typeof Database> | null | undefined

const SCHEMA = `
CREATE TABLE IF NOT EXISTS slugs (
  slug TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_queried TEXT
);

CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  aspect TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  aspect TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'stale')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  UNIQUE(slug, file_path, line_start)
);
`

export function getKnowledgeDb(): InstanceType<typeof Database> | null {
  // undefined = not yet initialized, null = failed to initialize
  if (db !== undefined) return db

  try {
    // cwd is the running app (docs/), knowledge.db lives at project root
    const dbPath = join(process.cwd(), '..', 'knowledge.db')
    db = new Database(dbPath)
    db.exec(SCHEMA)
    return db
  }
  catch {
    db = null
    return null
  }
}

export function logQuery(slug: string, aspect: string | undefined): void {
  try {
    const conn = getKnowledgeDb()
    if (!conn) return

    conn.prepare(`
      INSERT INTO slugs (slug) VALUES (?)
      ON CONFLICT(slug) DO UPDATE SET last_queried = datetime('now')
    `).run(slug)

    conn.prepare(`
      INSERT INTO queries (slug, aspect) VALUES (?, ?)
    `).run(slug, aspect ?? null)
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

export function logChange(slug: string, aspect: string, changeType: 'created' | 'updated' | 'stale'): void {
  try {
    const conn = getKnowledgeDb()
    if (!conn) return

    conn.prepare(`
      INSERT INTO slugs (slug) VALUES (?)
      ON CONFLICT(slug) DO NOTHING
    `).run(slug)

    conn.prepare(`
      INSERT INTO changes (slug, aspect, change_type) VALUES (?, ?, ?)
    `).run(slug, aspect, changeType)
  }
  catch {
    // Silent — knowledge.db is optional
  }
}
