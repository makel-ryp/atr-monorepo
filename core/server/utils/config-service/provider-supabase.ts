// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { ConfigProvider, ConfigLayer, ConfigHistory, ConfigChangeEvent, WriteHistoryInput } from './types'

export class SupabaseConfigProvider implements ConfigProvider {
  private client: SupabaseClient
  private channel: RealtimeChannel | null = null

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  async initialize(): Promise<void> {
    // Verify connection by attempting a simple query
    const { error } = await this.client
      .from('config_layers')
      .select('id')
      .limit(1)
    if (error) {
      const msg = error.message || ''
      // Supabase returns HTML when the project is paused (free tier) or unreachable
      if (msg.includes('<!DOCTYPE') || msg.includes('<html')) {
        throw new Error('Config service: Supabase project appears paused or unreachable. Resume it at https://supabase.com/dashboard')
      }
      throw new Error(`Config service: failed to connect to Supabase — ${msg.slice(0, 200)}`)
    }
  }

  async destroy(): Promise<void> {
    if (this.channel) {
      await this.client.removeChannel(this.channel)
      this.channel = null
    }
  }

  // --- Layer CRUD ---

  async getLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<ConfigLayer | null> {
    const { data, error } = await this.client
      .from('config_layers')
      .select('*')
      .eq('app_id', appId)
      .eq('environment', environment)
      .eq('layer_name', layerName)
      .eq('layer_key', layerKey)
      .maybeSingle()
    if (error) throw new Error(`getLayer: ${error.message}`)
    return data ? this.mapLayer(data) : null
  }

  async getLayersForApp(appId: string, environment: string): Promise<ConfigLayer[]> {
    const { data, error } = await this.client
      .from('config_layers')
      .select('*')
      .or(`app_id.eq.*,app_id.eq.${appId}`)
      .or(`environment.eq.*,environment.eq.${environment}`)
      .order('layer_name')
    if (error) throw new Error(`getLayersForApp: ${error.message}`)
    return (data || []).map(this.mapLayer)
  }

  async getAllLayers(): Promise<ConfigLayer[]> {
    const { data, error } = await this.client
      .from('config_layers')
      .select('*')
      .order('layer_name')
    if (error) throw new Error(`getAllLayers: ${error.message}`)
    return (data || []).map(this.mapLayer)
  }

  async upsertLayer(
    appId: string,
    environment: string,
    layerName: string,
    layerKey: string,
    configData: Record<string, unknown>,
    updatedBy: string,
  ): Promise<ConfigLayer> {
    const now = new Date().toISOString()
    const { data, error } = await this.client
      .from('config_layers')
      .upsert(
        {
          app_id: appId,
          environment,
          layer_name: layerName,
          layer_key: layerKey,
          config_data: configData,
          updated_by: updatedBy,
          updated_at: now,
          created_by: updatedBy,
          created_at: now,
        },
        { onConflict: 'app_id,environment,layer_name,layer_key', ignoreDuplicates: false },
      )
      .select('*')
      .single()
    if (error) throw new Error(`upsertLayer: ${error.message}`)
    return this.mapLayer(data)
  }

  async deleteLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<void> {
    const { error } = await this.client
      .from('config_layers')
      .delete()
      .eq('app_id', appId)
      .eq('environment', environment)
      .eq('layer_name', layerName)
      .eq('layer_key', layerKey)
    if (error) throw new Error(`deleteLayer: ${error.message}`)
  }

  // --- History ---

  async writeHistory(entry: WriteHistoryInput): Promise<void> {
    const { error } = await this.client
      .from('config_history')
      .insert({
        app_id: entry.appId,
        environment: entry.environment,
        layer_name: entry.layerName,
        layer_key: entry.layerKey,
        action: entry.action,
        config_before: entry.configBefore ?? null,
        config_after: entry.configAfter ?? null,
        config_diff: entry.configDiff ?? null,
        changed_by: entry.changedBy,
        change_reason: entry.changeReason ?? null,
        rollback_of: entry.rollbackOf ?? null,
      })
    if (error) throw new Error(`writeHistory: ${error.message}`)
  }

  async getHistory(appId: string, environment: string, layerName: string, layerKey: string, limit: number = 50): Promise<ConfigHistory[]> {
    const { data, error } = await this.client
      .from('config_history')
      .select('*')
      .eq('app_id', appId)
      .eq('environment', environment)
      .eq('layer_name', layerName)
      .eq('layer_key', layerKey)
      .order('changed_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`getHistory: ${error.message}`)
    return (data || []).map(this.mapHistory)
  }

  async getRecentHistory(limit: number = 50): Promise<ConfigHistory[]> {
    const { data, error } = await this.client
      .from('config_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`getRecentHistory: ${error.message}`)
    return (data || []).map(this.mapHistory)
  }

  // --- Realtime ---

  async subscribe(callback: (event: ConfigChangeEvent) => void): Promise<{ unsubscribe: () => void }> {
    this.channel = this.client
      .channel('config-layers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'config_layers' },
        (payload) => {
          callback({
            eventType: payload.eventType as ConfigChangeEvent['eventType'],
            schema: 'public',
            table: 'config_layers',
            new: (payload.new || {}) as Record<string, unknown>,
            old: (payload.old || {}) as Record<string, unknown>,
          })
        },
      )
      .subscribe()

    return {
      unsubscribe: () => {
        if (this.channel) {
          this.client.removeChannel(this.channel)
          this.channel = null
        }
      },
    }
  }

  // --- Mapping helpers ---

  private mapLayer(row: Record<string, unknown>): ConfigLayer {
    return {
      id: row.id as string,
      app_id: row.app_id as string,
      environment: row.environment as string,
      layer_name: row.layer_name as string,
      layer_key: row.layer_key as string,
      config_data: (row.config_data || {}) as Record<string, unknown>,
      schema_version: (row.schema_version || 1) as number,
      created_by: row.created_by as string,
      created_at: row.created_at as string,
      updated_by: row.updated_by as string,
      updated_at: row.updated_at as string,
    }
  }

  private mapHistory(row: Record<string, unknown>): ConfigHistory {
    return {
      id: row.id as string,
      app_id: row.app_id as string,
      environment: row.environment as string,
      layer_name: row.layer_name as string,
      layer_key: row.layer_key as string,
      action: row.action as ConfigHistory['action'],
      config_before: row.config_before as Record<string, unknown> | null,
      config_after: row.config_after as Record<string, unknown> | null,
      config_diff: row.config_diff as Record<string, unknown> | null,
      changed_by: row.changed_by as string,
      changed_at: row.changed_at as string,
      change_reason: row.change_reason as string | null,
      rollback_of: row.rollback_of as string | null,
    }
  }
}
