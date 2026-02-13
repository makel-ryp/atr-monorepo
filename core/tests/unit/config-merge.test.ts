import { describe, test, expect } from 'vitest'
import {
  configDeepMerge,
  mergeWithGovernance,
  computeConfigDiff,
} from '../../server/utils/config-service/merge'
import type { ConfigLayer } from '../../server/utils/config-service/types'

function makeLayer(
  layerName: string,
  layerKey: string,
  data: Record<string, unknown>,
  appId: string = '*',
  environment: string = '*',
): ConfigLayer {
  return {
    id: `fake-${layerName}-${layerKey}`,
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

describe('configDeepMerge', () => {
  test('merges flat objects', () => {
    const target = { a: 1 }
    configDeepMerge(target, { b: 2 })
    expect(target).toEqual({ a: 1, b: 2 })
  })

  test('source overrides target for primitives', () => {
    const target = { a: 1 }
    configDeepMerge(target, { a: 2 })
    expect(target).toEqual({ a: 2 })
  })

  test('recursively merges nested objects', () => {
    const target = { a: { b: 1, c: 2 } }
    configDeepMerge(target, { a: { c: 3, d: 4 } })
    expect(target).toEqual({ a: { b: 1, c: 3, d: 4 } })
  })

  test('arrays replace (not concatenate)', () => {
    const target = { a: [1, 2] }
    configDeepMerge(target, { a: [3, 4] })
    expect(target).toEqual({ a: [3, 4] })
  })

  test('null in source replaces target', () => {
    const target = { a: { b: 1 } } as any
    configDeepMerge(target, { a: null } as any)
    expect(target.a).toBeNull()
  })
})

describe('mergeWithGovernance', () => {
  test('empty layers returns empty config', () => {
    const result = mergeWithGovernance([])
    expect(result.config).toEqual({})
    expect(result.lockedPaths.size).toBe(0)
  })

  test('single core layer passes through', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', { logging: { level: 'info' } }),
    ])
    expect(result.config).toEqual({ logging: { level: 'info' } })
  })

  test('core:org overrides core (later tier wins)', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', { logging: { level: 'info' } }),
      makeLayer('core:org', 'default', { logging: { level: 'warn' } }),
    ])
    expect(result.config).toEqual({ logging: { level: 'warn' } })
  })

  test('user overrides core:org and core', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', { ui: { theme: 'light' } }),
      makeLayer('core:org', 'default', { ui: { theme: 'corporate' } }),
      makeLayer('user', 'docs/user1', { ui: { theme: 'dark' } }, 'docs'),
    ])
    expect(result.config).toEqual({ ui: { theme: 'dark' } })
  })

  test('layers are sorted by merge order regardless of input order', () => {
    const result = mergeWithGovernance([
      makeLayer('user', 'docs/u1', { x: 'user' }, 'docs'),
      makeLayer('core', 'default', { x: 'core' }),
      makeLayer('core:org', 'default', { x: 'org' }),
    ])
    // user wins (processed last)
    expect(result.config).toEqual({ x: 'user' })
  })

  test('$meta.lock prevents core:org from overriding core', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { lock: ['auth.provider'] },
        auth: { provider: 'oauth2', timeout: 1800 },
      }),
      makeLayer('core:org', 'default', {
        auth: { provider: 'saml', timeout: 3600 },
      }),
    ])
    expect(result.config.auth).toEqual({ provider: 'oauth2', timeout: 3600 })
  })

  test('$meta.lock prevents user from overriding core:org-locked path', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { lock: ['auth.provider'] },
        auth: { provider: 'oauth2' },
      }),
      makeLayer('core:org', 'default', {
        $meta: { lock: ['ui.sidebar'] },
        ui: { sidebar: true, theme: 'blue' },
      }),
      makeLayer('user', 'docs/u1', {
        auth: { provider: 'local' },
        ui: { sidebar: false, theme: 'dark' },
      }, 'docs'),
    ])
    // auth.provider locked by core → user can't override
    expect((result.config.auth as any).provider).toBe('oauth2')
    // ui.sidebar locked by core:org → user can't override
    expect((result.config.ui as any).sidebar).toBe(true)
    // ui.theme not locked → user can override
    expect((result.config.ui as any).theme).toBe('dark')
  })

  test('ancestor lock blocks all descendants', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { lock: ['auth'] },
        auth: { provider: 'oauth2', session: { timeout: 1800 } },
      }),
      makeLayer('core:org', 'default', {
        auth: { provider: 'saml', session: { timeout: 3600 }, newKey: 'val' },
      }),
    ])
    // Entire auth tree is locked — core:org can't add or modify anything under auth
    expect(result.config.auth).toEqual({ provider: 'oauth2', session: { timeout: 1800 } })
  })

  test('locks accumulate across tiers', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { lock: ['a'] },
        a: 1,
        b: 2,
        c: 3,
      }),
      makeLayer('core:org', 'default', {
        $meta: { lock: ['b'] },
        a: 10, // locked by core → stripped
        b: 20,
        c: 30,
      }),
      makeLayer('user', 'docs/u1', {
        a: 100, // locked by core → stripped
        b: 200, // locked by core:org → stripped
        c: 300, // not locked → applied
      }, 'docs'),
    ])
    expect(result.config).toEqual({ a: 1, b: 20, c: 300 })
  })

  test('$meta is stripped from final output', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { mergeOrder: ['core', 'core:org', 'core:app', 'user'], lock: [] },
        key: 'value',
      }),
    ])
    expect(result.config.$meta).toBeUndefined()
    expect(result.config.key).toBe('value')
  })

  test('lockedPaths set is populated correctly', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { lock: ['auth.provider'] },
        auth: { provider: 'oauth2' },
      }),
      makeLayer('core:org', 'default', {
        $meta: { lock: ['ui.sidebar'] },
        ui: { sidebar: true },
      }),
    ])
    expect(result.lockedPaths.has('auth.provider')).toBe(true)
    expect(result.lockedPaths.has('ui.sidebar')).toBe(true)
  })

  test('deep merge across tiers', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        features: { logging: true, metrics: true },
      }),
      makeLayer('core:org', 'default', {
        features: { branding: true },
      }),
    ])
    expect(result.config.features).toEqual({
      logging: true,
      metrics: true,
      branding: true,
    })
  })

  test('custom layers merge in declared order', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { mergeOrder: ['core', 'core:org', 'core:app', 'domain', 'user'] },
        theme: 'default',
      }),
      makeLayer('core:app', 'default', { theme: 'app' }, 'docs'),
      makeLayer('domain', 'foo.com', { theme: 'domain' }, 'docs'),
      makeLayer('user', 'docs/u1', { theme: 'user' }, 'docs'),
    ])
    expect(result.config.theme).toBe('user')
  })

  test('custom layers respect merge order positioning', () => {
    const result = mergeWithGovernance([
      makeLayer('core', 'default', {
        $meta: { mergeOrder: ['core', 'core:org', 'core:app', 'domain', 'channel', 'user'] },
        x: 'core',
      }),
      makeLayer('domain', 'foo.com', { x: 'domain' }, 'docs'),
      makeLayer('channel', 'sales', { x: 'channel' }, 'docs'),
    ])
    // channel comes after domain in merge order, so channel wins
    expect(result.config.x).toBe('channel')
  })
})

describe('computeConfigDiff', () => {
  test('detects added keys', () => {
    const diff = computeConfigDiff({}, { a: 1 })
    expect(diff).toEqual({ a: { old: undefined, new: 1 } })
  })

  test('detects removed keys', () => {
    const diff = computeConfigDiff({ a: 1 }, {})
    expect(diff).toEqual({ a: { old: 1, new: undefined } })
  })

  test('detects changed values', () => {
    const diff = computeConfigDiff({ a: 1 }, { a: 2 })
    expect(diff).toEqual({ a: { old: 1, new: 2 } })
  })

  test('ignores unchanged values', () => {
    const diff = computeConfigDiff({ a: 1, b: 2 }, { a: 1, b: 2 })
    expect(diff).toEqual({})
  })

  test('handles nested changes', () => {
    const diff = computeConfigDiff(
      { x: { y: 1 } },
      { x: { y: 2, z: 3 } },
    )
    expect(diff['x.y']).toEqual({ old: 1, new: 2 })
    expect(diff['x.z']).toEqual({ old: undefined, new: 3 })
  })
})
