import { describe, test, expect, vi, beforeEach } from 'vitest'

import loggingMiddleware from '../../server/middleware/02.logging'

describe('logging middleware', () => {
  test('attaches log context to event.context', () => {
    const event = { context: { requestId: 'test-123' } } as any
    loggingMiddleware(event)

    expect(event.context.log).toBeDefined()
    expect(event.context.log.requestId).toBe('test-123')
    expect(typeof event.context.log.startTime).toBe('number')
  })

  test('startTime is close to current time', () => {
    const before = Date.now()
    const event = { context: { requestId: 'test-456' } } as any
    loggingMiddleware(event)
    const after = Date.now()

    expect(event.context.log.startTime).toBeGreaterThanOrEqual(before)
    expect(event.context.log.startTime).toBeLessThanOrEqual(after)
  })

  test('works when requestId is undefined', () => {
    const event = { context: {} } as any
    loggingMiddleware(event)

    expect(event.context.log).toBeDefined()
    expect(event.context.log.requestId).toBeUndefined()
    expect(typeof event.context.log.startTime).toBe('number')
  })
})
