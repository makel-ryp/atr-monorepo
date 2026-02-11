import { describe, test, expect, vi, beforeEach } from 'vitest'

import requestIdMiddleware from '../../server/middleware/00.requestId'

function getSetResponseHeader() {
  return (globalThis as any).setResponseHeader as ReturnType<typeof vi.fn>
}

describe('requestId middleware', () => {
  beforeEach(() => {
    getSetResponseHeader().mockClear()
  })

  test('sets event.context.requestId', () => {
    const event = { context: {} } as any
    requestIdMiddleware(event)

    expect(event.context.requestId).toBeDefined()
    expect(typeof event.context.requestId).toBe('string')
  })

  test('requestId is a valid UUID format', () => {
    const event = { context: {} } as any
    requestIdMiddleware(event)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(event.context.requestId).toMatch(uuidRegex)
  })

  test('sets X-Request-ID response header', () => {
    const event = { context: {} } as any
    requestIdMiddleware(event)

    expect(getSetResponseHeader()).toHaveBeenCalledWith(event, 'X-Request-ID', event.context.requestId)
  })

  test('generates unique IDs per request', () => {
    const event1 = { context: {} } as any
    const event2 = { context: {} } as any
    requestIdMiddleware(event1)
    requestIdMiddleware(event2)

    expect(event1.context.requestId).not.toBe(event2.context.requestId)
  })
})
