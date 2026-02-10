import { describe, test, expect, vi, beforeEach } from 'vitest'

// Import the handler — defineEventHandler is stubbed to pass-through
import todoMiddleware from '../../server/middleware/00.todo'

function getUseRuntimeConfig() {
  return (globalThis as any).useRuntimeConfig as ReturnType<typeof vi.fn>
}

describe('todo middleware', () => {
  beforeEach(() => {
    getUseRuntimeConfig().mockClear()
    getUseRuntimeConfig().mockReturnValue({
      todo: { enabled: true },
    })
  })

  test('injects todo into event.context', () => {
    const event = { context: {} } as any
    todoMiddleware(event)

    expect(event.context.todo).toBeDefined()
    expect(event.context.todo.injectedBy).toBe('core')
    expect(Array.isArray(event.context.todo.items)).toBe(true)
  })

  test('todo items have correct shape', () => {
    const event = { context: {} } as any
    todoMiddleware(event)

    for (const item of event.context.todo.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('text')
      expect(item).toHaveProperty('done')
      expect(typeof item.id).toBe('number')
      expect(typeof item.text).toBe('string')
      expect(typeof item.done).toBe('boolean')
    }
  })

  test('includes timestamp', () => {
    const event = { context: {} } as any
    todoMiddleware(event)

    expect(event.context.todo.timestamp).toBeDefined()
    // Should be a valid ISO date string
    expect(new Date(event.context.todo.timestamp).toISOString()).toBe(event.context.todo.timestamp)
  })

  test('skips injection when todo.enabled is false', () => {
    getUseRuntimeConfig().mockReturnValue({
      todo: { enabled: false },
    })

    const event = { context: {} } as any
    todoMiddleware(event)

    expect(event.context.todo).toBeUndefined()
  })

  test('injects when config has no todo key (defaults to enabled)', () => {
    getUseRuntimeConfig().mockReturnValue({})

    const event = { context: {} } as any
    todoMiddleware(event)

    expect(event.context.todo).toBeDefined()
  })
})
