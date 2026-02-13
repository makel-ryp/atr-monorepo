// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md

/**
 * Get a value from a nested object using dot-notation path.
 * Returns undefined if any intermediate segment is missing.
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Set a value in a nested object using dot-notation path.
 * Creates intermediate objects as needed.
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

/**
 * Delete a value from a nested object using dot-notation path.
 * Returns true if the key existed and was deleted.
 */
export function deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (typeof current[part] !== 'object' || current[part] === null) {
      return false
    }
    current = current[part] as Record<string, unknown>
  }
  const lastKey = parts[parts.length - 1]
  if (lastKey in current) {
    delete current[lastKey]
    return true
  }
  return false
}

/**
 * Flatten a nested object into dot-notation keys.
 * Arrays are treated as atomic values (not flattened).
 */
export function flattenConfig(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenConfig(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = value
    }
  }
  return result
}

/**
 * Reconstruct a nested object from dot-notation keys.
 */
export function unflattenConfig(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    setNestedValue(result, key, value)
  }
  return result
}
