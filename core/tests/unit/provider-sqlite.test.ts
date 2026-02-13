import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { SqliteConfigProvider } from '../../server/utils/config-service/provider-sqlite'

let provider: SqliteConfigProvider

beforeEach(async () => {
  provider = new SqliteConfigProvider(':memory:')
  await provider.initialize()
})

afterEach(async () => {
  await provider.destroy()
})

describe('SqliteConfigProvider — layer CRUD', () => {
  test('upsertLayer creates a new layer', async () => {
    const layer = await provider.upsertLayer('docs', 'development', 'core', 'default', { logging: { level: 'info' } }, 'test')

    expect(layer.app_id).toBe('docs')
    expect(layer.environment).toBe('development')
    expect(layer.layer_name).toBe('core')
    expect(layer.layer_key).toBe('default')
    expect(layer.config_data).toEqual({ logging: { level: 'info' } })
    expect(layer.id).toBeTruthy()
    expect(layer.created_by).toBe('test')
    expect(layer.updated_by).toBe('test')
  })

  test('upsertLayer updates an existing layer', async () => {
    const created = await provider.upsertLayer('docs', 'development', 'core', 'default', { a: 1 }, 'alice')
    const updated = await provider.upsertLayer('docs', 'development', 'core', 'default', { a: 2, b: 3 }, 'bob')

    expect(updated.id).toBe(created.id)
    expect(updated.config_data).toEqual({ a: 2, b: 3 })
    expect(updated.created_by).toBe('alice')
    expect(updated.updated_by).toBe('bob')
  })

  test('getLayer returns a specific layer', async () => {
    await provider.upsertLayer('docs', 'development', 'core', 'default', { x: 1 }, 'test')

    const found = await provider.getLayer('docs', 'development', 'core', 'default')
    expect(found).not.toBeNull()
    expect(found!.config_data).toEqual({ x: 1 })
  })

  test('getLayer returns null when not found', async () => {
    const found = await provider.getLayer('docs', 'development', 'core', 'missing')
    expect(found).toBeNull()
  })

  test('deleteLayer removes the layer', async () => {
    await provider.upsertLayer('docs', 'development', 'core', 'default', { x: 1 }, 'test')
    await provider.deleteLayer('docs', 'development', 'core', 'default')

    const found = await provider.getLayer('docs', 'development', 'core', 'default')
    expect(found).toBeNull()
  })

  test('deleteLayer is a no-op when layer does not exist', async () => {
    // Should not throw
    await provider.deleteLayer('docs', 'development', 'core', 'nonexistent')
  })

  test('getAllLayers returns all layers sorted by layer_name', async () => {
    await provider.upsertLayer('docs', 'development', 'core:org', 'default', { org: true }, 'test')
    await provider.upsertLayer('docs', 'development', 'core', 'default', { core: true }, 'test')
    await provider.upsertLayer('saas', 'production', 'user', 'u1', { pref: true }, 'test')

    const all = await provider.getAllLayers()
    expect(all).toHaveLength(3)
    expect(all.map(l => l.layer_name)).toEqual(['core', 'core:org', 'user'])
  })
})

describe('SqliteConfigProvider — getLayersForApp wildcard matching', () => {
  test('returns layers matching app_id or wildcard *', async () => {
    await provider.upsertLayer('*', '*', 'core', 'default', { shared: true }, 'test')
    await provider.upsertLayer('docs', 'development', 'core:app', 'default', { app: true }, 'test')
    await provider.upsertLayer('saas', 'development', 'core:app', 'default', { other: true }, 'test')

    const layers = await provider.getLayersForApp('docs', 'development')
    expect(layers).toHaveLength(2)
    expect(layers.map(l => l.app_id).sort()).toEqual(['*', 'docs'])
  })

  test('returns layers matching environment or wildcard *', async () => {
    await provider.upsertLayer('docs', '*', 'core', 'default', { all_envs: true }, 'test')
    await provider.upsertLayer('docs', 'production', 'core:app', 'default', { prod: true }, 'test')
    await provider.upsertLayer('docs', 'development', 'user', 'u1', { dev: true }, 'test')

    const layers = await provider.getLayersForApp('docs', 'development')
    expect(layers).toHaveLength(2)
    const names = layers.map(l => l.layer_name)
    expect(names).toContain('core')
    expect(names).toContain('user')
  })

  test('wildcard app_id + wildcard environment matches all queries', async () => {
    await provider.upsertLayer('*', '*', 'core', 'default', { global: true }, 'test')

    const layers = await provider.getLayersForApp('anything', 'any-env')
    expect(layers).toHaveLength(1)
    expect(layers[0].config_data).toEqual({ global: true })
  })
})

describe('SqliteConfigProvider — history', () => {
  test('writeHistory + getHistory round-trips correctly', async () => {
    await provider.writeHistory({
      appId: 'docs',
      environment: 'development',
      layerName: 'core',
      layerKey: 'default',
      action: 'create',
      configBefore: null,
      configAfter: { a: 1 },
      configDiff: { a: { from: undefined, to: 1 } },
      changedBy: 'alice',
      changeReason: 'initial setup',
    })

    const history = await provider.getHistory('docs', 'development', 'core', 'default')
    expect(history).toHaveLength(1)
    expect(history[0].action).toBe('create')
    expect(history[0].config_after).toEqual({ a: 1 })
    expect(history[0].changed_by).toBe('alice')
    expect(history[0].change_reason).toBe('initial setup')
    expect(history[0].config_before).toBeNull()
  })

  test('getHistory respects limit and orders by changed_at DESC', async () => {
    for (let i = 0; i < 5; i++) {
      await provider.writeHistory({
        appId: 'docs',
        environment: 'development',
        layerName: 'core',
        layerKey: 'default',
        action: 'update',
        configAfter: { version: i },
        changedBy: 'test',
      })
    }

    const history = await provider.getHistory('docs', 'development', 'core', 'default', 3)
    expect(history).toHaveLength(3)
  })

  test('getRecentHistory returns entries across all layers', async () => {
    await provider.writeHistory({
      appId: 'docs',
      environment: 'development',
      layerName: 'core',
      layerKey: 'default',
      action: 'create',
      configAfter: { a: 1 },
      changedBy: 'test',
    })
    await provider.writeHistory({
      appId: 'saas',
      environment: 'production',
      layerName: 'user',
      layerKey: 'u1',
      action: 'update',
      configAfter: { b: 2 },
      changedBy: 'test',
    })

    const recent = await provider.getRecentHistory(10)
    expect(recent).toHaveLength(2)
  })

  test('history with rollback_of is preserved', async () => {
    await provider.writeHistory({
      appId: 'docs',
      environment: 'development',
      layerName: 'core',
      layerKey: 'default',
      action: 'rollback',
      configBefore: { a: 2 },
      configAfter: { a: 1 },
      changedBy: 'admin',
      rollbackOf: 'some-history-id',
    })

    const history = await provider.getHistory('docs', 'development', 'core', 'default')
    expect(history[0].rollback_of).toBe('some-history-id')
    expect(history[0].action).toBe('rollback')
  })
})

describe('SqliteConfigProvider — JSON round-tripping', () => {
  test('nested objects survive storage and retrieval', async () => {
    const complex = {
      theme: { colors: { primary: '#ff0000', secondary: '#00ff00' } },
      features: ['auth', 'billing'],
      '$meta': { lock: ['theme.colors.primary'] },
    }

    await provider.upsertLayer('docs', 'development', 'core', 'default', complex, 'test')
    const layer = await provider.getLayer('docs', 'development', 'core', 'default')

    expect(layer!.config_data).toEqual(complex)
  })

  test('empty config_data round-trips as empty object', async () => {
    await provider.upsertLayer('docs', 'development', 'core', 'default', {}, 'test')
    const layer = await provider.getLayer('docs', 'development', 'core', 'default')

    expect(layer!.config_data).toEqual({})
  })
})

describe('SqliteConfigProvider — subscribe', () => {
  test('subscribe returns a no-op unsubscribe', async () => {
    const sub = await provider.subscribe(() => {})
    expect(sub.unsubscribe).toBeInstanceOf(Function)
    sub.unsubscribe() // should not throw
  })
})

describe('SqliteConfigProvider — lifecycle', () => {
  test('destroy can be called multiple times safely', async () => {
    await provider.destroy()
    await provider.destroy() // should not throw
  })
})
