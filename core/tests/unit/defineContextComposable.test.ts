import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineContextComposable } from '../../app/composables/defineContextComposable'

describe('defineContextComposable', () => {
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
  })

  test('returns a callable function', () => {
    const composable = defineContextComposable('test-slug', (ctx) => {
      return { value: 42 }
    })
    expect(typeof composable).toBe('function')
  })

  test('composable receives ctx with correct slug', () => {
    let receivedSlug: string | undefined
    const composable = defineContextComposable('my-feature', (ctx) => {
      receivedSlug = ctx.slug
    })
    composable()
    expect(receivedSlug).toBe('my-feature')
  })

  test('ctx has empty meta object', () => {
    let receivedMeta: Record<string, any> | undefined
    const composable = defineContextComposable('meta-test', (ctx) => {
      receivedMeta = ctx.meta
    })
    composable()
    expect(receivedMeta).toEqual({})
  })

  test('ctx.log calls console.log with [slug] prefix', () => {
    const composable = defineContextComposable('rate-limiting', (ctx) => {
      ctx.log('checking request')
    })
    composable()
    expect(logSpy).toHaveBeenCalledWith('[rate-limiting]', 'checking request')
  })

  test('ctx.warn calls console.warn with [slug] prefix', () => {
    const composable = defineContextComposable('auth', (ctx) => {
      ctx.warn('token expiring soon')
    })
    composable()
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'token expiring soon')
  })

  test('ctx.error calls console.error with [slug] prefix', () => {
    const composable = defineContextComposable('db-pool', (ctx) => {
      ctx.error('connection failed')
    })
    composable()
    expect(errorSpy).toHaveBeenCalledWith('[db-pool]', 'connection failed')
  })

  test('ctx.log passes extra data arguments', () => {
    const composable = defineContextComposable('api', (ctx) => {
      ctx.log('response', { status: 200 }, 'extra')
    })
    composable()
    expect(logSpy).toHaveBeenCalledWith('[api]', 'response', { status: 200 }, 'extra')
  })

  test('composable forwards arguments', () => {
    let receivedArgs: any[] = []
    const composable = defineContextComposable<[string, number], void>(
      'args-test',
      (ctx, name, count) => {
        receivedArgs = [name, count]
      }
    )
    composable('hello', 42)
    expect(receivedArgs).toEqual(['hello', 42])
  })

  test('composable returns value from inner function', () => {
    const composable = defineContextComposable('return-test', (ctx) => {
      return { canProceed: true, remaining: 5 }
    })
    const result = composable()
    expect(result).toEqual({ canProceed: true, remaining: 5 })
  })

  test('composable with args and return value', () => {
    const add = defineContextComposable<[number, number], number>(
      'math',
      (ctx, a, b) => {
        ctx.log('adding', a, b)
        return a + b
      }
    )
    const result = add(3, 7)
    expect(result).toBe(10)
    expect(logSpy).toHaveBeenCalledWith('[math]', 'adding', 3, 7)
  })

  test('same ctx instance is reused across calls', () => {
    const slugsSeen: string[] = []
    const composable = defineContextComposable('reuse-test', (ctx) => {
      slugsSeen.push(ctx.slug)
      return ctx
    })
    const ctx1 = composable()
    const ctx2 = composable()
    expect(ctx1).toBe(ctx2)
    expect(slugsSeen).toEqual(['reuse-test', 'reuse-test'])
  })

  test('meta can be mutated and persists across calls', () => {
    const composable = defineContextComposable('meta-persist', (ctx) => {
      if (!ctx.meta.count) ctx.meta.count = 0
      ctx.meta.count++
      return ctx.meta.count
    })
    expect(composable()).toBe(1)
    expect(composable()).toBe(2)
    expect(composable()).toBe(3)
  })

  test('different composables have independent scopes', () => {
    const comp1 = defineContextComposable('scope-a', (ctx) => ctx.slug)
    const comp2 = defineContextComposable('scope-b', (ctx) => ctx.slug)
    expect(comp1()).toBe('scope-a')
    expect(comp2()).toBe('scope-b')
  })
})
