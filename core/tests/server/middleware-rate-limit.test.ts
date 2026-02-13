import { describe, test, expect, vi, beforeEach } from 'vitest'

function getUseRuntimeConfig() {
  return (globalThis as any).useRuntimeConfig as ReturnType<typeof vi.fn>
}

function getSetResponseHeader() {
  return (globalThis as any).setResponseHeader as ReturnType<typeof vi.fn>
}

// Re-import the module fresh for each test suite to reset the buckets Map
async function loadMiddleware() {
  // Dynamic import with cache-busting to get a fresh module (fresh buckets Map)
  const mod = await import('../../server/middleware/01.rateLimit')
  return mod.default
}

describe('rateLimit middleware', () => {
  let rateLimitMiddleware: Function

  beforeEach(async () => {
    getUseRuntimeConfig().mockClear()
    getSetResponseHeader().mockClear()
    // Fresh import to reset in-memory bucket state
    vi.resetModules()
    const mod = await import('../../server/middleware/01.rateLimit')
    rateLimitMiddleware = mod.default
  })

  test('skips when rateLimiter.enabled is false', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: false, tokensPerInterval: 150, interval: 300000 },
    })

    const event = { context: {} } as any
    const result = rateLimitMiddleware(event)
    expect(result).toBeUndefined()
  })

  test('allows requests when tokens are available', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: true, tokensPerInterval: 10, interval: 300000 },
    })

    const event = { context: {} } as any
    expect(() => rateLimitMiddleware(event)).not.toThrow()
  })

  test('decrements tokens on each request', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: true, tokensPerInterval: 3, interval: 300000 },
    })

    // First 3 requests succeed
    for (let i = 0; i < 3; i++) {
      const event = { context: {} } as any
      expect(() => rateLimitMiddleware(event)).not.toThrow()
    }

    // 4th request should fail
    const event = { context: {} } as any
    expect(() => rateLimitMiddleware(event)).toThrow()
  })

  test('throws 429 when tokens exhausted', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: true, tokensPerInterval: 1, interval: 300000 },
    })

    // Use up the single token
    rateLimitMiddleware({ context: {} } as any)

    // Next request should be rate limited
    try {
      rateLimitMiddleware({ context: {} } as any)
      expect.unreachable('should have thrown')
    }
    catch (e: any) {
      expect(e.message).toContain('Too Many Requests')
    }
  })

  test('sets Retry-After header on 429', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: true, tokensPerInterval: 1, interval: 300000 },
    })

    const event1 = { context: {} } as any
    rateLimitMiddleware(event1)

    const event2 = { context: {} } as any
    try {
      rateLimitMiddleware(event2)
    }
    catch {
      // expected
    }

    expect(getSetResponseHeader()).toHaveBeenCalledWith(
      event2,
      'Retry-After',
      expect.any(String),
    )
  })

  test('respects config overrides (higher token count)', () => {
    getUseRuntimeConfig().mockReturnValue({
      rateLimiter: { enabled: true, tokensPerInterval: 5, interval: 300000 },
    })

    // All 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      expect(() => rateLimitMiddleware({ context: {} } as any)).not.toThrow()
    }

    // 6th should fail
    expect(() => rateLimitMiddleware({ context: {} } as any)).toThrow()
  })
})
