import { vi } from 'vitest'

// Stub Nitro auto-imports that context.ts depends on
vi.stubGlobal('defineEventHandler', vi.fn((handler: Function) => handler))
vi.stubGlobal('defineNitroPlugin', vi.fn((plugin: Function) => plugin))
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getQuery', vi.fn())
vi.stubGlobal('getRouterParams', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => new Error(opts.statusMessage || opts.message)))

// Stub response helpers (used by health endpoint, middleware, etc.)
vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({
  apiSecret: '',
  todo: { enabled: true },
  public: {
    apiBase: 'http://localhost:3001/api',
    appVersion: '0.0.0',
    serviceId: 'app-agent',
  },
})))
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('getRouterParam', vi.fn())

// Stub writeLog (auto-imported from server/utils/logs-db.ts)
vi.stubGlobal('writeLog', vi.fn())

// Stub config-service auto-imports
vi.stubGlobal('getConfigStore', vi.fn(() => null))
vi.stubGlobal('initConfigStore', vi.fn())
vi.stubGlobal('createConfigProvider', vi.fn(() => null))
vi.stubGlobal('getNestedValue', (await import('../server/utils/config-service/paths')).getNestedValue)
vi.stubGlobal('setNestedValue', (await import('../server/utils/config-service/paths')).setNestedValue)
vi.stubGlobal('deleteNestedValue', (await import('../server/utils/config-service/paths')).deleteNestedValue)
vi.stubGlobal('flattenConfig', (await import('../server/utils/config-service/paths')).flattenConfig)
vi.stubGlobal('unflattenConfig', (await import('../server/utils/config-service/paths')).unflattenConfig)
vi.stubGlobal('configDeepMerge', (await import('../server/utils/config-service/merge')).configDeepMerge)
vi.stubGlobal('mergeWithGovernance', (await import('../server/utils/config-service/merge')).mergeWithGovernance)
vi.stubGlobal('computeConfigDiff', (await import('../server/utils/config-service/merge')).computeConfigDiff)
