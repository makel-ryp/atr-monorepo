// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
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

    const upsert = conn.prepare(`
      INSERT INTO file_mappings (slug, file_path, line_start)
      VALUES (?, ?, ?)
      ON CONFLICT(slug, file_path, line_start) DO NOTHING
    `)

    const transaction = conn.transaction(() => {
      for (const a of annotations) {
        upsert.run(a.slug, a.filePath, a.lineNumber)
      }
    })

    transaction()
  }
  catch {
    // Silent — knowledge.db is optional
  }
}
