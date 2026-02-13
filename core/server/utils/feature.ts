// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { NitroApp } from 'nitropack/types'

export interface FeatureScope {
  slug: string
  log: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  meta: Record<string, any>
  feature: <T>(childSlug: string, fn: (feat: FeatureScope) => T) => T
  getFeature: (otherSlug: string) => FeatureScope
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
  const featureCache = new Map<string, FeatureScope>()

  const scope: FeatureScope = {
    slug,
    meta: {},

    log(message: string, ...data: any[]) {
      if (import.meta.dev) {
        writeLog(slug, 'log', message, formatData(data))
        incrementLogCount(slug)
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
        incrementLogCount(slug)
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
        incrementLogCount(slug)
      }
      if (data.length > 0) {
        console.error(prefix, message, ...data)
      }
      else {
        console.error(prefix, message)
      }
    },

    feature<T>(childSlug: string, fn: (feat: FeatureScope) => T): T {
      if (import.meta.dev) {
        registerFeature(childSlug, 'nested')
        recordEdge(slug, childSlug, 'contains')
      }
      const childScope = createFeatureScope(childSlug)
      return fn(childScope)
    },

    getFeature(otherSlug: string): FeatureScope {
      if (import.meta.dev) {
        registerFeature(otherSlug, 'dependency')
        recordEdge(slug, otherSlug, 'uses')
      }
      let cached = featureCache.get(otherSlug)
      if (!cached) {
        cached = createFeatureScope(otherSlug)
        featureCache.set(otherSlug, cached)
      }
      return cached
    },
  }

  return scope
}

export function defineFeatureHandler<T extends EventHandlerRequest = EventHandlerRequest, D = unknown>(
  slug: string,
  handler: (feat: FeatureScope, event: H3Event<T>) => D | Promise<D>
): EventHandler<T, D> {
  const feat = createFeatureScope(slug)
  if (import.meta.dev) {
    registerFeature(slug, 'handler')
  }
  return defineEventHandler<T, D>((event) => {
    if (import.meta.dev) {
      incrementInvocations(slug)
    }
    return handler(feat, event)
  })
}

export function defineFeaturePlugin(
  slug: string,
  plugin: (feat: FeatureScope, nitroApp: NitroApp) => void | Promise<void>
): (nitroApp: NitroApp) => void | Promise<void> {
  const feat = createFeatureScope(slug)
  if (import.meta.dev) {
    registerFeature(slug, 'plugin')
  }
  return defineNitroPlugin((nitroApp) => {
    if (import.meta.dev) {
      incrementInvocations(slug)
    }
    return plugin(feat, nitroApp)
  })
}
