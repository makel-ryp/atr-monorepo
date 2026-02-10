import { describe, test, expect } from 'vitest'
import {
  getNestedValue,
  setNestedValue,
  deleteNestedValue,
  flattenConfig,
  unflattenConfig,
} from '../../server/utils/config-service/paths'

describe('getNestedValue', () => {
  test('gets top-level value', () => {
    expect(getNestedValue({ a: 1 }, 'a')).toBe(1)
  })

  test('gets deeply nested value', () => {
    expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  test('returns undefined for missing path', () => {
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined()
  })

  test('returns undefined for missing intermediate', () => {
    expect(getNestedValue({ a: 1 }, 'a.b.c')).toBeUndefined()
  })

  test('returns undefined when intermediate is null', () => {
    expect(getNestedValue({ a: null } as any, 'a.b')).toBeUndefined()
  })

  test('handles array values as leaves', () => {
    expect(getNestedValue({ a: [1, 2, 3] }, 'a')).toEqual([1, 2, 3])
  })
})

describe('setNestedValue', () => {
  test('sets top-level value', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a', 1)
    expect(obj.a).toBe(1)
  })

  test('sets deeply nested value, creating intermediates', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a.b.c', 42)
    expect((obj.a as any).b.c).toBe(42)
  })

  test('overwrites existing value', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } }
    setNestedValue(obj, 'a.b', 2)
    expect((obj.a as any).b).toBe(2)
  })

  test('creates intermediate when existing is not an object', () => {
    const obj: Record<string, unknown> = { a: 'string' }
    setNestedValue(obj, 'a.b', 1)
    expect((obj.a as any).b).toBe(1)
  })
})

describe('deleteNestedValue', () => {
  test('deletes top-level key', () => {
    const obj: Record<string, unknown> = { a: 1, b: 2 }
    expect(deleteNestedValue(obj, 'a')).toBe(true)
    expect(obj).toEqual({ b: 2 })
  })

  test('deletes nested key', () => {
    const obj: Record<string, unknown> = { a: { b: 1, c: 2 } }
    expect(deleteNestedValue(obj, 'a.b')).toBe(true)
    expect((obj.a as any).c).toBe(2)
    expect((obj.a as any).b).toBeUndefined()
  })

  test('returns false for missing key', () => {
    expect(deleteNestedValue({ a: 1 }, 'b')).toBe(false)
  })

  test('returns false for missing intermediate', () => {
    expect(deleteNestedValue({ a: 1 }, 'a.b.c')).toBe(false)
  })
})

describe('flattenConfig', () => {
  test('flattens nested object', () => {
    const result = flattenConfig({ a: { b: 1, c: { d: 2 } } })
    expect(result).toEqual({ 'a.b': 1, 'a.c.d': 2 })
  })

  test('treats arrays as atomic', () => {
    const result = flattenConfig({ a: [1, 2, 3] })
    expect(result).toEqual({ a: [1, 2, 3] })
  })

  test('handles empty object', () => {
    expect(flattenConfig({})).toEqual({})
  })

  test('handles flat object', () => {
    expect(flattenConfig({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' })
  })

  test('handles null values', () => {
    expect(flattenConfig({ a: null } as any)).toEqual({ a: null })
  })
})

describe('unflattenConfig', () => {
  test('unflattens dot-notation keys', () => {
    const result = unflattenConfig({ 'a.b': 1, 'a.c.d': 2 })
    expect(result).toEqual({ a: { b: 1, c: { d: 2 } } })
  })

  test('roundtrips with flattenConfig', () => {
    const original = { x: { y: { z: 'deep' } }, a: 1 }
    expect(unflattenConfig(flattenConfig(original))).toEqual(original)
  })
})
