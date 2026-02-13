// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { join } from 'node:path'
import Database from 'better-sqlite3'

let db: InstanceType<typeof Database> | null | undefined

const REGISTRY_SCHEMA = `
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

CREATE TABLE IF NOT EXISTS file_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  UNIQUE(slug, file_path, line_start)
);
`

export function getFeatureRegistryDb(): InstanceType<typeof Database> | null {
  if (db !== undefined) return db

  try {
    const dbPath = join(getProjectRoot(), 'knowledge.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(REGISTRY_SCHEMA)
    return db
  }
  catch {
    db = null
    return null
  }
}

interface FeatureRecord {
  slug: string
  wrapperType: string
  invocationCount: number
  logCount: number
  registeredAt: string
}

interface EdgeRecord {
  from: string
  to: string
  type: 'contains' | 'uses'
}

export function syncSingleFeatureToDb(slug: string, wrapperType: string): void {
  try {
    const conn = getFeatureRegistryDb()
    if (!conn) return
    conn.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type)
      VALUES (?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        last_seen = datetime('now')
    `).run(slug, wrapperType)
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

export function syncSingleEdgeToDb(from: string, to: string, type: string): void {
  try {
    const conn = getFeatureRegistryDb()
    if (!conn) return
    conn.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES (?, ?, ?)
      ON CONFLICT(from_slug, to_slug, edge_type) DO NOTHING
    `).run(from, to, type)
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

export function syncCountsToDb(features: { slug: string, invocationCount: number, logCount: number }[]): void {
  try {
    const conn = getFeatureRegistryDb()
    if (!conn) return

    const update = conn.prepare(`
      UPDATE feature_registry
      SET invocation_count = ?, log_count = ?, last_seen = datetime('now')
      WHERE slug = ?
    `)

    const transaction = conn.transaction(() => {
      for (const f of features) {
        update.run(f.invocationCount, f.logCount, f.slug)
      }
    })

    transaction()
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

export function syncRegistryToDb(features: FeatureRecord[], edges: EdgeRecord[]): void {
  try {
    const conn = getFeatureRegistryDb()
    if (!conn) return

    const upsertFeature = conn.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type, invocation_count, log_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        wrapper_type = excluded.wrapper_type,
        last_seen = datetime('now'),
        invocation_count = excluded.invocation_count,
        log_count = excluded.log_count
    `)

    const upsertEdge = conn.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES (?, ?, ?)
      ON CONFLICT(from_slug, to_slug, edge_type) DO NOTHING
    `)

    const transaction = conn.transaction(() => {
      for (const f of features) {
        upsertFeature.run(f.slug, f.wrapperType, f.invocationCount, f.logCount)
      }
      for (const e of edges) {
        upsertEdge.run(e.from, e.to, e.type)
      }
    })

    transaction()
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

interface FileMappingRecord {
  slug: string
  filePath: string
  lineNumber: number
}

export function syncFileMappings(annotations: FileMappingRecord[]): void {
  try {
    const conn = getFeatureRegistryDb()
    if (!conn) return

    const clear = conn.prepare('DELETE FROM file_mappings')
    const insert = conn.prepare(`
      INSERT INTO file_mappings (slug, file_path, line_start)
      VALUES (?, ?, ?)
    `)

    const transaction = conn.transaction(() => {
      clear.run()
      for (const a of annotations) {
        insert.run(a.slug, a.filePath, a.lineNumber)
      }
    })

    transaction()
  }
  catch {
    // Silent — knowledge.db is optional
  }
}

// --- Feature registry read functions (shared across apps) ---

export interface FeatureRegistryRow {
  slug: string
  wrapper_type: string
  first_seen: string
  last_seen: string
  invocation_count: number
  log_count: number
}

export interface FeatureEdgeRow {
  from_slug: string
  to_slug: string
  edge_type: string
  first_seen: string
}

export interface FileMappingRow {
  slug: string
  file_path: string
  line_start: number | null
  line_end: number | null
}

export function queryFeatureRegistry(slug?: string): FeatureRegistryRow[] {
  try {
    const conn = getFeatureRegistryDb()
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
    const conn = getFeatureRegistryDb()
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
    const conn = getFeatureRegistryDb()
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
