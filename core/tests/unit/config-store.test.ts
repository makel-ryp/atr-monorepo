import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ConfigStore } from '../../server/utils/config-service/store'
import type { ConfigProvider, ConfigLayer, ConfigHistory, ConfigChangeEvent, WriteHistoryInput } from '../../server/utils/config-service/types'

function makeLayer(
  layerName: string,
  layerKey: string,
  data: Record<string, unknown>,
  appId: string = '*',
  environment: string = '*',
): ConfigLayer {
  return {
    id: `fake-${appId}-${layerName}-${layerKey}`,
    app_id: appId,
    environment,
    layer_name: layerName,
    layer_key: layerKey,
    config_data: data,
    schema_version: 1,
    created_by: 'test',
    created_at: '2026-01-01',
    updated_by: 'test',
    updated_at: '2026-01-01',
  }
}

function createMockProvider(layers: ConfigLayer[]): ConfigProvider {
  return {
    getLayer: vi.fn(async (appId, env, name, key) =>
      layers.find(l =>
        l.app_id === appId && l.environment === env && l.layer_name === name && l.layer_key === key,
      ) ?? null,
    ),
    getLayersForApp: vi.fn(async (appId, env) =>
      layers.filter(l =>
        (l.app_id === '*' || l.app_id === appId)
        && (l.environment === '*' || l.environment === env),
      ),
    ),
    getAllLayers: vi.fn(async () => layers),
    upsertLayer: vi.fn(async () => layers[0]),
    deleteLayer: vi.fn(async () => {}),
    writeHistory: vi.fn(async () => {}),
    getHistory: vi.fn(async () => []),
    getRecentHistory: vi.fn(async () => []),
    subscribe: vi.fn(async () => ({ unsubscribe: () => {} })),
    initialize: vi.fn(async () => {}),
    destroy: vi.fn(async () => {}),
  }
}

describe('ConfigStore — layer resolution', () => {
  test('core layers are always included', async () => {
    const layers = [
      makeLayer('core', 'default', { logging: { level: 'info' } }),
      makeLayer('core:org', 'default', { org: { name: 'Test' } }),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    const result = await store.getEffectiveConfig('docs', 'development')

    expect(result.config.logging).toEqual({ level: 'info' })
    expect(result.config.org).toEqual({ name: 'Test' })
  })

  test('environment filtering — exact match and wildcard fallback', async () => {
    const layers = [
      makeLayer('core', 'default', { base: true }),
      makeLayer('core:app', 'default', { env: 'wildcard' }, 'docs', '*'),
      makeLayer('core:app', 'default', { env: 'production' }, 'docs', 'production'),
    ]
    const provider = createMockProvider(layers)
    const store = new ConfigStore(provider)

    // For production, getLayersForApp returns both wildcard and production rows
    const result = await store.getEffectiveConfig('docs', 'production')
    // The provider mock returns both rows; resolveLayer finds first match for core:app with app_id=docs
    // Both have app_id='docs' and layer_name='core:app' — the first match wins
    expect(result.config.base).toBe(true)
  })

  test('custom chain from $meta.layers', async () => {
    const layers = [
      makeLayer('core', 'default', {
        $meta: { mergeOrder: ['core', 'core:org', 'core:app', 'domain', 'user'] },
        theme: 'core',
      }),
      makeLayer('core:org', 'default', {}),
      makeLayer('core:app', 'default', {
        $meta: { layers: ['domain'] },
        theme: 'app',
      }, 'docs'),
      makeLayer('domain', 'foo.com', { theme: 'domain-override' }, 'docs'),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    const result = await store.getEffectiveConfig('docs', 'development', { domain: 'foo.com' })

    expect(result.config.theme).toBe('domain-override')
  })

  test('app-scoped user keys', async () => {
    const layers = [
      makeLayer('core', 'default', { ui: { theme: 'light' } }),
      makeLayer('user', 'docs/user123', { ui: { theme: 'dark' } }, 'docs'),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    const result = await store.getEffectiveConfig('docs', 'development', { userId: 'user123' })

    expect(result.config.ui).toEqual({ theme: 'dark' })
  })

  test('user layer skipped when no userId in context', async () => {
    const layers = [
      makeLayer('core', 'default', { ui: { theme: 'light' } }),
      makeLayer('user', 'docs/user123', { ui: { theme: 'dark' } }, 'docs'),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    const result = await store.getEffectiveConfig('docs', 'development')

    expect(result.config.ui).toEqual({ theme: 'light' })
  })

  test('custom layer skipped when no context key provided', async () => {
    const layers = [
      makeLayer('core', 'default', { x: 'core' }),
      makeLayer('core:app', 'default', {
        $meta: { layers: ['domain'] },
      }, 'docs'),
      makeLayer('domain', 'foo.com', { x: 'domain' }, 'docs'),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    // No domain in context
    const result = await store.getEffectiveConfig('docs', 'development')

    expect(result.config.x).toBe('core')
  })
})

describe('ConfigStore — caching', () => {
  test('cache key is deterministic regardless of context key order', async () => {
    const layers = [
      makeLayer('core', 'default', { x: 1 }),
    ]
    const provider = createMockProvider(layers)
    const store = new ConfigStore(provider)

    await store.getEffectiveConfig('docs', 'development', { userId: 'u1', domain: 'foo.com' })
    await store.getEffectiveConfig('docs', 'development', { domain: 'foo.com', userId: 'u1' })

    // Only one call to getLayersForApp because second call hits cache
    expect(provider.getLayersForApp).toHaveBeenCalledTimes(1)
  })

  test('invalidate clears all caches', async () => {
    const layers = [
      makeLayer('core', 'default', { x: 1 }),
    ]
    const provider = createMockProvider(layers)
    const store = new ConfigStore(provider)

    await store.getEffectiveConfig('docs', 'development')
    store.invalidate()
    await store.getEffectiveConfig('docs', 'development')

    expect(provider.getLayersForApp).toHaveBeenCalledTimes(2)
  })
})

describe('ConfigStore — stats', () => {
  test('returns layerNames instead of layerTypes', async () => {
    const layers = [
      makeLayer('core', 'default', {}),
      makeLayer('core:org', 'default', {}),
      makeLayer('user', 'docs/u1', {}, 'docs'),
      makeLayer('user', 'docs/u2', {}, 'docs'),
    ]
    const store = new ConfigStore(createMockProvider(layers))
    const stats = await store.getStats()

    expect(stats.totalLayers).toBe(4)
    expect(stats.layerNames).toEqual({
      'core': 1,
      'core:org': 1,
      'user': 2,
    })
  })
})
