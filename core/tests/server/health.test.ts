import { describe, test, expect, vi, beforeEach } from 'vitest'

// Import the handler — defineEventHandler is stubbed to pass-through
import healthHandler from '../../server/routes/health.get'

function getSetResponseStatus() {
  return (globalThis as any).setResponseStatus as ReturnType<typeof vi.fn>
}

function getSetResponseHeader() {
  return (globalThis as any).setResponseHeader as ReturnType<typeof vi.fn>
}

function getUseRuntimeConfig() {
  return (globalThis as any).useRuntimeConfig as ReturnType<typeof vi.fn>
}

describe('health endpoint', () => {
  const fakeEvent = { method: 'GET', path: '/health' }

  beforeEach(() => {
    getSetResponseStatus().mockClear()
    getSetResponseHeader().mockClear()
    getUseRuntimeConfig().mockClear()
    // Reset to default config
    getUseRuntimeConfig().mockReturnValue({
      apiSecret: '',
      todo: { enabled: true },
      public: {
        apiBase: 'http://localhost:3001/api',
        appVersion: '1.0.0',
        serviceId: 'test-service',
      },
    })
  })

  test('returns IETF health+json structure', async () => {
    const result = await healthHandler(fakeEvent as any)

    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('version')
    expect(result).toHaveProperty('serviceId')
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('checks')
  })

  test('includes uptime and memory checks', async () => {
    const result = await healthHandler(fakeEvent as any)

    expect(result.checks).toHaveProperty('uptime')
    expect(result.checks).toHaveProperty('memory:utilization')
    expect(result.checks.uptime[0].componentType).toBe('system')
    expect(result.checks.uptime[0].observedUnit).toBe('seconds')
    expect(result.checks['memory:utilization'][0].observedUnit).toBe('percent')
  })

  test('status is pass when all checks pass', async () => {
    const result = await healthHandler(fakeEvent as any)
    expect(result.status).toBe('pass')
  })

  test('sets Content-Type to application/health+json', async () => {
    await healthHandler(fakeEvent as any)
    expect(getSetResponseHeader()).toHaveBeenCalledWith(
      fakeEvent,
      'Content-Type',
      'application/health+json',
    )
  })

  test('sets Cache-Control header', async () => {
    await healthHandler(fakeEvent as any)
    expect(getSetResponseHeader()).toHaveBeenCalledWith(
      fakeEvent,
      'Cache-Control',
      'max-age=5',
    )
  })

  test('sets 200 status for pass', async () => {
    await healthHandler(fakeEvent as any)
    expect(getSetResponseStatus()).toHaveBeenCalledWith(fakeEvent, 200)
  })

  test('uses config values for version and serviceId', async () => {
    const result = await healthHandler(fakeEvent as any)
    expect(result.version).toBe('1.0.0')
    expect(result.serviceId).toBe('test-service')
    expect(result.description).toBe('Health of test-service')
  })

  test('falls back to defaults when config values are empty', async () => {
    getUseRuntimeConfig().mockReturnValue({
      public: { appVersion: '', serviceId: '' },
    })
    const result = await healthHandler(fakeEvent as any)
    expect(result.version).toBe('0.0.0')
    expect(result.serviceId).toBe('app-agent')
  })

  test('uptime observedValue is a positive number', async () => {
    const result = await healthHandler(fakeEvent as any)
    expect(result.checks.uptime[0].observedValue).toBeGreaterThan(0)
  })

  test('memory utilization is between 0 and 100', async () => {
    const result = await healthHandler(fakeEvent as any)
    const mem = result.checks['memory:utilization'][0].observedValue
    expect(mem).toBeGreaterThanOrEqual(0)
    expect(mem).toBeLessThanOrEqual(100)
  })
})
