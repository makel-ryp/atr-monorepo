import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineFeatureComposable } from '../../app/composables/defineFeatureComposable'

describe('defineFeatureComposable', () => {
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
    const composable = defineFeatureComposable('test-slug', (feat) => {
      return { value: 42 }
    })
    expect(typeof composable).toBe('function')
  })

  test('composable receives feat with correct slug', () => {
    let receivedSlug: string | undefined
    const composable = defineFeatureComposable('my-feature', (feat) => {
      receivedSlug = feat.slug
    })
    composable()
    expect(receivedSlug).toBe('my-feature')
  })

  test('feat has empty meta object', () => {
    let receivedMeta: Record<string, any> | undefined
    const composable = defineFeatureComposable('meta-test', (feat) => {
      receivedMeta = feat.meta
    })
    composable()
    expect(receivedMeta).toEqual({})
  })

  test('feat.log calls console.log with [slug] prefix', () => {
    const composable = defineFeatureComposable('rate-limiting', (feat) => {
      feat.log('checking request')
    })
    composable()
    expect(logSpy).toHaveBeenCalledWith('[rate-limiting]', 'checking request')
  })

  test('feat.warn calls console.warn with [slug] prefix', () => {
    const composable = defineFeatureComposable('auth', (feat) => {
      feat.warn('token expiring soon')
    })
    composable()
    expect(warnSpy).toHaveBeenCalledWith('[auth]', 'token expiring soon')
  })

  test('feat.error calls console.error with [slug] prefix', () => {
    const composable = defineFeatureComposable('db-pool', (feat) => {
      feat.error('connection failed')
    })
    composable()
    expect(errorSpy).toHaveBeenCalledWith('[db-pool]', 'connection failed')
  })

  test('feat.log passes extra data arguments', () => {
    const composable = defineFeatureComposable('api', (feat) => {
      feat.log('response', { status: 200 }, 'extra')
    })
    composable()
    expect(logSpy).toHaveBeenCalledWith('[api]', 'response', { status: 200 }, 'extra')
  })

  test('composable forwards arguments', () => {
    let receivedArgs: any[] = []
    const composable = defineFeatureComposable<[string, number], void>(
      'args-test',
      (feat, name, count) => {
        receivedArgs = [name, count]
      }
    )
    composable('hello', 42)
    expect(receivedArgs).toEqual(['hello', 42])
  })

  test('composable returns value from inner function', () => {
    const composable = defineFeatureComposable('return-test', (feat) => {
      return { canProceed: true, remaining: 5 }
    })
    const result = composable()
    expect(result).toEqual({ canProceed: true, remaining: 5 })
  })

  test('composable with args and return value', () => {
    const add = defineFeatureComposable<[number, number], number>(
      'math',
      (feat, a, b) => {
        feat.log('adding', a, b)
        return a + b
      }
    )
    const result = add(3, 7)
    expect(result).toBe(10)
    expect(logSpy).toHaveBeenCalledWith('[math]', 'adding', 3, 7)
  })

  test('same feat instance is reused across calls', () => {
    const slugsSeen: string[] = []
    const composable = defineFeatureComposable('reuse-test', (feat) => {
      slugsSeen.push(feat.slug)
      return feat
    })
    const feat1 = composable()
    const feat2 = composable()
    expect(feat1).toBe(feat2)
    expect(slugsSeen).toEqual(['reuse-test', 'reuse-test'])
  })

  test('meta can be mutated and persists across calls', () => {
    const composable = defineFeatureComposable('meta-persist', (feat) => {
      if (!feat.meta.count) feat.meta.count = 0
      feat.meta.count++
      return feat.meta.count
    })
    expect(composable()).toBe(1)
    expect(composable()).toBe(2)
    expect(composable()).toBe(3)
  })

  test('different composables have independent scopes', () => {
    const comp1 = defineFeatureComposable('scope-a', (feat) => feat.slug)
    const comp2 = defineFeatureComposable('scope-b', (feat) => feat.slug)
    expect(comp1()).toBe('scope-a')
    expect(comp2()).toBe('scope-b')
  })

  test('feat has feature() method', () => {
    const composable = defineFeatureComposable('parent', (feat) => {
      return typeof feat.feature
    })
    expect(composable()).toBe('function')
  })

  test('feat has getFeature() method', () => {
    const composable = defineFeatureComposable('parent', (feat) => {
      return typeof feat.getFeature
    })
    expect(composable()).toBe('function')
  })

  test('feat.feature() creates child scope and returns value', () => {
    const composable = defineFeatureComposable('parent', (feat) => {
      return feat.feature('child', (child) => {
        child.log('from child')
        return child.slug
      })
    })
    expect(composable()).toBe('child')
    expect(logSpy).toHaveBeenCalledWith('[child]', 'from child')
  })

  test('feat.feature() creates fresh scope each call', () => {
    const scopes: any[] = []
    const composable = defineFeatureComposable('parent', (feat) => {
      feat.feature('child', (child) => { scopes.push(child) })
      feat.feature('child', (child) => { scopes.push(child) })
    })
    composable()
    expect(scopes[0]).not.toBe(scopes[1])
  })

  test('feat.getFeature() returns cached scope', () => {
    const composable = defineFeatureComposable('consumer', (feat) => {
      const dep1 = feat.getFeature('provider')
      const dep2 = feat.getFeature('provider')
      return dep1 === dep2
    })
    expect(composable()).toBe(true)
  })

  test('feat.getFeature() meta persists', () => {
    const composable = defineFeatureComposable('consumer', (feat) => {
      feat.getFeature('provider').meta.count = 42
      return feat.getFeature('provider').meta.count
    })
    expect(composable()).toBe(42)
  })

  test('feat.getFeature() returns scope with correct slug', () => {
    const composable = defineFeatureComposable('consumer', (feat) => {
      return feat.getFeature('some-dep').slug
    })
    expect(composable()).toBe('some-dep')
  })

  test('nested feature() inside getFeature() works', () => {
    const composable = defineFeatureComposable('consumer', (feat) => {
      const dep = feat.getFeature('provider')
      return dep.feature('sub', (sub) => sub.slug)
    })
    expect(composable()).toBe('sub')
  })
})
