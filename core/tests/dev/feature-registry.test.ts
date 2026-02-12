import { describe, test, expect, beforeEach } from 'vitest'
import {
  registerFeature,
  recordEdge,
  incrementInvocations,
  incrementLogCount,
  getRegistry,
  clearRegistry,
} from '../../server/utils/feature-registry'

describe('feature-registry (dev mode)', () => {
  beforeEach(() => {
    clearRegistry()
  })

  describe('registerFeature', () => {
    test('adds a feature to the registry', () => {
      registerFeature('test-feature', 'handler')
      const { features } = getRegistry()
      expect(features).toHaveLength(1)
      expect(features[0].slug).toBe('test-feature')
      expect(features[0].wrapperType).toBe('handler')
      expect(features[0].invocationCount).toBe(0)
      expect(features[0].logCount).toBe(0)
    })

    test('is idempotent — second call does not duplicate', () => {
      registerFeature('test-feature', 'handler')
      registerFeature('test-feature', 'handler')
      const { features } = getRegistry()
      expect(features).toHaveLength(1)
    })

    test('first registration wins wrapperType', () => {
      registerFeature('test-feature', 'handler')
      registerFeature('test-feature', 'dependency')
      const { features } = getRegistry()
      expect(features[0].wrapperType).toBe('handler')
    })

    test('defaults wrapperType to manual', () => {
      registerFeature('test-feature')
      const { features } = getRegistry()
      expect(features[0].wrapperType).toBe('manual')
    })

    test('registers multiple distinct features', () => {
      registerFeature('feature-a', 'handler')
      registerFeature('feature-b', 'plugin')
      const { features } = getRegistry()
      expect(features).toHaveLength(2)
      const slugs = features.map(f => f.slug).sort()
      expect(slugs).toEqual(['feature-a', 'feature-b'])
    })
  })

  describe('recordEdge', () => {
    test('adds an edge to the registry', () => {
      recordEdge('parent', 'child', 'contains')
      const { edges } = getRegistry()
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({ from: 'parent', to: 'child', type: 'contains' })
    })

    test('deduplicates same from/to/type', () => {
      recordEdge('parent', 'child', 'contains')
      recordEdge('parent', 'child', 'contains')
      const { edges } = getRegistry()
      expect(edges).toHaveLength(1)
    })

    test('different edge types are distinct', () => {
      recordEdge('a', 'b', 'contains')
      recordEdge('a', 'b', 'uses')
      const { edges } = getRegistry()
      expect(edges).toHaveLength(2)
    })

    test('different targets are distinct', () => {
      recordEdge('a', 'b', 'uses')
      recordEdge('a', 'c', 'uses')
      const { edges } = getRegistry()
      expect(edges).toHaveLength(2)
    })
  })

  describe('incrementInvocations', () => {
    test('increments count for registered feature', () => {
      registerFeature('test-feature', 'handler')
      incrementInvocations('test-feature')
      incrementInvocations('test-feature')
      const { features } = getRegistry()
      expect(features[0].invocationCount).toBe(2)
    })

    test('no-ops for unregistered slug', () => {
      expect(() => incrementInvocations('nonexistent')).not.toThrow()
      const { features } = getRegistry()
      expect(features).toHaveLength(0)
    })
  })

  describe('incrementLogCount', () => {
    test('increments count for registered feature', () => {
      registerFeature('test-feature', 'handler')
      incrementLogCount('test-feature')
      incrementLogCount('test-feature')
      incrementLogCount('test-feature')
      const { features } = getRegistry()
      expect(features[0].logCount).toBe(3)
    })

    test('no-ops for unregistered slug', () => {
      expect(() => incrementLogCount('nonexistent')).not.toThrow()
    })
  })

  describe('getRegistry', () => {
    test('returns snapshot, not live reference', () => {
      registerFeature('test-feature', 'handler')
      const snapshot = getRegistry()
      registerFeature('another-feature', 'plugin')
      expect(snapshot.features).toHaveLength(1)
      expect(getRegistry().features).toHaveLength(2)
    })

    test('returns empty arrays when registry is empty', () => {
      const { features, edges } = getRegistry()
      expect(features).toEqual([])
      expect(edges).toEqual([])
    })
  })

  describe('clearRegistry', () => {
    test('empties features and edges', () => {
      registerFeature('test-feature', 'handler')
      recordEdge('a', 'b', 'uses')
      clearRegistry()
      const { features, edges } = getRegistry()
      expect(features).toEqual([])
      expect(edges).toEqual([])
    })

    test('allows re-registration after clear', () => {
      registerFeature('test-feature', 'handler')
      clearRegistry()
      registerFeature('test-feature', 'plugin')
      const { features } = getRegistry()
      expect(features[0].wrapperType).toBe('plugin')
    })
  })
})
