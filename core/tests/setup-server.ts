import { vi } from 'vitest'

// Stub Nitro auto-imports that feature.ts depends on
vi.stubGlobal('defineEventHandler', vi.fn((handler: Function) => handler))
vi.stubGlobal('defineNitroPlugin', vi.fn((plugin: Function) => plugin))
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getQuery', vi.fn())
vi.stubGlobal('getRouterParams', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => new Error(opts.statusMessage || opts.message)))

// Stub response helpers (used by health endpoint, middleware, etc.)
vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({
  apiSecret: '',
  rateLimiter: { enabled: false, tokensPerInterval: 150, interval: 300000 },
  public: {
    apiBase: 'http://localhost:3001/api',
    appVersion: '0.0.0',
    serviceId: 'app-agent',
  },
})))
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('getResponseStatus', vi.fn(() => 200))
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('getRequestIP', vi.fn(() => '127.0.0.1'))

// Stub writeLog (auto-imported from server/utils/logs-db.ts)
vi.stubGlobal('writeLog', vi.fn())

// Stub feature wrappers (auto-imported from server/utils/feature.ts)
vi.stubGlobal('createFeatureScope', (await import('../server/utils/feature')).createFeatureScope)
vi.stubGlobal('defineFeatureHandler', (await import('../server/utils/feature')).defineFeatureHandler)
vi.stubGlobal('defineFeaturePlugin', (await import('../server/utils/feature')).defineFeaturePlugin)

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
