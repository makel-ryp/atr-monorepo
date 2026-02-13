#!/usr/bin/env bun
/**
 * ADR-005: Runtime Configuration Service — Database Setup
 *
 * Executes scripts/db-setup.sql against your Supabase project using
 * the Management API (requires SUPABASE_ACCESS_TOKEN).
 *
 * Falls back to verification-only mode if no access token is set.
 *
 * Usage:
 *   bun scripts/db-setup.ts
 *
 * Environment variables (from .env):
 *   CORE_DATASOURCE_URL         — Supabase project URL
 *   CORE_DATASOURCE_KEY         — Service role key (for verification)
 *   CORE_DATASOURCE_PROVIDER    — Provider name (default: supabase)
 *   SUPABASE_ACCESS_TOKEN       — Personal access token (for SQL execution)
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually (bun supports it natively)
const envPath = join(__dirname, '..', '.env')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  // .env might not exist
}

const DATASOURCE_URL = process.env.CORE_DATASOURCE_URL
const DATASOURCE_KEY = process.env.CORE_DATASOURCE_KEY
const DATASOURCE_PROVIDER = process.env.CORE_DATASOURCE_PROVIDER || 'supabase'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!DATASOURCE_URL || !DATASOURCE_KEY) {
  console.error('Missing CORE_DATASOURCE_URL or CORE_DATASOURCE_KEY')
  console.error('Set them in .env or as environment variables')
  process.exit(1)
}

if (DATASOURCE_PROVIDER !== 'supabase') {
  console.error(`This script currently only supports the "supabase" provider (got "${DATASOURCE_PROVIDER}")`)
  console.error('For other providers, run scripts/db-setup.sql directly against your database')
  process.exit(1)
}

// Extract project ref from URL (e.g., https://abc123.supabase.co → abc123)
const projectRef = DATASOURCE_URL.replace('https://', '').replace(/\.supabase\.co.*/, '')

/**
 * Execute SQL against the Supabase Management API.
 */
async function executeSQL(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SQL execution failed (${res.status}): ${text}`)
  }
  return res.json()
}

// --- Main ---

if (ACCESS_TOKEN) {
  console.log(`Executing db-setup.sql against project ${projectRef}...`)
  console.log()

  // Read and execute the SQL file
  const sqlPath = join(__dirname, 'db-setup.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  // Split into logical blocks (separated by double newlines after semicolons)
  // Each block can contain multiple statements that depend on each other
  const blocks = sql
    .split(/;\s*\n\s*\n/)
    .map(b => b.trim())
    .filter(b => {
      const cleaned = b.replace(/--[^\n]*/g, '').trim()
      return cleaned.length > 0
    })
    .map(b => b.endsWith(';') ? b : b + ';')

  let success = 0
  let failed = 0

  for (const block of blocks) {
    // Skip comment-only blocks
    const cleaned = block.replace(/--[^\n]*/g, '').trim()
    if (!cleaned || cleaned === ';') continue

    try {
      await executeSQL(block)
      success++
      // Show first line of block as description
      const desc = block.split('\n').find(l => l.trim() && !l.trim().startsWith('--'))?.trim().slice(0, 60)
      console.log(`  ✓ ${desc}...`)
    } catch (err: any) {
      failed++
      const desc = block.split('\n').find(l => l.trim() && !l.trim().startsWith('--'))?.trim().slice(0, 60)
      console.error(`  ✗ ${desc}...`)
      console.error(`    ${err.message}`)
    }
  }

  console.log()
  console.log(`Executed ${success + failed} blocks: ${success} succeeded, ${failed} failed`)
} else {
  console.log('='.repeat(60))
  console.log('No SUPABASE_ACCESS_TOKEN found — cannot execute SQL remotely.')
  console.log()
  console.log('To enable remote execution:')
  console.log('  1. Go to Supabase Dashboard → Account → Access Tokens')
  console.log('  2. Generate a new token')
  console.log('  3. Add SUPABASE_ACCESS_TOKEN=sbp_xxx to your .env')
  console.log()
  console.log('Or run the SQL manually:')
  console.log('  1. Copy scripts/db-setup.sql into Supabase SQL Editor')
  console.log('  2. Or: psql "YOUR_PG_CONNECTION_STRING" -f scripts/db-setup.sql')
  console.log('='.repeat(60))
}

// --- Verify ---

console.log()
console.log('Verifying tables...')

const supabase = createClient(DATASOURCE_URL, DATASOURCE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: layers, error: layersErr } = await supabase
  .from('config_layers')
  .select('app_id, environment, layer_name, layer_key, updated_at')
  .order('layer_name')

if (layersErr) {
  console.log('  config_layers: NOT FOUND — run the SQL first')
} else {
  console.log(`  config_layers: OK (${layers.length} rows)`)
  for (const row of layers) {
    console.log(`    - ${row.app_id}/${row.environment}/${row.layer_name}/${row.layer_key} (updated: ${row.updated_at})`)
  }
}

const { data: history, error: histErr } = await supabase
  .from('config_history')
  .select('id')
  .limit(1)

if (histErr) {
  console.log('  config_history: NOT FOUND — run the SQL first')
} else {
  console.log('  config_history: OK')
}

console.log()
console.log('Done.')
