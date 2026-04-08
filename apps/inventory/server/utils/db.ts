/**
 * useDb() — runtime-adaptive SQLite wrapper.
 *
 * Bun  (production, preset: bun) → bun:sqlite  (built-in, no native addon)
 * Node (dev server, nuxi dev)    → db0 + better-sqlite3
 *
 * We detect the runtime via process.versions.bun and use an indirect require
 * so Nitro/Rollup does not try to statically resolve 'bun:sqlite' during the
 * Node-side build step — bun:* specifiers are externalized by Nitro's bun
 * preset at bundle time and resolved by Bun's runtime loader at startup.
 *
 * External API (unchanged for all route handlers):
 *   db.sql`SELECT * FROM foo WHERE id = ${id}`  → { rows: [] }
 *   db.prepare(sql).bind(...args).run()          → executes statement
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

const DB_PATH = join(process.cwd(), '.data', 'hub', 'db.sqlite')

// createRequire gives us a working require() in ESM context (both Bun and Node.js).
// Bun externalizes bun:* at runtime so _require('bun:sqlite') resolves correctly.
const _require = createRequire(import.meta.url)

type Rows = Record<string, unknown>[]

export interface DbWrapper {
  sql(strings: TemplateStringsArray, ...values: unknown[]): { rows: Rows }
  prepare(sql: string): { bind(...args: unknown[]): { run(): unknown } }
}

// ── bun:sqlite path ───────────────────────────────────────────────────────────

function makeBunDb(): DbWrapper {
  const { Database } = _require('bun:sqlite')
  const db = new Database(DB_PATH, { create: true })
  db.exec('PRAGMA journal_mode=WAL')
  db.exec('PRAGMA busy_timeout=5000')

  return {
    sql(strings, ...values) {
      let query = ''
      const params: unknown[] = []
      for (let i = 0; i < strings.length; i++) {
        query += strings[i]
        if (i < values.length) { query += '?'; params.push(values[i]) }
      }
      const rows = db.prepare(query).all(...params) as Rows
      return { rows }
    },
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        bind: (...args: unknown[]) => ({ run: () => stmt.run(...args) }),
      }
    },
  }
}

// ── db0 + better-sqlite3 path (Node.js / nuxi dev) ───────────────────────────

function makeNodeDb(): DbWrapper {
  const { createDatabase } = _require('db0')
  const betterSqlite3Connector = _require('db0/connectors/better-sqlite3')

  const connector = betterSqlite3Connector({ path: DB_PATH })
  connector.exec('PRAGMA journal_mode=WAL')
  connector.exec('PRAGMA busy_timeout=5000')

  // db0's tagged-template sql and prepare/bind/run already match our interface
  return createDatabase(connector) as unknown as DbWrapper
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db: DbWrapper | null = null

export function useDb(): DbWrapper {
  if (_db) return _db
  _db = process.versions.bun ? makeBunDb() : makeNodeDb()
  return _db
}
