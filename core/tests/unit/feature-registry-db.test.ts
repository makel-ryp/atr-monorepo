import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'

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

describe('feature-registry-db schema', () => {
  let db: InstanceType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec(REGISTRY_SCHEMA)
  })

  afterAll(() => {
    db.close()
  })

  test('creates feature_registry table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='feature_registry'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  test('creates feature_edges table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='feature_edges'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  test('feature_registry has all required columns', () => {
    const cols = db.prepare('PRAGMA table_info(feature_registry)').all() as any[]
    const names = cols.map((c: any) => c.name)
    expect(names).toContain('slug')
    expect(names).toContain('wrapper_type')
    expect(names).toContain('first_seen')
    expect(names).toContain('last_seen')
    expect(names).toContain('invocation_count')
    expect(names).toContain('log_count')
  })

  test('feature_edges has all required columns', () => {
    const cols = db.prepare('PRAGMA table_info(feature_edges)').all() as any[]
    const names = cols.map((c: any) => c.name)
    expect(names).toContain('from_slug')
    expect(names).toContain('to_slug')
    expect(names).toContain('edge_type')
    expect(names).toContain('first_seen')
  })

  test('slug is primary key in feature_registry', () => {
    db.prepare("INSERT INTO feature_registry (slug) VALUES ('test-feat')").run()
    expect(() => {
      db.prepare("INSERT INTO feature_registry (slug) VALUES ('test-feat')").run()
    }).toThrow()
    db.prepare("DELETE FROM feature_registry WHERE slug = 'test-feat'").run()
  })

  test('edge_type CHECK constraint accepts contains and uses', () => {
    db.prepare(
      "INSERT INTO feature_edges (from_slug, to_slug, edge_type) VALUES ('a', 'b', 'contains')"
    ).run()
    db.prepare(
      "INSERT INTO feature_edges (from_slug, to_slug, edge_type) VALUES ('a', 'c', 'uses')"
    ).run()
    const rows = db.prepare("SELECT * FROM feature_edges WHERE from_slug = 'a'").all()
    expect(rows).toHaveLength(2)
    db.prepare("DELETE FROM feature_edges WHERE from_slug = 'a'").run()
  })

  test('edge_type CHECK constraint rejects invalid values', () => {
    expect(() => {
      db.prepare(
        "INSERT INTO feature_edges (from_slug, to_slug, edge_type) VALUES ('a', 'b', 'depends')"
      ).run()
    }).toThrow()
  })

  test('feature_edges UNIQUE constraint deduplicates', () => {
    db.prepare(
      "INSERT INTO feature_edges (from_slug, to_slug, edge_type) VALUES ('x', 'y', 'uses')"
    ).run()
    expect(() => {
      db.prepare(
        "INSERT INTO feature_edges (from_slug, to_slug, edge_type) VALUES ('x', 'y', 'uses')"
      ).run()
    }).toThrow()
    db.prepare("DELETE FROM feature_edges WHERE from_slug = 'x'").run()
  })
})

describe('feature-registry-db upsert logic', () => {
  let db: InstanceType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec(REGISTRY_SCHEMA)
  })

  afterAll(() => {
    db.close()
  })

  test('upsert feature — insert then update', () => {
    const upsert = db.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type, invocation_count, log_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        wrapper_type = excluded.wrapper_type,
        last_seen = datetime('now'),
        invocation_count = excluded.invocation_count,
        log_count = excluded.log_count
    `)

    upsert.run('rate-limiting', 'handler', 10, 5)
    let row = db.prepare("SELECT * FROM feature_registry WHERE slug = 'rate-limiting'").get() as any
    expect(row.wrapper_type).toBe('handler')
    expect(row.invocation_count).toBe(10)
    expect(row.log_count).toBe(5)

    upsert.run('rate-limiting', 'handler', 20, 15)
    row = db.prepare("SELECT * FROM feature_registry WHERE slug = 'rate-limiting'").get() as any
    expect(row.invocation_count).toBe(20)
    expect(row.log_count).toBe(15)

    db.prepare("DELETE FROM feature_registry WHERE slug = 'rate-limiting'").run()
  })

  test('upsert edge — insert or ignore', () => {
    const upsert = db.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES (?, ?, ?)
      ON CONFLICT(from_slug, to_slug, edge_type) DO NOTHING
    `)

    upsert.run('parent', 'child', 'contains')
    upsert.run('parent', 'child', 'contains') // should not throw
    const rows = db.prepare(
      "SELECT * FROM feature_edges WHERE from_slug = 'parent' AND to_slug = 'child'"
    ).all()
    expect(rows).toHaveLength(1)
    db.prepare("DELETE FROM feature_edges WHERE from_slug = 'parent'").run()
  })

  test('file_mappings upsert deduplicates', () => {
    const upsert = db.prepare(`
      INSERT INTO file_mappings (slug, file_path, line_start)
      VALUES (?, ?, ?)
      ON CONFLICT(slug, file_path, line_start) DO NOTHING
    `)

    upsert.run('rate-limiting', 'core/server/middleware/rate-limit.ts', 1)
    upsert.run('rate-limiting', 'core/server/middleware/rate-limit.ts', 1) // dup
    upsert.run('rate-limiting', 'core/server/middleware/rate-limit.ts', 15) // different line

    const rows = db.prepare(
      "SELECT * FROM file_mappings WHERE slug = 'rate-limiting'"
    ).all()
    expect(rows).toHaveLength(2)
    db.prepare("DELETE FROM file_mappings WHERE slug = 'rate-limiting'").run()
  })

  test('batch transaction works', () => {
    const upsertFeature = db.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type, invocation_count, log_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        wrapper_type = excluded.wrapper_type,
        last_seen = datetime('now'),
        invocation_count = excluded.invocation_count,
        log_count = excluded.log_count
    `)
    const upsertEdge = db.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES (?, ?, ?)
      ON CONFLICT(from_slug, to_slug, edge_type) DO NOTHING
    `)

    const transaction = db.transaction(() => {
      upsertFeature.run('feat-a', 'handler', 5, 2)
      upsertFeature.run('feat-b', 'plugin', 3, 1)
      upsertEdge.run('feat-a', 'feat-b', 'uses')
    })

    transaction()

    const features = db.prepare('SELECT * FROM feature_registry ORDER BY slug').all() as any[]
    expect(features).toHaveLength(2)
    expect(features[0].slug).toBe('feat-a')
    expect(features[1].slug).toBe('feat-b')

    const edges = db.prepare('SELECT * FROM feature_edges').all()
    expect(edges).toHaveLength(1)

    db.prepare('DELETE FROM feature_registry').run()
    db.prepare('DELETE FROM feature_edges').run()
  })
})

describe('feature-registry-db read functions', () => {
  let db: InstanceType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec(REGISTRY_SCHEMA)

    db.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type, invocation_count, log_count)
      VALUES ('rate-limiting', 'handler', 100, 50)
    `).run()
    db.prepare(`
      INSERT INTO feature_registry (slug, wrapper_type, invocation_count, log_count)
      VALUES ('runtime-config', 'plugin', 5, 10)
    `).run()

    db.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES ('rate-limiting', 'runtime-config', 'uses')
    `).run()
    db.prepare(`
      INSERT INTO feature_edges (from_slug, to_slug, edge_type)
      VALUES ('rate-limiting', 'token-bucket', 'contains')
    `).run()

    db.prepare(`
      INSERT INTO file_mappings (slug, file_path, line_start)
      VALUES ('rate-limiting', 'core/server/middleware/rate-limit.ts', 1)
    `).run()
    db.prepare(`
      INSERT INTO file_mappings (slug, file_path, line_start)
      VALUES ('rate-limiting', 'core/tests/server/rate-limit.test.ts', 1)
    `).run()
  })

  afterAll(() => {
    db.close()
  })

  test('query all features', () => {
    const rows = db.prepare('SELECT * FROM feature_registry ORDER BY slug').all() as any[]
    expect(rows).toHaveLength(2)
    expect(rows[0].slug).toBe('rate-limiting')
    expect(rows[1].slug).toBe('runtime-config')
  })

  test('query feature by slug', () => {
    const rows = db.prepare('SELECT * FROM feature_registry WHERE slug = ?').all('rate-limiting') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].invocation_count).toBe(100)
  })

  test('query all edges', () => {
    const rows = db.prepare('SELECT * FROM feature_edges ORDER BY from_slug, to_slug').all() as any[]
    expect(rows).toHaveLength(2)
  })

  test('query edges by slug (both directions)', () => {
    const rows = db.prepare(
      'SELECT * FROM feature_edges WHERE from_slug = ? OR to_slug = ?'
    ).all('runtime-config', 'runtime-config') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].from_slug).toBe('rate-limiting')
    expect(rows[0].to_slug).toBe('runtime-config')
  })

  test('query file mappings by slug', () => {
    const rows = db.prepare(
      'SELECT * FROM file_mappings WHERE slug = ?'
    ).all('rate-limiting') as any[]
    expect(rows).toHaveLength(2)
  })

  test('query all file mappings', () => {
    const rows = db.prepare('SELECT * FROM file_mappings ORDER BY slug, file_path').all() as any[]
    expect(rows).toHaveLength(2)
  })
})
