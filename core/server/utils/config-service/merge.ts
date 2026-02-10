// CONTEXT: runtime-config — Deep merge engine with $meta.lock governance (ADR-005 Part 2-3)
import type { ConfigLayer, MergeOrder, MergeResult } from './types'
import { flattenConfig } from './paths'

const META_KEY = '$meta'
const DEFAULT_MERGE_ORDER: MergeOrder = ['core', 'core:org', 'core:app', 'user']

/**
 * Deep merge source into target (mutates target).
 * Objects recurse, arrays and primitives replace.
 */
export function configDeepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && typeof target[key] === 'object'
      && target[key] !== null
      && !Array.isArray(target[key])
    ) {
      configDeepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}

/**
 * Check if a dot-notation path is locked (exact match or ancestor locked).
 */
function isPathLocked(path: string, lockedPaths: Set<string>): boolean {
  if (lockedPaths.has(path)) return true
  const parts = path.split('.')
  for (let i = 1; i < parts.length; i++) {
    if (lockedPaths.has(parts.slice(0, i).join('.'))) return true
  }
  return false
}

/**
 * Remove all keys at locked paths from a config object.
 * Returns a new object with locked paths stripped.
 */
function stripLockedPaths(
  config: Record<string, unknown>,
  lockedPaths: Set<string>,
  prefix: string = '',
): Record<string, unknown> {
  if (lockedPaths.size === 0) return { ...config }
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (key === META_KEY) continue
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (isPathLocked(fullPath, lockedPaths)) continue
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const stripped = stripLockedPaths(value as Record<string, unknown>, lockedPaths, fullPath)
      if (Object.keys(stripped).length > 0) {
        result[key] = stripped
      }
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Merge config layers with $meta.lock governance.
 *
 * Algorithm (from ADR-005):
 * 1. Process tiers in merge order (platform → organization → user)
 * 2. For each tier:
 *    a. Strip paths locked by PREVIOUS tiers
 *    b. Merge the stripped config into result
 *    c. Accumulate THIS tier's locks for FUTURE tiers
 *
 * Platform has lowest value priority but highest lock priority.
 * User has highest value priority but cannot override locked paths.
 */
export function mergeWithGovernance(layers: ConfigLayer[]): MergeResult {
  if (layers.length === 0) {
    return { config: {}, lockedPaths: new Set() }
  }

  // Get merge order from platform layer (or use default)
  const coreLayer = layers.find(l => l.layer_name === 'core')
  const meta = coreLayer?.config_data?.[META_KEY] as Record<string, unknown> | undefined
  const mergeOrder: MergeOrder = (meta?.mergeOrder as MergeOrder) || DEFAULT_MERGE_ORDER

  // Sort layers by merge order (core first, user last)
  const sorted = [...layers].sort((a, b) => {
    const aIdx = mergeOrder.indexOf(a.layer_name)
    const bIdx = mergeOrder.indexOf(b.layer_name)
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  })

  const lockedPaths = new Set<string>()
  let merged: Record<string, unknown> = {}

  for (const layer of sorted) {
    const config = layer.config_data

    // Step 1: Strip paths locked by PREVIOUS tiers
    const stripped = stripLockedPaths(config, lockedPaths)

    // Step 2: Merge into result (later tiers override earlier)
    configDeepMerge(merged, stripped)

    // Step 3: Accumulate THIS tier's locks for FUTURE tiers
    const layerMeta = config[META_KEY] as Record<string, unknown> | undefined
    if (layerMeta?.lock && Array.isArray(layerMeta.lock)) {
      for (const path of layerMeta.lock) {
        lockedPaths.add(path as string)
      }
    }
  }

  // Strip $meta from final output
  delete merged[META_KEY]

  return { config: merged, lockedPaths }
}

/**
 * Compute a flat diff between two config objects.
 * Returns only the keys that changed, with old and new values.
 */
export function computeConfigDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown, new: unknown }> {
  const flatBefore = flattenConfig(before)
  const flatAfter = flattenConfig(after)
  const diff: Record<string, { old: unknown, new: unknown }> = {}

  const allKeys = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)])
  for (const key of allKeys) {
    const oldVal = flatBefore[key]
    const newVal = flatAfter[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { old: oldVal, new: newVal }
    }
  }

  return diff
}
