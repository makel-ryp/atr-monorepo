import { vi } from 'vitest'

// Stub Nitro auto-imports that context.ts depends on
vi.stubGlobal('defineEventHandler', vi.fn((handler: Function) => handler))
vi.stubGlobal('defineNitroPlugin', vi.fn((plugin: Function) => plugin))
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getQuery', vi.fn())
vi.stubGlobal('getRouterParams', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => new Error(opts.statusMessage || opts.message)))

// Stub writeLog (auto-imported from server/utils/logs-db.ts)
vi.stubGlobal('writeLog', vi.fn())
