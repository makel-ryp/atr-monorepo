import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createContextScope, defineContextHandler, defineContextPlugin } from '../../server/utils/context'

// writeLog is stubbed globally by setup-server.ts — access via getter since setup runs after module eval
function getWriteLogMock() {
  return (globalThis as any).writeLog as ReturnType<typeof vi.fn>
}

describe('createContextScope', () => {
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
    const scope = createContextScope('test-slug')
    expect(scope.slug).toBe('test-slug')
    expect(typeof scope.log).toBe('function')
    expect(typeof scope.warn).toBe('function')
    expect(typeof scope.error).toBe('function')
    expect(scope.meta).toEqual({})
  })

  test('has exactly the documented properties', () => {
    const scope = createContextScope('contract')
    const keys = Object.keys(scope).sort()
    expect(keys).toEqual(['error', 'log', 'meta', 'slug', 'warn'])
  })

  test('scope.slug matches input', () => {
    expect(createContextScope('rate-limiting').slug).toBe('rate-limiting')
    expect(createContextScope('auth').slug).toBe('auth')
  })

  test('scope.log calls console.log with [slug] prefix', () => {
    const scope = createContextScope('my-feature')
    scope.log('hello')
    expect(logSpy).toHaveBeenCalledWith('[my-feature]', 'hello')
  })

  test('scope.log with extra data args', () => {
    const scope = createContextScope('api')
    scope.log('request', '/path', { method: 'GET' })
    expect(logSpy).toHaveBeenCalledWith('[api]', 'request', '/path', { method: 'GET' })
  })

  test('scope.log with no extra data — no trailing undefined', () => {
    const scope = createContextScope('clean')
    scope.log('message only')
    expect(logSpy.mock.calls[0]).toEqual(['[clean]', 'message only'])
    expect(logSpy.mock.calls[0]).toHaveLength(2)
  })

  test('scope.warn calls console.warn with prefix', () => {
    const scope = createContextScope('auth')
    scope.warn('deprecated')
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'deprecated')
  })

  test('scope.warn with extra data', () => {
    const scope = createContextScope('auth')
    scope.warn('slow response', { ms: 5000 })
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'slow response', { ms: 5000 })
  })

  test('scope.error calls console.error with prefix', () => {
    const scope = createContextScope('db')
    scope.error('connection lost')
    expect(errorSpy).toHaveBeenCalledWith('[db]', 'connection lost')
  })

  test('scope.error with extra data', () => {
    const scope = createContextScope('db')
    scope.error('failed', { code: 'ECONNREFUSED' })
    expect(errorSpy).toHaveBeenCalledWith('[db]', 'failed', { code: 'ECONNREFUSED' })
  })

  test('production path: writeLog is NOT called (import.meta.dev is falsy in vitest)', () => {
    const scope = createContextScope('prod-test')
    scope.log('msg')
    scope.warn('msg')
    scope.error('msg')
    expect(getWriteLogMock()).not.toHaveBeenCalled()
  })

  test('meta starts empty and is mutable', () => {
    const scope = createContextScope('meta-test')
    expect(scope.meta).toEqual({})
    scope.meta.count = 1
    expect(scope.meta.count).toBe(1)
  })

  test('different scopes are independent', () => {
    const a = createContextScope('scope-a')
    const b = createContextScope('scope-b')
    a.meta.x = 1
    expect(b.meta.x).toBeUndefined()
    a.log('from a')
    expect(logSpy).toHaveBeenCalledWith('[scope-a]', 'from a')
  })
})

describe('defineContextHandler', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
    getWriteLogMock().mockClear()
  })

  test('returns a function', () => {
    const handler = defineContextHandler('test', async (ctx, event) => 'ok')
    expect(typeof handler).toBe('function')
  })

  test('handler receives ctx with correct slug', async () => {
    let receivedSlug: string | undefined
    const handler = defineContextHandler('my-handler', async (ctx, event) => {
      receivedSlug = ctx.slug
    })
    await handler({ path: '/test' } as any)
    expect(receivedSlug).toBe('my-handler')
  })

  test('handler receives the event object', async () => {
    let receivedEvent: any
    const handler = defineContextHandler('evt-test', async (ctx, event) => {
      receivedEvent = event
    })
    const fakeEvent = { path: '/api/users', method: 'GET' }
    await handler(fakeEvent as any)
    expect(receivedEvent).toBe(fakeEvent)
  })

  test('handler returns value', async () => {
    const handler = defineContextHandler('return-test', async (ctx, event) => {
      return { status: 'healthy' }
    })
    const result = await handler({} as any)
    expect(result).toEqual({ status: 'healthy' })
  })

  test('ctx.log works inside handler', async () => {
    const handler = defineContextHandler('log-test', async (ctx, event) => {
      ctx.log('processing', (event as any).path)
    })
    await handler({ path: '/api/users' } as any)
    expect(logSpy).toHaveBeenCalledWith('[log-test]', 'processing', '/api/users')
  })

  test('same ctx is shared across invocations (not recreated)', async () => {
    const ctxRefs: any[] = []
    const handler = defineContextHandler('shared', async (ctx, event) => {
      ctxRefs.push(ctx)
    })
    await handler({} as any)
    await handler({} as any)
    expect(ctxRefs[0]).toBe(ctxRefs[1])
  })

  test('handler propagates errors', async () => {
    const handler = defineContextHandler('throw-test', async (ctx) => {
      throw new Error('test error')
    })
    await expect(handler({} as any)).rejects.toThrow('test error')
  })

  test('sync handler also works', () => {
    const handler = defineContextHandler('sync', (ctx, event) => {
      return 'sync-result'
    })
    expect(handler({} as any)).toBe('sync-result')
  })
})

describe('defineContextPlugin', () => {
  let logSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    logSpy = vi.fn()
    console.log = logSpy as any
    getWriteLogMock().mockClear()
  })

  test('returns a function', () => {
    const plugin = defineContextPlugin('init', async (ctx, nitro) => {})
    expect(typeof plugin).toBe('function')
  })

  test('plugin receives ctx and nitroApp', async () => {
    let receivedCtx: any
    let receivedNitro: any
    const plugin = defineContextPlugin('startup', async (ctx, nitro) => {
      receivedCtx = ctx
      receivedNitro = nitro
    })
    const fakeNitro = { hooks: {} }
    await plugin(fakeNitro as any)
    expect(receivedCtx.slug).toBe('startup')
    expect(receivedNitro).toBe(fakeNitro)
  })

  test('ctx.log works inside plugin', async () => {
    const plugin = defineContextPlugin('boot', async (ctx) => {
      ctx.log('initializing services')
    })
    await plugin({} as any)
    expect(logSpy).toHaveBeenCalledWith('[boot]', 'initializing services')
  })

  test('plugin propagates errors', async () => {
    const plugin = defineContextPlugin('fail-boot', async (ctx) => {
      throw new Error('init failed')
    })
    await expect(plugin({} as any)).rejects.toThrow('init failed')
  })
})
