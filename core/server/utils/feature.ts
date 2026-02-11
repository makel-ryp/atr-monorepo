// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { NitroApp } from 'nitropack/types'

export interface FeatureScope {
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

export function createFeatureScope(slug: string): FeatureScope {
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

export function defineFeatureHandler<T extends EventHandlerRequest = EventHandlerRequest, D = unknown>(
  slug: string,
  handler: (feat: FeatureScope, event: H3Event<T>) => D | Promise<D>
): EventHandler<T, D> {
  const feat = createFeatureScope(slug)
  return defineEventHandler<T, D>((event) => handler(feat, event))
}

export function defineFeaturePlugin(
  slug: string,
  plugin: (feat: FeatureScope, nitroApp: NitroApp) => void | Promise<void>
): (nitroApp: NitroApp) => void | Promise<void> {
  const feat = createFeatureScope(slug)
  return defineNitroPlugin((nitroApp) => plugin(feat, nitroApp))
}
