import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'

let db: InstanceType<typeof Database> | null | undefined

// Local getProjectRoot — docs-layer code loads before core auto-imports resolve
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

CREATE TABLE IF NOT EXISTS feature_registry (
  slug TEXT PRIMARY KEY,
  wrapper_type TEXT NOT NULL DEFAULT 'manual',
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  invocation_count INTEGER NOT NULL DEFAULT 0,
  log_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feature_edges (
  from_slug TEXT NOT NULL,
  to_slug TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('contains', 'uses')),
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_slug, to_slug, edge_type)
);
`

export function getKnowledgeDb(): InstanceType<typeof Database> | null {
  // undefined = not yet initialized, null = failed to initialize
  if (db !== undefined) return db

  try {
    const dbPath = join(getProjectRoot(), 'knowledge.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
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

// --- Feature registry read functions (used by MCP tools) ---

interface FeatureRegistryRow {
  slug: string
  wrapper_type: string
  first_seen: string
  last_seen: string
  invocation_count: number
  log_count: number
}

interface FeatureEdgeRow {
  from_slug: string
  to_slug: string
  edge_type: string
  first_seen: string
}

interface FileMappingRow {
  slug: string
  file_path: string
  line_start: number | null
  line_end: number | null
}

export function queryFeatureRegistry(slug?: string): FeatureRegistryRow[] {
  try {
    const conn = getKnowledgeDb()
    if (!conn) return []

    if (slug) {
      return conn.prepare('SELECT * FROM feature_registry WHERE slug = ?').all(slug) as FeatureRegistryRow[]
    }
    return conn.prepare('SELECT * FROM feature_registry ORDER BY slug').all() as FeatureRegistryRow[]
  }
  catch {
    return []
  }
}

export function queryFeatureEdges(slug?: string): FeatureEdgeRow[] {
  try {
    const conn = getKnowledgeDb()
    if (!conn) return []

    if (slug) {
      return conn.prepare(
        'SELECT * FROM feature_edges WHERE from_slug = ? OR to_slug = ?'
      ).all(slug, slug) as FeatureEdgeRow[]
    }
    return conn.prepare('SELECT * FROM feature_edges ORDER BY from_slug, to_slug').all() as FeatureEdgeRow[]
  }
  catch {
    return []
  }
}

export function queryFileMappings(slug?: string): FileMappingRow[] {
  try {
    const conn = getKnowledgeDb()
    if (!conn) return []

    if (slug) {
      return conn.prepare('SELECT * FROM file_mappings WHERE slug = ?').all(slug) as FileMappingRow[]
    }
    return conn.prepare('SELECT * FROM file_mappings ORDER BY slug, file_path').all() as FileMappingRow[]
  }
  catch {
    return []
  }
}
