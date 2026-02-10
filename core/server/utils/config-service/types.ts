// CONTEXT: runtime-config — Type definitions for the runtime configuration service (ADR-005)

export interface ConfigLayer {
  id: string
  app_id: string        // '*' = core layers, 'docs' = app-scoped
  environment: string   // 'development', 'staging', 'production', 'pr-123', '*'
  layer_name: string    // freeform: 'core', 'core:org', 'core:app', 'domain', 'user', etc.
  layer_key: string     // entity key: 'default', 'foo.com', 'docs/user123'
  config_data: Record<string, unknown>
  schema_version: number
  created_by: string
  created_at: string
  updated_by: string
  updated_at: string
}

export interface ConfigHistory {
  id: string
  app_id: string
  environment: string
  layer_name: string
  layer_key: string
  action: 'create' | 'update' | 'delete' | 'rollback'
  config_before: Record<string, unknown> | null
  config_after: Record<string, unknown> | null
  config_diff: Record<string, unknown> | null
  changed_by: string
  changed_at: string
  change_reason: string | null
  rollback_of: string | null
}

export interface ConfigChangeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export interface WriteHistoryInput {
  appId: string
  environment: string
  layerName: string
  layerKey: string
  action: 'create' | 'update' | 'delete' | 'rollback'
  configBefore?: Record<string, unknown> | null
  configAfter?: Record<string, unknown> | null
  configDiff?: Record<string, unknown> | null
  changedBy: string
  changeReason?: string
  rollbackOf?: string
}

/**
 * Abstract provider interface for config storage and realtime notifications.
 * Implementations: SupabaseConfigProvider (Supabase Realtime),
 * future: RawPgProvider (PG NOTIFY), NeonProvider, etc.
 */
export interface ConfigProvider {
  // Layer CRUD
  getLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<ConfigLayer | null>
  getLayersForApp(appId: string, environment: string): Promise<ConfigLayer[]>
  getAllLayers(): Promise<ConfigLayer[]>
  upsertLayer(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    configData: Record<string, unknown>,
    updatedBy: string,
  ): Promise<ConfigLayer>
  deleteLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<void>

  // History
  writeHistory(entry: WriteHistoryInput): Promise<void>
  getHistory(appId: string, environment: string, layerName: string, layerKey: string, limit?: number): Promise<ConfigHistory[]>
  getRecentHistory(limit?: number): Promise<ConfigHistory[]>

  // Realtime subscription
  subscribe(callback: (event: ConfigChangeEvent) => void): Promise<{ unsubscribe: () => void }>

  // Lifecycle
  initialize(): Promise<void>
  destroy(): Promise<void>
}

export const CORE_LAYERS = ['core', 'core:org', 'core:app'] as const
export type CoreLayerName = typeof CORE_LAYERS[number]
export type MergeOrder = string[]

export interface MergeResult {
  config: Record<string, unknown>
  lockedPaths: Set<string>
}

export interface LayerResolutionContext {
  userId?: string
  [layerName: string]: string | undefined
}
