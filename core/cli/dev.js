#!/usr/bin/env node

/**
 * Smart dev launcher for app-agent monorepo.
 *
 * This script detects if /apps/ is empty and guides first-time users
 * to either copy a demo or explore the demos first.
 */

import { spawn } from 'node:child_process'
import { readdir, cp, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as readline from 'node:readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '../..')

// Demo definitions - will be moved to docs content later
const DEMOS = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Internal tools, admin panels, analytics',
    port: 3010
  },
  {
    id: 'saas',
    name: 'SaaS',
    description: 'Customer-facing application patterns',
    port: 3011
  },
  {
    id: 'landing',
    name: 'Landing',
    description: 'Marketing sites and documentation',
    port: 3012
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'AI chatbot with persistent history',
    port: 3013
  }
]

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function getApps() {
  try {
    const appsDir = join(rootDir, 'apps')
    const entries = await readdir(appsDir)
    return entries.filter(e => !e.startsWith('.'))
  } catch {
    return []
  }
}

async function getDemos() {
  try {
    const demosDir = join(rootDir, 'demos')
    const entries = await readdir(demosDir)
    return entries.filter(e => !e.startsWith('.'))
  } catch {
    return []
  }
}

async function copyDemo(demoId, appName) {
  const srcDir = join(rootDir, 'demos', demoId)
  const destDir = join(rootDir, 'apps', appName)

  console.log(`\nCopying ${demoId} demo to apps/${appName}...`)

  // Copy the directory
  await cp(srcDir, destDir, { recursive: true })

  // Update package.json with new name and port
  const pkgPath = join(destDir, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

  pkg.name = `@app-agent/${appName}`
  // First customer app gets port 3001
  pkg.scripts.dev = 'nuxt dev --port 3001'

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // Remove .nuxt and .output if they exist
  const { rm } = await import('node:fs/promises')
  await rm(join(destDir, '.nuxt'), { recursive: true, force: true })
  await rm(join(destDir, '.output'), { recursive: true, force: true })
  await rm(join(destDir, '.data'), { recursive: true, force: true })

  console.log(`\n✅ Created apps/${appName}`)
  console.log(`   Package: @app-agent/${appName}`)
  console.log(`   Port: 3001`)
  console.log(`\nNext steps:`)
  console.log(`   1. Run: bun install`)
  console.log(`   2. Run: bun run dev`)
  console.log(`\nYour app will be available at http://localhost:3001`)
}

async function runTurbo(filters) {
  const args = ['run', 'dev']
  if (filters) {
    const filterList = Array.isArray(filters) ? filters : [filters]
    for (const f of filterList) {
      args.push(`--filter=${f}`)
    }
  }

  const turbo = spawn('turbo', args, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true
  })

  turbo.on('error', (err) => {
    console.error('Failed to start turbo:', err)
    process.exit(1)
  })

  turbo.on('exit', (code) => {
    process.exit(code || 0)
  })
}

async function interactiveSetup() {
  const rl = createReadline()

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Welcome to App Agent!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  No apps found in /apps/. What would you like to do?')
  console.log('')
  console.log('  1. Copy a demo to start your first app')
  console.log('  2. Run demos to explore first')
  console.log('  3. Exit')
  console.log('')

  const choice = await question(rl, '  Enter choice (1-3): ')

  if (choice === '1') {
    console.log('')
    console.log('  Available demos:')
    console.log('')
    DEMOS.forEach((demo, i) => {
      console.log(`  ${i + 1}. ${demo.name} - ${demo.description}`)
    })
    console.log('')

    const demoChoice = await question(rl, `  Which demo? (1-${DEMOS.length}): `)
    const demoIndex = parseInt(demoChoice, 10) - 1

    if (demoIndex < 0 || demoIndex >= DEMOS.length) {
      console.log('  Invalid choice. Exiting.')
      rl.close()
      process.exit(1)
    }

    const demo = DEMOS[demoIndex]
    console.log('')
    console.log(`  You selected: ${demo.name}`)
    console.log('')

    const appName = await question(rl, '  Name for your app (e.g., "my-app"): ')

    if (!appName || !/^[a-z0-9-]+$/.test(appName)) {
      console.log('  Invalid name. Use lowercase letters, numbers, and hyphens only.')
      rl.close()
      process.exit(1)
    }

    rl.close()
    await copyDemo(demo.id, appName)

  } else if (choice === '2') {
    rl.close()
    console.log('')
    console.log('  Starting docs + demos...')
    console.log('')
    console.log('  Docs:      http://localhost:3000 (MCP server)')
    console.log('  Dashboard: http://localhost:3010')
    console.log('  SaaS:      http://localhost:3011')
    console.log('  Landing:   http://localhost:3012')
    console.log('  Chat:      http://localhost:3013')
    console.log('')
    await runTurbo(['@app-agent/docs', '@app-agent/demo-*'])

  } else {
    rl.close()
    console.log('  Goodbye!')
    process.exit(0)
  }
}

async function main() {
  const apps = await getApps()
  const demos = await getDemos()

  if (apps.length > 0) {
    // Customer has apps - run everything
    console.log('')
    console.log('🚀 Starting development server...')
    console.log('')
    await runTurbo()
  } else if (demos.length > 0) {
    // No apps yet - interactive setup
    await interactiveSetup()
  } else {
    console.error('❌ No apps or demos found. Something is wrong with your setup.')
    process.exit(1)
  }
}

main().catch(console.error)
