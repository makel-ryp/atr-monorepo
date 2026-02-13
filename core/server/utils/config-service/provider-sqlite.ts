// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type { ConfigProvider, ConfigLayer, ConfigHistory, ConfigChangeEvent, WriteHistoryInput } from './types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config_layers (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  layer_name TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  config_data TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id, environment, layer_name, layer_key)
);

CREATE TABLE IF NOT EXISTS config_history (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  layer_name TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'rollback')),
  config_before TEXT,
  config_after TEXT,
  config_diff TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  change_reason TEXT,
  rollback_of TEXT
);
`

export class SqliteConfigProvider implements ConfigProvider {
  private db: InstanceType<typeof Database> | null = null
  private dbPath: string

  // Prepared statements (created in initialize)
  private stmts!: {
    getLayer: InstanceType<typeof Database.prototype.Statement>
    getLayersForApp: InstanceType<typeof Database.prototype.Statement>
    getAllLayers: InstanceType<typeof Database.prototype.Statement>
    deleteLayer: InstanceType<typeof Database.prototype.Statement>
    insertLayer: InstanceType<typeof Database.prototype.Statement>
    updateLayer: InstanceType<typeof Database.prototype.Statement>
    insertHistory: InstanceType<typeof Database.prototype.Statement>
    getHistory: InstanceType<typeof Database.prototype.Statement>
    getRecentHistory: InstanceType<typeof Database.prototype.Statement>
  }

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? join(getProjectRoot(), 'settings.db')
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
    this.prepareStatements()
  }

  async destroy(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  // --- Layer CRUD ---

  async getLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<ConfigLayer | null> {
    const row = this.stmts.getLayer.get(appId, environment, layerName, layerKey) as Record<string, unknown> | undefined
    return row ? this.mapLayer(row) : null
  }

  async getLayersForApp(appId: string, environment: string): Promise<ConfigLayer[]> {
    const rows = this.stmts.getLayersForApp.all(appId, environment) as Record<string, unknown>[]
    return rows.map(row => this.mapLayer(row))
  }

  async getAllLayers(): Promise<ConfigLayer[]> {
    const rows = this.stmts.getAllLayers.all() as Record<string, unknown>[]
    return rows.map(row => this.mapLayer(row))
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
    const json = JSON.stringify(configData)

    const upsert = this.db!.transaction(() => {
      const existing = this.stmts.getLayer.get(appId, environment, layerName, layerKey) as Record<string, unknown> | undefined
      if (existing) {
        this.stmts.updateLayer.run(json, updatedBy, now, appId, environment, layerName, layerKey)
      }
      else {
        const id = randomUUID()
        this.stmts.insertLayer.run(id, appId, environment, layerName, layerKey, json, 1, updatedBy, now, updatedBy, now)
      }
      return this.stmts.getLayer.get(appId, environment, layerName, layerKey) as Record<string, unknown>
    })

    return this.mapLayer(upsert())
  }

  async deleteLayer(appId: string, environment: string, layerName: string, layerKey: string): Promise<void> {
    this.stmts.deleteLayer.run(appId, environment, layerName, layerKey)
  }

  // --- History ---

  async writeHistory(entry: WriteHistoryInput): Promise<void> {
    this.stmts.insertHistory.run(
      randomUUID(),
      entry.appId,
      entry.environment,
      entry.layerName,
      entry.layerKey,
      entry.action,
      entry.configBefore ? JSON.stringify(entry.configBefore) : null,
      entry.configAfter ? JSON.stringify(entry.configAfter) : null,
      entry.configDiff ? JSON.stringify(entry.configDiff) : null,
      entry.changedBy,
      new Date().toISOString(),
      entry.changeReason ?? null,
      entry.rollbackOf ?? null,
    )
  }

  async getHistory(appId: string, environment: string, layerName: string, layerKey: string, limit: number = 50): Promise<ConfigHistory[]> {
    const rows = this.stmts.getHistory.all(appId, environment, layerName, layerKey, limit) as Record<string, unknown>[]
    return rows.map(row => this.mapHistory(row))
  }

  async getRecentHistory(limit: number = 50): Promise<ConfigHistory[]> {
    const rows = this.stmts.getRecentHistory.all(limit) as Record<string, unknown>[]
    return rows.map(row => this.mapHistory(row))
  }

  // --- Realtime (no-op for SQLite) ---

  async subscribe(_callback: (event: ConfigChangeEvent) => void): Promise<{ unsubscribe: () => void }> {
    return { unsubscribe: () => {} }
  }

  // --- Internal ---

  private prepareStatements(): void {
    const db = this.db!

    this.stmts = {
      getLayer: db.prepare(`
        SELECT * FROM config_layers
        WHERE app_id = ? AND environment = ? AND layer_name = ? AND layer_key = ?
      `),

      getLayersForApp: db.prepare(`
        SELECT * FROM config_layers
        WHERE (app_id = '*' OR app_id = ?)
          AND (environment = '*' OR environment = ?)
        ORDER BY layer_name
      `),

      getAllLayers: db.prepare(`
        SELECT * FROM config_layers ORDER BY layer_name
      `),

      deleteLayer: db.prepare(`
        DELETE FROM config_layers
        WHERE app_id = ? AND environment = ? AND layer_name = ? AND layer_key = ?
      `),

      insertLayer: db.prepare(`
        INSERT INTO config_layers (id, app_id, environment, layer_name, layer_key, config_data, schema_version, created_by, created_at, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      updateLayer: db.prepare(`
        UPDATE config_layers SET config_data = ?, updated_by = ?, updated_at = ?
        WHERE app_id = ? AND environment = ? AND layer_name = ? AND layer_key = ?
      `),

      insertHistory: db.prepare(`
        INSERT INTO config_history (id, app_id, environment, layer_name, layer_key, action, config_before, config_after, config_diff, changed_by, changed_at, change_reason, rollback_of)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getHistory: db.prepare(`
        SELECT * FROM config_history
        WHERE app_id = ? AND environment = ? AND layer_name = ? AND layer_key = ?
        ORDER BY changed_at DESC
        LIMIT ?
      `),

      getRecentHistory: db.prepare(`
        SELECT * FROM config_history
        ORDER BY changed_at DESC
        LIMIT ?
      `),
    }
  }

  private mapLayer(row: Record<string, unknown>): ConfigLayer {
    return {
      id: row.id as string,
      app_id: row.app_id as string,
      environment: row.environment as string,
      layer_name: row.layer_name as string,
      layer_key: row.layer_key as string,
      config_data: JSON.parse(row.config_data as string || '{}'),
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
      config_before: row.config_before ? JSON.parse(row.config_before as string) : null,
      config_after: row.config_after ? JSON.parse(row.config_after as string) : null,
      config_diff: row.config_diff ? JSON.parse(row.config_diff as string) : null,
      changed_by: row.changed_by as string,
      changed_at: row.changed_at as string,
      change_reason: row.change_reason as string | null,
      rollback_of: row.rollback_of as string | null,
    }
  }
}
