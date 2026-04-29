/**
 * useDb() — PostgreSQL wrapper via postgres.js (Neon-compatible).
 *
 * Reads DATABASE_URL from the environment. Works with Neon, Supabase,
 * or any PostgreSQL-compatible connection string.
 *
 * External API (unchanged for all route handlers):
 *   db.sql`SELECT * FROM foo WHERE id = ${id}`  → Promise<{ rows: [] }>
 *   db.prepare(sql).bind(...args).run()          → Promise<void>
 *
 * Note: prepare() automatically converts SQLite ? placeholders to
 * PostgreSQL $1, $2, ... style so existing route handlers need no changes.
 */

import postgres from 'postgres'

type Rows = Record<string, unknown>[]

export interface DbWrapper {
  sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<{ rows: Rows }>
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<void> } }
}

let _db: DbWrapper | null = null

export function useDb(): DbWrapper {
  if (_db) return _db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const client = postgres(connectionString, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required for Neon's connection pooler
  })

  _db = {
    async sql(strings: TemplateStringsArray, ...values: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client(strings, ...(values as any[]))
      return { rows: result as unknown as Rows }
    },

    prepare(rawSql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              // Convert SQLite ? placeholders → PostgreSQL $1, $2, ...
              let i = 0
              const pgSql = rawSql.replace(/\?/g, () => `$${++i}`)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await client.unsafe(pgSql, args as any[])
            },
          }
        },
      }
    },
  }

  return _db
}
