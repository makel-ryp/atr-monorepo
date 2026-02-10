// CONTEXT: runtime-config — Provider factory for config service (ADR-005)
//
// Reads CORE_DATASOURCE_* from process.env (NOT runtimeConfig).
// This keeps the datasource config out of the Nuxt config shape,
// so it doesn't pollute downstream apps' runtimeConfig contracts.
//
// Constraint: all providers must be PostgreSQL-compatible.
// If a provider doesn't support realtime, it should emulate via SSE or polling.
//
// To add a new provider:
//   1. Create provider-xxx.ts implementing ConfigProvider
//   2. Add a case below for CORE_DATASOURCE_PROVIDER=xxx

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { ConfigProvider } from './types'
import { SupabaseConfigProvider } from './provider-supabase'

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

export function createConfigProvider(): ConfigProvider | null {
  ensureRootEnv()

  const url = process.env.CORE_DATASOURCE_URL
  const key = process.env.CORE_DATASOURCE_KEY
  const provider = process.env.CORE_DATASOURCE_PROVIDER || 'supabase'

  if (!url || !key) {
    return null
  }

  switch (provider) {
    case 'supabase':
      return new SupabaseConfigProvider(url, key)
    // case 'neon':
    //   return new NeonConfigProvider(url, key)
    // case 'sqlite':
    //   return new SqliteConfigProvider(url)
    // case 'pg':
    //   return new PgConfigProvider(url, key)
    default:
      console.warn(`[config-service] Unknown datasource provider: "${provider}"`)
      return null
  }
}
