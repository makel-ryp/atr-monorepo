// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
//
// Reads CORE_DATASOURCE_* from process.env (NOT runtimeConfig).
// This keeps the datasource config out of the Nuxt config shape,
// so it doesn't pollute downstream apps' runtimeConfig contracts.
//
// Remote providers must be PostgreSQL-compatible.
// SQLite is the local-first fallback — no external setup required.
//
// To add a new provider:
//   1. Create provider-xxx.ts implementing ConfigProvider
//   2. Add a case below for CORE_DATASOURCE_PROVIDER=xxx

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { ConfigProvider } from './types'
import { SupabaseConfigProvider } from './provider-supabase'
import { SqliteConfigProvider } from './provider-sqlite'

// Nuxt only loads .env from the app's rootDir, which in a monorepo
// may not be the repo root where .env lives. Load it ourselves.
function ensureRootEnv(): void {
  if (process.env.CORE_DATASOURCE_URL) return
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'turbo.json'))) {
      const envPath = join(dir, '.env')
      if (existsSync(envPath)) {
        for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eq = trimmed.indexOf('=')
          if (eq === -1) continue
          const key = trimmed.slice(0, eq)
          if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1)
        }
      }
      return
    }
    dir = dirname(dir)
  }
}

export function createConfigProvider(): ConfigProvider {
  ensureRootEnv()

  const url = process.env.CORE_DATASOURCE_URL
  const key = process.env.CORE_DATASOURCE_KEY
  const provider = process.env.CORE_DATASOURCE_PROVIDER

  // Explicit sqlite provider — URL is optional file path
  if (provider === 'sqlite') {
    return new SqliteConfigProvider(url || undefined)
  }

  // No datasource configured → fall back to local SQLite
  if (!url || !key) {
    return new SqliteConfigProvider()
  }

  switch (provider || 'supabase') {
    case 'supabase':
      return new SupabaseConfigProvider(url, key)
    // case 'neon':
    //   return new NeonConfigProvider(url, key)
    // case 'pg':
    //   return new PgConfigProvider(url, key)
    default:
      console.warn(`[config-service] Unknown datasource provider: "${provider}", falling back to SQLite`)
      return new SqliteConfigProvider()
  }
}
