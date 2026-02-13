import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createFeatureScope, defineFeatureHandler, defineFeaturePlugin } from '../../server/utils/feature'

// writeLog is stubbed globally by setup-server.ts — access via getter since setup runs after module eval
function getWriteLogMock() {
  return (globalThis as any).writeLog as ReturnType<typeof vi.fn>
}

describe('createFeatureScope', () => {
  let logSpy: ReturnType<typeof vi.fn>
  let warnSpy: ReturnType<typeof vi.fn>
  let errorSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    warnSpy = vi.fn()
    errorSpy = vi.fn()
    console.log = logSpy as any
    console.warn = warnSpy as any
    console.error = errorSpy as any
    getWriteLogMock().mockClear()
  })

  test('returns correct shape', () => {
    const scope = createFeatureScope('test-slug')
    expect(scope.slug).toBe('test-slug')
    expect(typeof scope.log).toBe('function')
    expect(typeof scope.warn).toBe('function')
    expect(typeof scope.error).toBe('function')
    expect(scope.meta).toEqual({})
  })

  test('has exactly the documented properties', () => {
    const scope = createFeatureScope('contract')
    const keys = Object.keys(scope).sort()
    expect(keys).toEqual(['error', 'feature', 'getFeature', 'log', 'meta', 'slug', 'warn'])
  })

  test('scope.slug matches input', () => {
    expect(createFeatureScope('rate-limiting').slug).toBe('rate-limiting')
    expect(createFeatureScope('auth').slug).toBe('auth')
  })

  test('scope.log calls console.log with [slug] prefix', () => {
    const scope = createFeatureScope('my-feature')
    scope.log('hello')
    expect(logSpy).toHaveBeenCalledWith('[my-feature]', 'hello')
  })

  test('scope.log with extra data args', () => {
    const scope = createFeatureScope('api')
    scope.log('request', '/path', { method: 'GET' })
    expect(logSpy).toHaveBeenCalledWith('[api]', 'request', '/path', { method: 'GET' })
  })

  test('scope.log with no extra data — no trailing undefined', () => {
    const scope = createFeatureScope('clean')
    scope.log('message only')
    expect(logSpy.mock.calls[0]).toEqual(['[clean]', 'message only'])
    expect(logSpy.mock.calls[0]).toHaveLength(2)
  })

  test('scope.warn calls console.warn with prefix', () => {
    const scope = createFeatureScope('auth')
    scope.warn('deprecated')
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'deprecated')
  })

  test('scope.warn with extra data', () => {
    const scope = createFeatureScope('auth')
    scope.warn('slow response', { ms: 5000 })
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'slow response', { ms: 5000 })
  })

  test('scope.error calls console.error with prefix', () => {
    const scope = createFeatureScope('db')
    scope.error('connection lost')
    expect(errorSpy).toHaveBeenCalledWith('[db]', 'connection lost')
  })

  test('scope.error with extra data', () => {
    const scope = createFeatureScope('db')
    scope.error('failed', { code: 'ECONNREFUSED' })
    expect(errorSpy).toHaveBeenCalledWith('[db]', 'failed', { code: 'ECONNREFUSED' })
  })

  test('production path: writeLog is NOT called (import.meta.dev is falsy in vitest)', () => {
    const scope = createFeatureScope('prod-test')
    scope.log('msg')
    scope.warn('msg')
    scope.error('msg')
    expect(getWriteLogMock()).not.toHaveBeenCalled()
  })

  test('meta starts empty and is mutable', () => {
    const scope = createFeatureScope('meta-test')
    expect(scope.meta).toEqual({})
    scope.meta.count = 1
    expect(scope.meta.count).toBe(1)
  })

  test('different scopes are independent', () => {
    const a = createFeatureScope('scope-a')
    const b = createFeatureScope('scope-b')
    a.meta.x = 1
    expect(b.meta.x).toBeUndefined()
    a.log('from a')
    expect(logSpy).toHaveBeenCalledWith('[scope-a]', 'from a')
  })
})

describe('defineFeatureHandler', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
    getWriteLogMock().mockClear()
  })

  test('returns a function', () => {
    const handler = defineFeatureHandler('test', async (feat, event) => 'ok')
    expect(typeof handler).toBe('function')
  })

  test('handler receives feat with correct slug', async () => {
    let receivedSlug: string | undefined
    const handler = defineFeatureHandler('my-handler', async (feat, event) => {
      receivedSlug = feat.slug
    })
    await handler({ path: '/test' } as any)
    expect(receivedSlug).toBe('my-handler')
  })

  test('handler receives the event object', async () => {
    let receivedEvent: any
    const handler = defineFeatureHandler('evt-test', async (feat, event) => {
      receivedEvent = event
    })
    const fakeEvent = { path: '/api/users', method: 'GET' }
    await handler(fakeEvent as any)
    expect(receivedEvent).toBe(fakeEvent)
  })

  test('handler returns value', async () => {
    const handler = defineFeatureHandler('return-test', async (feat, event) => {
      return { status: 'healthy' }
    })
    const result = await handler({} as any)
    expect(result).toEqual({ status: 'healthy' })
  })

  test('feat.log works inside handler', async () => {
    const handler = defineFeatureHandler('log-test', async (feat, event) => {
      feat.log('processing', (event as any).path)
    })
    await handler({ path: '/api/users' } as any)
    expect(logSpy).toHaveBeenCalledWith('[log-test]', 'processing', '/api/users')
  })

  test('same feat is shared across invocations (not recreated)', async () => {
    const featRefs: any[] = []
    const handler = defineFeatureHandler('shared', async (feat, event) => {
      featRefs.push(feat)
    })
    await handler({} as any)
    await handler({} as any)
    expect(featRefs[0]).toBe(featRefs[1])
  })

  test('handler propagates errors', async () => {
    const handler = defineFeatureHandler('throw-test', async (feat) => {
      throw new Error('test error')
    })
    await expect(handler({} as any)).rejects.toThrow('test error')
  })

  test('sync handler also works', () => {
    const handler = defineFeatureHandler('sync', (feat, event) => {
      return 'sync-result'
    })
    expect(handler({} as any)).toBe('sync-result')
  })
})

describe('FeatureScope.feature()', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
  })

  test('creates child scope with correct slug', () => {
    const parent = createFeatureScope('parent')
    let childSlug: string | undefined
    parent.feature('child', (feat) => {
      childSlug = feat.slug
    })
    expect(childSlug).toBe('child')
  })

  test('returns value from callback', () => {
    const parent = createFeatureScope('parent')
    const result = parent.feature('child', (feat) => 42)
    expect(result).toBe(42)
  })

  test('creates fresh scope each call (not cached)', () => {
    const parent = createFeatureScope('parent')
    const scopes: any[] = []
    parent.feature('child', (feat) => { scopes.push(feat) })
    parent.feature('child', (feat) => { scopes.push(feat) })
    expect(scopes[0]).not.toBe(scopes[1])
  })

  test('child scope has independent meta', () => {
    const parent = createFeatureScope('parent')
    parent.meta.x = 1
    parent.feature('child', (feat) => {
      expect(feat.meta).toEqual({})
      feat.meta.y = 2
    })
    expect(parent.meta.y).toBeUndefined()
  })

  test('child scope can log with its own prefix', () => {
    const parent = createFeatureScope('outer')
    parent.feature('inner', (feat) => {
      feat.log('hello')
    })
    expect(logSpy).toHaveBeenCalledWith('[inner]', 'hello')
  })

  test('nested nesting works', () => {
    const root = createFeatureScope('root')
    let deepSlug: string | undefined
    root.feature('mid', (mid) => {
      mid.feature('deep', (deep) => {
        deepSlug = deep.slug
      })
    })
    expect(deepSlug).toBe('deep')
  })

  test('async return value works', async () => {
    const scope = createFeatureScope('async-parent')
    const result = await scope.feature('async-child', async (feat) => {
      return 'async-result'
    })
    expect(result).toBe('async-result')
  })
})

describe('FeatureScope.getFeature()', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
  })

  test('returns a scope with the requested slug', () => {
    const parent = createFeatureScope('consumer')
    const dep = parent.getFeature('provider')
    expect(dep.slug).toBe('provider')
  })

  test('returned scope has full FeatureScope interface', () => {
    const parent = createFeatureScope('consumer')
    const dep = parent.getFeature('provider')
    expect(typeof dep.log).toBe('function')
    expect(typeof dep.warn).toBe('function')
    expect(typeof dep.error).toBe('function')
    expect(typeof dep.feature).toBe('function')
    expect(typeof dep.getFeature).toBe('function')
    expect(dep.meta).toEqual({})
  })

  test('same slug returns cached scope', () => {
    const parent = createFeatureScope('consumer')
    const dep1 = parent.getFeature('provider')
    const dep2 = parent.getFeature('provider')
    expect(dep1).toBe(dep2)
  })

  test('meta persists across cached accesses', () => {
    const parent = createFeatureScope('consumer')
    parent.getFeature('provider').meta.count = 1
    expect(parent.getFeature('provider').meta.count).toBe(1)
  })

  test('different slugs return different scopes', () => {
    const parent = createFeatureScope('consumer')
    const a = parent.getFeature('dep-a')
    const b = parent.getFeature('dep-b')
    expect(a).not.toBe(b)
    expect(a.slug).toBe('dep-a')
    expect(b.slug).toBe('dep-b')
  })

  test('different parents do not share caches', () => {
    const parent1 = createFeatureScope('consumer-1')
    const parent2 = createFeatureScope('consumer-2')
    const dep1 = parent1.getFeature('shared-dep')
    const dep2 = parent2.getFeature('shared-dep')
    expect(dep1).not.toBe(dep2)
    dep1.meta.x = 1
    expect(dep2.meta.x).toBeUndefined()
  })

  test('dep scope can log with its own prefix', () => {
    const parent = createFeatureScope('consumer')
    const dep = parent.getFeature('dep')
    dep.log('hello from dep')
    expect(logSpy).toHaveBeenCalledWith('[dep]', 'hello from dep')
  })
})

describe('feature() + getFeature() interaction', () => {
  test('child can getFeature', () => {
    const parent = createFeatureScope('parent')
    let depSlug: string | undefined
    parent.feature('child', (child) => {
      const dep = child.getFeature('some-dep')
      depSlug = dep.slug
    })
    expect(depSlug).toBe('some-dep')
  })

  test('getFeature scope can nest feature()', () => {
    const parent = createFeatureScope('consumer')
    const dep = parent.getFeature('provider')
    let nestedSlug: string | undefined
    dep.feature('sub-provider', (sub) => {
      nestedSlug = sub.slug
    })
    expect(nestedSlug).toBe('sub-provider')
  })

  test('circular getFeature does not infinite loop', () => {
    const a = createFeatureScope('feat-a')
    const b = a.getFeature('feat-b')
    const aAgain = b.getFeature('feat-a')
    expect(aAgain.slug).toBe('feat-a')
    expect(aAgain).not.toBe(a)
  })
})

describe('defineFeaturePlugin', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
    getWriteLogMock().mockClear()
  })

  test('returns a function', () => {
    const plugin = defineFeaturePlugin('init', async (feat, nitro) => {})
    expect(typeof plugin).toBe('function')
  })

  test('plugin receives feat and nitroApp', async () => {
    let receivedFeat: any
    let receivedNitro: any
    const plugin = defineFeaturePlugin('startup', async (feat, nitro) => {
      receivedFeat = feat
      receivedNitro = nitro
    })
    const fakeNitro = { hooks: {} }
    await plugin(fakeNitro as any)
    expect(receivedFeat.slug).toBe('startup')
    expect(receivedNitro).toBe(fakeNitro)
  })

  test('feat.log works inside plugin', async () => {
    const plugin = defineFeaturePlugin('boot', async (feat) => {
      feat.log('initializing services')
    })
    await plugin({} as any)
    expect(logSpy).toHaveBeenCalledWith('[boot]', 'initializing services')
  })

  test('plugin propagates errors', async () => {
    const plugin = defineFeaturePlugin('fail-boot', async (feat) => {
      throw new Error('init failed')
    })
    await expect(plugin({} as any)).rejects.toThrow('init failed')
  })
})
