#!/usr/bin/env node
/**
 * Syncs apps/inventory/ to the inventory-dashboard GitHub repo.
 * Usage: bun run sync:inventory
 */
import { execSync } from 'node:child_process'

const REMOTE  = 'personal'
const PREFIX  = 'apps/inventory'
const BRANCH  = 'main'

console.log(`\n▶ Splitting subtree ${PREFIX}...`)
const sha = execSync(
  `git subtree split --prefix=${PREFIX} ${BRANCH}`,
  { encoding: 'utf8' }
).trim()

console.log(`  SHA: ${sha}`)
console.log(`▶ Force-pushing to ${REMOTE}/${BRANCH}...`)

execSync(
  `git push ${REMOTE} ${sha}:${BRANCH} --force`,
  { stdio: 'inherit' }
)

console.log(`\n✓ inventory-dashboard is up to date.\n`)
