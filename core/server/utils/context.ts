// CONTEXT: context-oracle — Server-side runtime context wrapper
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { NitroApp } from 'nitropack/types'

export interface ContextScope {
  slug: string
  log: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  meta: Record<string, any>
}

function formatData(data: any[]): string | undefined {
  if (data.length === 0) return undefined
  if (data.length === 1) {
    try { return JSON.stringify(data[0]) }
    catch { return String(data[0]) }
  }
  try { return JSON.stringify(data) }
  catch { return data.map(String).join(' ') }
}

export function createContextScope(slug: string): ContextScope {
  const prefix = `[${slug}]`

  return {
    slug,
    meta: {},

    log(message: string, ...data: any[]) {
      if (import.meta.dev) {
        writeLog(slug, 'log', message, formatData(data))
      }
      if (data.length > 0) {
        console.log(prefix, message, ...data)
      }
      else {
        console.log(prefix, message)
      }
    },

    warn(message: string, ...data: any[]) {
      if (import.meta.dev) {
        writeLog(slug, 'warn', message, formatData(data))
      }
      if (data.length > 0) {
        console.warn(prefix, message, ...data)
      }
      else {
        console.warn(prefix, message)
      }
    },

    error(message: string, ...data: any[]) {
      if (import.meta.dev) {
        writeLog(slug, 'error', message, formatData(data))
      }
      if (data.length > 0) {
        console.error(prefix, message, ...data)
      }
      else {
        console.error(prefix, message)
      }
    },
  }
}

export function defineContextHandler<T extends EventHandlerRequest = EventHandlerRequest, D = unknown>(
  slug: string,
  handler: (ctx: ContextScope, event: H3Event<T>) => D | Promise<D>
): EventHandler<T, D> {
  const ctx = createContextScope(slug)
  return defineEventHandler<T, D>((event) => handler(ctx, event))
}

export function defineContextPlugin(
  slug: string,
  plugin: (ctx: ContextScope, nitroApp: NitroApp) => void | Promise<void>
): (nitroApp: NitroApp) => void | Promise<void> {
  const ctx = createContextScope(slug)
  return defineNitroPlugin((nitroApp) => plugin(ctx, nitroApp))
}
