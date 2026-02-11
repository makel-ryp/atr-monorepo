// CONTEXT: runtime-config — ConfigStore singleton with in-memory cache (ADR-005 Part 6)
import type { ConfigProvider, ConfigLayer, ConfigHistory, MergeResult, WriteHistoryInput, LayerResolutionContext } from './types'
import { mergeWithGovernance, computeConfigDiff } from './merge'
import { setNestedValue, deleteNestedValue } from './paths'

let _store: ConfigStore | null = null

/**
 * Get the global ConfigStore singleton.
 * Returns null if no provider is configured.
 */
export function getConfigStore(): ConfigStore | null {
  return _store
}

/**
 * Initialize the global ConfigStore with a provider.
 * Called once by the settings-loader Nitro plugin.
 */
export function initConfigStore(provider: ConfigProvider): ConfigStore {
  _store = new ConfigStore(provider)
  return _store
}

export class ConfigStore {
  private provider: ConfigProvider
  private layerCache: Map<string, ConfigLayer[]> = new Map()
  private mergeCache: Map<string, MergeResult> = new Map()

  constructor(provider: ConfigProvider) {
    this.provider = provider
  }

  /**
   * Invalidate all caches. Called on Realtime notification.
   */
  invalidate(): void {
    this.layerCache.clear()
    this.mergeCache.clear()
  }

  /**
   * Get all config layers for an app + environment (cached).
   * Fetches rows where (app_id='*' OR app_id=appId) AND (environment='*' OR environment=env).
   */
  async getLayersForApp(appId: string, environment: string): Promise<ConfigLayer[]> {
    const cacheKey = `${appId}:${environment}`
    const cached = this.layerCache.get(cacheKey)
    if (cached) return cached

    const layers = await this.provider.getLayersForApp(appId, environment)
    this.layerCache.set(cacheKey, layers)
    return layers
  }

  /**
   * Get a single layer by its 4-tuple key.
   */
  async getLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<ConfigLayer | null> {
    return this.provider.getLayer(appId, environment, layerName, layerKey)
  }

  /**
   * Get the effective merged config for a given app + environment + context.
   *
   * Layer resolution:
   * 1. Fetch all layers for this app + environment (includes wildcard rows)
   * 2. Read core:app row's $meta.layers to discover custom chain
   * 3. Build full chain: ['core', 'core:org', 'core:app', ...customLayers, 'user']
   * 4. For each position, find matching row
   * 5. Pass ordered array to mergeWithGovernance()
   */
  async getEffectiveConfig(
    appId: string,
    environment: string,
    context?: LayerResolutionContext,
  ): Promise<MergeResult> {
    const cacheKey = buildCacheKey(appId, environment, context)
    const cached = this.mergeCache.get(cacheKey)
    if (cached) return cached

    const allLayers = await this.getLayersForApp(appId, environment)

    // Discover custom layers from core:app's $meta.layers
    const appLayer = allLayers.find(l => l.layer_name === 'core:app' && l.app_id === appId)
    const appMeta = appLayer?.config_data?.$meta as Record<string, unknown> | undefined
    const customLayerNames = (appMeta?.layers as string[]) || []

    // Build full merge chain
    const chain = ['core', 'core:org', 'core:app', ...customLayerNames, 'user']

    // Resolve each position to a layer row
    const resolved: ConfigLayer[] = []
    for (const layerName of chain) {
      const match = resolveLayer(allLayers, appId, layerName, context)
      if (match) resolved.push(match)
    }

    const result = mergeWithGovernance(resolved)
    this.mergeCache.set(cacheKey, result)
    return result
  }

  /**
   * Update a setting within a layer.
   * Uses dot-notation path to set a value within the layer's config_data.
   * Creates the layer if it doesn't exist.
   */
  async updateSetting(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    path: string,
    value: unknown,
    changedBy: string,
    changeReason?: string,
  ): Promise<void> {
    const existing = await this.provider.getLayer(appId, environment, layerName, layerKey)
    const oldConfig = existing?.config_data ? JSON.parse(JSON.stringify(existing.config_data)) : {}
    const newConfig = JSON.parse(JSON.stringify(oldConfig))

    setNestedValue(newConfig, path, value)

    await this.provider.upsertLayer(appId, environment, layerName, layerKey, newConfig, changedBy)

    // Write audit trail
    const diff = computeConfigDiff(oldConfig, newConfig)
    await this.provider.writeHistory({
      appId,
      environment,
      layerName,
      layerKey,
      action: existing ? 'update' : 'create',
      configBefore: oldConfig,
      configAfter: newConfig,
      configDiff: diff as Record<string, unknown>,
      changedBy,
      changeReason,
    })

    this.invalidate()
  }

  /**
   * Replace an entire layer's config_data.
   */
  async replaceLayer(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    configData: Record<string, unknown>,
    changedBy: string,
    changeReason?: string,
  ): Promise<void> {
    const existing = await this.provider.getLayer(appId, environment, layerName, layerKey)
    const oldConfig = existing?.config_data || {}

    await this.provider.upsertLayer(appId, environment, layerName, layerKey, configData, changedBy)

    const diff = computeConfigDiff(oldConfig, configData)
    await this.provider.writeHistory({
      appId,
      environment,
      layerName,
      layerKey,
      action: existing ? 'update' : 'create',
      configBefore: oldConfig,
      configAfter: configData,
      configDiff: diff as Record<string, unknown>,
      changedBy,
      changeReason,
    })

    this.invalidate()
  }

  /**
   * Delete a setting (remove a key from a layer's config_data).
   */
  async deleteSetting(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    path: string,
    changedBy: string,
    changeReason?: string,
  ): Promise<boolean> {
    const existing = await this.provider.getLayer(appId, environment, layerName, layerKey)
    if (!existing) return false

    const oldConfig = JSON.parse(JSON.stringify(existing.config_data))
    const newConfig = JSON.parse(JSON.stringify(oldConfig))
    const deleted = deleteNestedValue(newConfig, path)

    if (!deleted) return false

    await this.provider.upsertLayer(appId, environment, layerName, layerKey, newConfig, changedBy)

    const diff = computeConfigDiff(oldConfig, newConfig)
    await this.provider.writeHistory({
      appId,
      environment,
      layerName,
      layerKey,
      action: 'update',
      configBefore: oldConfig,
      configAfter: newConfig,
      configDiff: diff as Record<string, unknown>,
      changedBy,
      changeReason,
    })

    this.invalidate()
    return true
  }

  /**
   * Delete an entire layer.
   */
  async deleteEntireLayer(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    changedBy: string,
    changeReason?: string,
  ): Promise<void> {
    const existing = await this.provider.getLayer(appId, environment, layerName, layerKey)
    if (!existing) return

    await this.provider.deleteLayer(appId, environment, layerName, layerKey)

    await this.provider.writeHistory({
      appId,
      environment,
      layerName,
      layerKey,
      action: 'delete',
      configBefore: existing.config_data,
      configAfter: null,
      changedBy,
      changeReason,
    })

    this.invalidate()
  }

  /**
   * Get audit history for a layer.
   */
  async getHistory(appId: string, environment: string, layerName: string, layerKey: string, limit?: number): Promise<ConfigHistory[]> {
    return this.provider.getHistory(appId, environment, layerName, layerKey, limit)
  }

  /**
   * Get recent audit history across all layers.
   */
  async getRecentHistory(limit?: number): Promise<ConfigHistory[]> {
    return this.provider.getRecentHistory(limit)
  }

  /**
   * Get stats about the config service.
   */
  async getStats(): Promise<{
    totalLayers: number
    layerNames: Record<string, number>
    cachedMerges: number
  }> {
    const layers = await this.provider.getAllLayers()
    const layerNames: Record<string, number> = {}
    for (const layer of layers) {
      layerNames[layer.layer_name] = (layerNames[layer.layer_name] || 0) + 1
    }
    return {
      totalLayers: layers.length,
      layerNames,
      cachedMerges: this.mergeCache.size,
    }
  }

  /**
   * Subscribe to config changes via the provider's Realtime.
   */
  async subscribe(callback: (event: import('./types').ConfigChangeEvent) => void) {
    return this.provider.subscribe(callback)
  }

  /**
   * Lifecycle: initialize the underlying provider.
   */
  async initialize(): Promise<void> {
    return this.provider.initialize()
  }

  /**
   * Lifecycle: destroy the underlying provider.
   */
  async destroy(): Promise<void> {
    return this.provider.destroy()
  }
}

/**
 * Resolve a single layer name to a matching row from the fetched layers.
 */
function resolveLayer(
  allLayers: ConfigLayer[],
  appId: string,
  layerName: string,
  context?: LayerResolutionContext,
): ConfigLayer | undefined {
  if (layerName === 'core' || layerName === 'core:org') {
    // Core layers: app_id='*', layer_key='default'
    return allLayers.find(l =>
      l.layer_name === layerName && l.app_id === '*' && l.layer_key === 'default',
    )
  }
  if (layerName === 'core:app') {
    // App-scoped: app_id=appId
    return allLayers.find(l =>
      l.layer_name === 'core:app' && l.app_id === appId,
    )
  }
  if (layerName === 'user') {
    // User layer: app_id=appId, layer_key='{appId}/{userId}'
    const userId = context?.userId
    if (!userId) return undefined
    const userKey = `${appId}/${userId}`
    return allLayers.find(l =>
      l.layer_name === 'user' && l.app_id === appId && l.layer_key === userKey,
    )
  }
  // Custom layers: app_id=appId, layer_key=context[layerName]
  const key = context?.[layerName]
  if (!key) return undefined
  return allLayers.find(l =>
    l.layer_name === layerName && l.app_id === appId && l.layer_key === key,
  )
}

/**
 * Build a deterministic cache key from app, environment, and context.
 */
function buildCacheKey(
  appId: string,
  environment: string,
  context?: LayerResolutionContext,
): string {
  if (!context || Object.keys(context).length === 0) {
    return `${appId}:${environment}:_`
  }
  const pairs = Object.entries(context)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
  return `${appId}:${environment}:${pairs}`
}
