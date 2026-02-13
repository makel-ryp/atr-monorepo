// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { syncSingleFeatureToDb, syncSingleEdgeToDb } from './feature-registry-db'

interface FeatureRegistration {
  slug: string
  wrapperType: string
  invocationCount: number
  logCount: number
  registeredAt: string
}

interface FeatureEdge {
  from: string
  to: string
  type: 'contains' | 'uses'
}

const features = new Map<string, FeatureRegistration>()
const edges = new Set<string>()
const edgeList: FeatureEdge[] = []

function edgeKey(from: string, to: string, type: string): string {
  return `${from}|${to}|${type}`
}

export function registerFeature(slug: string, wrapperType: string = 'manual'): void {
  if (!import.meta.dev) return
  if (features.has(slug)) return
  features.set(slug, {
    slug,
    wrapperType,
    invocationCount: 0,
    logCount: 0,
    registeredAt: new Date().toISOString(),
  })
  // Write-through: persist immediately so data survives crashes
  syncSingleFeatureToDb(slug, wrapperType)
}

export function recordEdge(from: string, to: string, type: 'contains' | 'uses'): void {
  if (!import.meta.dev) return
  const key = edgeKey(from, to, type)
  if (edges.has(key)) return
  edges.add(key)
  edgeList.push({ from, to, type })
  // Write-through: persist immediately so data survives crashes
  syncSingleEdgeToDb(from, to, type)
}

export function getCounts(): { slug: string, invocationCount: number, logCount: number }[] {
  return Array.from(features.values()).map(f => ({
    slug: f.slug,
    invocationCount: f.invocationCount,
    logCount: f.logCount,
  }))
}

export function incrementInvocations(slug: string): void {
  if (!import.meta.dev) return
  const reg = features.get(slug)
  if (reg) reg.invocationCount++
}

export function incrementLogCount(slug: string): void {
  if (!import.meta.dev) return
  const reg = features.get(slug)
  if (reg) reg.logCount++
}

export function getRegistry(): { features: FeatureRegistration[], edges: FeatureEdge[] } {
  return {
    features: Array.from(features.values()),
    edges: [...edgeList],
  }
}

export function clearRegistry(): void {
  features.clear()
  edges.clear()
  edgeList.length = 0
}
