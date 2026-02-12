import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

let _root: string | undefined

/**
 * Walk up from cwd to find the monorepo root (directory containing turbo.json).
 * Result is cached after first call.
 */
export function getProjectRoot(): string {
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

/**
 * Join path segments relative to the project root.
 */
export function getProjectPath(...segments: string[]): string {
  return join(getProjectRoot(), ...segments)
}
