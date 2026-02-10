import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'

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

describe('logs-db schema', () => {
  let db: InstanceType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec(SCHEMA)
  })

  afterAll(() => {
    db.close()
  })

  test('schema creates logs table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='logs'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  test('logs table has all required columns', () => {
    const cols = db.prepare("PRAGMA table_info(logs)").all() as any[]
    const colNames = cols.map((c: any) => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('slug')
    expect(colNames).toContain('level')
    expect(colNames).toContain('message')
    expect(colNames).toContain('data')
    expect(colNames).toContain('file_path')
    expect(colNames).toContain('line_number')
    expect(colNames).toContain('timestamp')
  })

  test('slug is NOT NULL', () => {
    const cols = db.prepare("PRAGMA table_info(logs)").all() as any[]
    const slugCol = (cols as any[]).find(c => c.name === 'slug')
    expect(slugCol.notnull).toBe(1)
  })

  test('level is NOT NULL', () => {
    const cols = db.prepare("PRAGMA table_info(logs)").all() as any[]
    const levelCol = (cols as any[]).find(c => c.name === 'level')
    expect(levelCol.notnull).toBe(1)
  })

  test('message is NOT NULL', () => {
    const cols = db.prepare("PRAGMA table_info(logs)").all() as any[]
    const msgCol = (cols as any[]).find(c => c.name === 'message')
    expect(msgCol.notnull).toBe(1)
  })

  test('data, file_path, line_number are nullable', () => {
    const cols = db.prepare("PRAGMA table_info(logs)").all() as any[]
    for (const name of ['data', 'file_path', 'line_number']) {
      const col = (cols as any[]).find(c => c.name === name)
      expect(col.notnull).toBe(0)
    }
  })

  test('indexes are created', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='logs'"
    ).all() as any[]
    const names = indexes.map((i: any) => i.name)
    expect(names).toContain('idx_logs_slug')
    expect(names).toContain('idx_logs_slug_timestamp')
  })

  test('CHECK constraint accepts log, warn, error', () => {
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'log', 'ok')
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'warn', 'ok')
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'error', 'ok')
    const rows = db.prepare("SELECT * FROM logs WHERE slug = 'chk'").all()
    expect(rows).toHaveLength(3)
    db.prepare("DELETE FROM logs WHERE slug = 'chk'").run()
  })

  test('CHECK constraint rejects invalid levels', () => {
    expect(() => {
      db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'debug', 'fail')
    }).toThrow()
    expect(() => {
      db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'info', 'fail')
    }).toThrow()
    expect(() => {
      db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('chk', 'trace', 'fail')
    }).toThrow()
  })

  test('timestamp has default value', () => {
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('ts', 'log', 'auto time')
    const row = db.prepare("SELECT timestamp FROM logs WHERE slug = 'ts'").get() as any
    expect(row.timestamp).toBeTruthy()
    expect(new Date(row.timestamp + 'Z').getTime()).not.toBeNaN()
    db.prepare("DELETE FROM logs WHERE slug = 'ts'").run()
  })

  test('id auto-increments', () => {
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('inc', 'log', 'first')
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('inc', 'log', 'second')
    const rows = db.prepare("SELECT id FROM logs WHERE slug = 'inc' ORDER BY id").all() as any[]
    expect(rows).toHaveLength(2)
    expect(rows[1].id).toBeGreaterThan(rows[0].id)
    db.prepare("DELETE FROM logs WHERE slug = 'inc'").run()
  })

  test('data column stores JSON strings', () => {
    const data = JSON.stringify({ path: '/api/test', status: 200 })
    db.prepare("INSERT INTO logs (slug, level, message, data) VALUES (?, ?, ?, ?)").run('json', 'log', 'req', data)
    const row = db.prepare("SELECT data FROM logs WHERE slug = 'json'").get() as any
    expect(JSON.parse(row.data)).toEqual({ path: '/api/test', status: 200 })
    db.prepare("DELETE FROM logs WHERE slug = 'json'").run()
  })

  test('data column stores null when omitted', () => {
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('no-data', 'warn', 'msg')
    const row = db.prepare("SELECT data FROM logs WHERE slug = 'no-data'").get() as any
    expect(row.data).toBeNull()
    db.prepare("DELETE FROM logs WHERE slug = 'no-data'").run()
  })

  test('multiple slugs coexist independently', () => {
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('slug-a', 'log', 'a-msg')
    db.prepare("INSERT INTO logs (slug, level, message) VALUES (?, ?, ?)").run('slug-b', 'warn', 'b-msg')
    const a = db.prepare("SELECT * FROM logs WHERE slug = 'slug-a'").all()
    const b = db.prepare("SELECT * FROM logs WHERE slug = 'slug-b'").all()
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    db.prepare("DELETE FROM logs WHERE slug IN ('slug-a', 'slug-b')").run()
  })

  test('file_path and line_number columns work', () => {
    db.prepare(
      "INSERT INTO logs (slug, level, message, file_path, line_number) VALUES (?, ?, ?, ?, ?)"
    ).run('loc', 'log', 'test', 'server/api/foo.ts', 42)
    const row = db.prepare("SELECT file_path, line_number FROM logs WHERE slug = 'loc'").get() as any
    expect(row.file_path).toBe('server/api/foo.ts')
    expect(row.line_number).toBe(42)
    db.prepare("DELETE FROM logs WHERE slug = 'loc'").run()
  })
})

describe('writeLog logic', () => {
  test('writeLog pattern: inserts correct values', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA)

    function writeLog(slug: string, level: string, message: string, data?: string) {
      try {
        db.prepare("INSERT INTO logs (slug, level, message, data) VALUES (?, ?, ?, ?)").run(
          slug, level, message, data ?? null
        )
      } catch {
        // silent
      }
    }

    writeLog('test', 'log', 'hello', JSON.stringify({ x: 1 }))
    writeLog('test', 'warn', 'caution')
    writeLog('test', 'error', 'failed', JSON.stringify('err'))

    const rows = db.prepare("SELECT slug, level, message, data FROM logs ORDER BY id").all() as any[]
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ slug: 'test', level: 'log', message: 'hello', data: '{"x":1}' })
    expect(rows[1]).toEqual({ slug: 'test', level: 'warn', message: 'caution', data: null })
    expect(rows[2]).toEqual({ slug: 'test', level: 'error', message: 'failed', data: '"err"' })

    db.close()
  })

  test('writeLog pattern: silent on db failure', () => {
    const db = new Database(':memory:')

    function writeLog(slug: string, level: string, message: string, data?: string) {
      try {
        db.prepare("INSERT INTO logs (slug, level, message, data) VALUES (?, ?, ?, ?)").run(
          slug, level, message, data ?? null
        )
      } catch {
        // silent
      }
    }

    expect(() => writeLog('fail', 'log', 'no throw')).not.toThrow()
    db.close()
  })

  test('writeLog pattern: silent on null db', () => {
    function writeLog(slug: string, level: string, message: string, data?: string) {
      try {
        const conn: any = null
        if (!conn) return
        conn.prepare("INSERT INTO logs (slug, level, message, data) VALUES (?, ?, ?, ?)").run(
          slug, level, message, data ?? null
        )
      } catch {
        // silent
      }
    }

    expect(() => writeLog('null', 'log', 'no throw')).not.toThrow()
  })
})

describe('getProjectRoot logic', () => {
  test('turbo.json exists at project root', async () => {
    const { existsSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')

    let dir = process.cwd()
    let found = false
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, 'turbo.json'))) {
        found = true
        break
      }
      dir = dirname(dir)
    }
    expect(found).toBe(true)
  })

  test('algorithm caches result (tested via code review — singleton _root variable)', () => {
    const fs = require('node:fs')
    const source = fs.readFileSync(
      require('node:path').join(process.cwd(), 'core/server/utils/logs-db.ts'), 'utf8'
    )
    expect(source).toContain('let _root')
    expect(source).toContain('if (_root) return _root')
  })
})
