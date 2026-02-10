# ADR-005: Runtime Configuration Service

## Status
**Proposed**

## Date
2026-02-07

## Context

Nuxt 4's `runtimeConfig` is misnamed. It is not runtime configuration — it is **startup configuration**. The lifecycle is:

1. **Build time**: `nuxt.config.ts` values are baked into the build artifact (written to `.output/server/chunks/nitro/node-server.mjs`)
2. **Process start**: `NUXT_*` environment variables override the baked values once
3. **Frozen**: The result is cached via a getter and never updated again

There is no mechanism to update configuration after the process starts. No hook, no API, no event. The [Nuxt community has requested this](https://github.com/nuxt/nuxt/issues/34270) and it does not exist.

### The Nitro Implementation

The actual implementation of `useRuntimeConfig()` in [Nitro's source](https://github.com/nitrojs/nitro/blob/main/src/runtime/internal/runtime-config.ts):

```typescript
export function useRuntimeConfig(): NitroRuntimeConfig {
  return ((useRuntimeConfig as any)._cached ||= getRuntimeConfig());
}
```

This is a cached getter on a **plain, mutable JavaScript object**. No `Object.freeze()`. No `Object.seal()`. No `Readonly` proxy. The "read-only" guidance in Nuxt's documentation is a convention to prevent request-scoped bugs, not an enforcement.

The underlying object can be mutated. This is the foundation of our server-side hot-reload approach.

### What Nuxt Handles (and What It Doesn't)

| Concern | Nuxt 4 | This ADR |
|---------|--------|----------|
| Build-time layer merging (defu) | Yes | No — ADR-004 covers this |
| Environment-specific builds (`$production`, `$development`, `$env`) | Yes | No — use `nuxt build --envName staging` |
| Env var override at startup (`NUXT_*`) | Yes | No — provisioning only (DB connection, port) |
| Secret separation (`.public` vs private) | Yes | No — Nuxt's model is sufficient |
| Hot-reload of config without restart | **No** | **Yes** — this is the gap |
| Per-organization config overrides | **No** | **Yes** |
| Per-user preferences | **No** | **Yes** |
| Config governance (locking paths) | **No** | **Yes** — `$meta.lock` |
| Audit trail for config changes | **No** | **Yes** |
| Multi-node config propagation | **No** | **Yes** — PG NOTIFY |

### Separation from Build-Time Config

Build-time configuration (ADR-004) and runtime configuration (this ADR) are **orthogonal systems**. They solve different problems, serve different actors, and operate at different trust levels:

```
Build Time (Nuxt — ADR-004):
  layers/core → layers/organization → app/
  defu merges nuxt.config.ts, app.config.ts
  Developers commit code. CI/CD deploys.
  Produces a frozen build artifact.

Runtime (Settings Service — this ADR):
  platform defaults → org overrides → user preferences
  merge-change merges config. $meta.lock governs immutability.
  Control plane writes to database.
  PG NOTIFY propagates to all nodes.
  Lives in server/ as a Nitro service.
```

These two systems do not interact. Nuxt layers solve **which code runs**. The runtime config service solves **which settings apply**. Different problems, different lifecycle.

---

## Part 1: Runtime Configuration Tiers

### First Iteration Scope

| Tier | Description | Storage | Actor |
|------|-------------|---------|-------|
| **Platform defaults** | Base config shipped with the codebase | Code (JSON/TS) | Developers |
| **Organization overrides** | Org-wide settings managed via control plane | PostgreSQL | Admins |
| **User preferences** | Per-user settings (theme, language, density, etc.) | PostgreSQL + node-level K/V cache | End users |

Three tiers. Platform → Organization → User. Merged in that order. Higher tiers override lower tiers (unless locked).

### Explicitly Deferred

| Capability | Future Scope | Rationale |
|------------|-------------|-----------|
| **Group layers** (sub-orgs, roles, domain groups) | Future ADR: "Group Service" | Requires group membership model, reverse index for cache invalidation |
| **Contextual layers** (time of day, geolocation, device type) | Future ADR: "Context Service" | Per-request variability breaks simple caching; needs its own evaluation engine |
| **Feature flags** (A/B testing, rollouts, kill switches) | [ADR-006](./006-agent-context-and-decision-records.md) | Nuxt 4 has no feature flag system (only Nuxt 3 modules exist). Components will be built as toggleable features. Deserves its own ADR. |
| **Reverse index** (layer → affected users mapping) | Ships with Group Service | Only needed when shared group layers exist; org-level changes use broadcast |
| **SchemaPack binary diffs** | Future ADR: "Wire Optimization" | Optimization for high-frequency changes; JSON is sufficient for v1 |

### Why Three Tiers Is Sufficient

With only platform, org, and user, the invalidation model is simple:

- **Platform changes** require redeployment (they're in code). No runtime invalidation needed.
- **Org changes** broadcast to all nodes via PG NOTIFY. Every node updates its org config. No need to figure out which users are affected — every connected user gets the same org config.
- **User changes** target a single user on a single node. The control plane knows which node the user is connected to and pushes directly.

---

## Part 2: The Merge Engine — merge-change

The runtime config merger uses [merge-change](https://github.com/nickelshoe/merge-change) instead of defu:

| Requirement | defu | merge-change |
|-------------|------|--------------|
| Deep path operations (`auth.provider.oauth.clientId`) | No path context in callback | Native `$set` with dot-path syntax |
| Diff tracking (audit log) | Not available | `diff(before, after)` built-in |
| Array handling control | Always concatenates | Configurable per-type via `addMerge()` |
| TypeScript path extraction | Not available | `ExtractPaths<Config>` utility type |

**defu remains the merger for Nuxt's build-time layer system** (ADR-004). merge-change is used exclusively for runtime configuration. Different systems, different merge engines.

---

## Part 3: The `$meta` Namespace

All governance metadata lives under a single reserved key: `$meta`. This aligns with Nuxt's existing `$meta` convention and keeps governance data separate from configuration values.

### `$meta.lock` — The Only Governance Directive

`$meta.lock` is an array of dot-notation paths. Each path names a config value that **cannot be overridden by lower-priority tiers**.

```json
{
  "$meta": {
    "mergeOrder": ["platform", "organization", "user"],
    "lock": ["auth.provider", "auth.oauth.clientId", "ui.layout.leftAside"]
  },
  "auth": {
    "provider": "oauth2",
    "sessionTimeout": 3600,
    "oauth": { "clientId": "abc-123" }
  },
  "ui": {
    "theme": "light",
    "locale": "en",
    "layout": { "leftAside": true }
  }
}
```

### Why No `$meta.secret`

Nuxt already handles secret separation through its `.public` and `.app` partitioning:

- `runtimeConfig.public.*` — exposed to the client
- `runtimeConfig.*` (non-public) — server-only, never sent to the client

This is a better model than marking individual paths as secret, because the boundary is structural (separate objects), not metadata-driven. Nuxt enforces it at the framework level — no custom scrubbing needed.

### How Locks Work

The merge algorithm processes tiers top-down (platform first, user last). As each tier is processed, its `$meta.lock` paths are accumulated into a Set. Before merging the next tier, any values at locked paths in that tier are stripped.

```typescript
const META_KEY = '$meta'

function mergeWithGovernance(layers: Array<{ config: Record<string, any> }>): MergeResult {
  const lockedPaths = new Set<string>()
  let merged: Record<string, any> = {}

  for (const layer of layers) {
    const meta = layer.config[META_KEY]
    if (meta?.lock) {
      for (const path of meta.lock) lockedPaths.add(path)
    }
    const sanitized = stripLockedPaths(layer.config, lockedPaths, merged)
    delete sanitized[META_KEY]
    merged = mc.merge(merged, sanitized)
  }

  return { config: merged, lockedPaths }
}
```

**Key behaviors:**
- Locks accumulate across tiers. No tier can remove a lock set by a higher-priority tier.
- A tier can lock a path it didn't set — this prevents lower tiers from introducing that value.
- `$meta` never appears in the merged output. It's metadata consumed by the merge algorithm.

### Merge Order

Platform defaults define and lock the merge order:

```json
{
  "$meta": {
    "mergeOrder": ["platform", "organization", "user"],
    "lock": ["$meta.mergeOrder"]
  }
}
```

### Worked Example

```
Platform defaults:
  $meta.lock: ["$meta.mergeOrder", "auth.provider"]
  auth.provider: "oauth2"
  auth.sessionTimeout: 1800
  ui.theme: "light"

Org overrides:
  $meta.lock: ["ui.layout.leftAside"]
  auth.provider: "saml"           <- STRIPPED (locked by platform)
  auth.sessionTimeout: 3600       <- APPLIED (not locked)
  ui.layout.leftAside: true

User preferences:
  auth.sessionTimeout: 7200       <- APPLIED (not locked)
  ui.layout.leftAside: false      <- STRIPPED (locked by org)
  ui.theme: "dark"                <- APPLIED (not locked)

--- After merge ---

  auth.provider: "oauth2"         <- from platform (locked)
  auth.sessionTimeout: 7200       <- from user (last writer wins)
  ui.layout.leftAside: true       <- from org (locked by org)
  ui.theme: "dark"                <- from user (not locked)
```

### Upstream Proposal

A [feature request](https://github.com/nuxt/nuxt/issues/34270) has been submitted to the Nuxt team proposing `$meta.lock` as a build-time feature for Nuxt's layer system. If accepted, it would give build-time config (via `createDefu`) the same governance capability that this ADR provides at runtime (via merge-change). The implementations would be independent but conceptually aligned.

---

## Part 4: Hot-Reload Mechanism

### Server-Side: Nitro Plugin + Direct Mutation

Since `useRuntimeConfig()` returns a plain mutable object, we can update it directly from a Nitro plugin:

```typescript
// core/server/plugins/settings-loader.ts
export default defineNitroPlugin(async (nitroApp) => {
  const config = useRuntimeConfig()

  async function refreshSettings() {
    const settings = await fetchSettingsFromDB()
    Object.assign(config.public, settings.public)
  }

  await refreshSettings()
  nitroApp.hooks.hook('settings:refresh', refreshSettings)
})
```

This is not a hack — it's using the actual implementation contract of the runtime config object.

### Client-Side: Settings API + WebSocket

Client-side hot-reload is simpler because `runtimeConfig.public` is already writable and reactive (Vue reactivity):

1. On app load, fetch effective settings from the Settings API
2. Open a WebSocket connection to the node
3. When the node receives a PG NOTIFY, push updated config to connected clients
4. Client updates reactive state — UI re-renders automatically

For settings that go through `app.config`, use Nuxt's built-in `updateAppConfig()`.

### Multi-Node Propagation: PG NOTIFY

PG NOTIFY is a real-time nudge, not a replication log. The `config_layers` table is the source of truth. On boot or reconnect, load the latest config from the table. While running, listen for NOTIFY and reload. No version tracking, no catch-up queries, no replay.

---

## Part 5: PostgreSQL Schema

### `config_layers` Table

```sql
CREATE TABLE config_layers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_type    TEXT NOT NULL CHECK (layer_type IN ('platform', 'organization', 'user')),
  layer_id      TEXT NOT NULL,
  config_data   JSONB NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (layer_type, layer_id)
);
```

### `config_history` Table (Audit Log)

```sql
CREATE TABLE config_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_type    TEXT NOT NULL,
  layer_id      TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'rollback')),
  config_before JSONB,
  config_after  JSONB,
  config_diff   JSONB,
  changed_by    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason TEXT,
  rollback_of   UUID REFERENCES config_history(id),
  ip_address    INET,
  user_agent    TEXT
);
```

### `user_sessions` Table

```sql
CREATE TABLE user_sessions (
  user_id       TEXT NOT NULL,
  node_id       TEXT NOT NULL,
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);
```

### Triggers

PG NOTIFY triggers fire on org config changes (broadcasting to all nodes) and user settings changes (targeted to nodes with that user cached). Schema validation via `pg_jsonschema` ensures all writes conform to expected structure. Audit triggers record every change to `config_history` with before/after snapshots.

---

## Part 6: Node-Level Caching

Each node holds the org config blob in memory (`ConfigStore`), loaded on boot and updated when PG NOTIFY fires. Per-user merged config is cached in a `UserCache` (LRU, keyed by user ID not JWT). On the hot path, a cache hit is sub-millisecond. A miss triggers a single PostgreSQL query + merge.

When org config changes, `remergeAll()` re-merges every cached user in-memory using the new org config — no per-user DB queries needed.

---

## Part 7: Settings API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/settings/:appName` | GET | Returns effective merged config for the current user |
| `/api/settings/user` | PUT | Updates the current user's preferences |
| `/api/settings/overrides/:appName` | PUT | Writes org-level overrides (admin only) |
| `/api/settings/overrides/:appName` | DELETE | Wipes all org overrides, falls back to platform defaults |
| `/api/settings/rollback` | POST | Reverts a config layer to a previous version from `config_history` |

---

## Part 8: Control Plane Integration

The `/control` app gains write capabilities through the Settings API. All mutations flow through the same pipeline.

### SOC2/SOX Compliance

Every configuration change is auditable via `config_history`: who (`changed_by`), when (`changed_at`), what (`config_before`/`config_after`/`config_diff`), why (`change_reason`), and rollback lineage (`rollback_of`).

### Control Plane UI Capabilities

- **Config Editor**: Effective config per app with source attribution. Locked fields shown as read-only.
- **Audit Log**: Chronological changes, filterable, with diff views. Export for compliance (CSV/JSON).
- **Rollback**: Select historical state, preview diff, confirm. Rollback itself is audited.

---

## Part 9: Development Experience

### SQLite for Local Development

SQLite locally, PostgreSQL in production. Same data model, same API, different storage backend. SQLite requires zero setup — ideal for `nuxt dev`. PostgreSQL is required for multi-node deployments (PG NOTIFY).

### Environment Variables Are for Provisioning

Env vars are used exclusively for provisioning: `DATABASE_URL`, `PORT`, `NODE_ID`. Application configuration flows through the runtime config service, never through env vars.

Nuxt 4 handles build-time environments via `$production`, `$development`, and `$env` in `nuxt.config.ts` (e.g., `nuxt build --envName staging`). Once built, only provisioning env vars are consumed.

---

## Part 10: Performance Budget

| Operation | Target | Mechanism |
|-----------|--------|-----------|
| Cached config read (user in K/V) | <1ms | In-memory Map lookup |
| Governance-aware merge (3 tiers) | <1ms | merge-change + path stripping |
| Cache miss (DB fetch + merge) | <10ms | Single query + merge |
| Org config propagation | <2s | PG NOTIFY → reload → remergeAll |
| User settings push (targeted) | <2s | PG NOTIFY → target node → cache swap |

---

## Part 11: Future Considerations

### Group Service (Future ADR)
Adds `group` layer type, reverse index for targeted invalidation, extends merge chain: platform → org → group(s) → user.

### Context Service (Future ADR)
Lightweight post-merge transforms per-request (time of day, geolocation, device type). Stateless, no new cache entries.

### Wire Optimization (Future ADR)
SchemaPack for binary diff transmission on the targeted user settings push path.

### Feature Flag System (ADR-006)
Nuxt 4 has no feature flag system. ADR-006 will define the approach, including building components as toggleable features for A/B testing and production on/off control.

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime merge engine | [merge-change](https://github.com/nickelshoe/merge-change) | Path operations, diff tracking, array control |
| Governance model | `$meta.lock` only | Nuxt handles secrets via `.public`/`.app` separation |
| Governance namespace | `$meta` | Aligns with Nuxt's existing `$meta` convention |
| Config tiers (v1) | Platform → Organization → User | Simplest model; groups/context deferred |
| Propagation | PG NOTIFY | Simple, stateless nudge. Table is source of truth. |
| Production storage | PostgreSQL | PG NOTIFY, JSONB, triggers, scalable |
| Development storage | SQLite | Zero setup, same data model |
| Server hot-reload | Nitro plugin + direct mutation | `useRuntimeConfig()` returns a mutable object |
| Client hot-reload | Settings API + WebSocket | `runtimeConfig.public` is already reactive |
| Audit trail | `config_history` table | SOC2/SOX compliance, rollback support |
| Feature flags | Deferred to [ADR-006](./006-agent-context-and-decision-records.md) | No Nuxt 4 support exists |

---

## References

### Runtime Config Research
- [Nitro runtime-config.ts source](https://github.com/nitrojs/nitro/blob/main/src/runtime/internal/runtime-config.ts)
- [Nuxt issue #34270](https://github.com/nuxt/nuxt/issues/34270) — `$meta.lock` feature request

### Merge Engine
- [merge-change](https://github.com/nickelshoe/merge-change) — runtime merge library
- [unjs/defu](https://github.com/unjs/defu) — build-time merge library (Nuxt, not this system)

### PostgreSQL
- [PostgreSQL LISTEN/NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [pg_jsonschema](https://github.com/supabase/pg_jsonschema)

### Compliance
- [SOC2 CC6/CC8 Controls](https://us.aicpa.org/interestareas/frc/assuranceadvisoryservices/trustservicescriteria)

### Related ADRs
- [ADR-004: Layer Cascade, i18n, and Cross-Cutting Concerns](./004-layer-cascade-i18n-and-cross-cutting-concerns.md) — build-time configuration
- [ADR-006: Context Oracle](./006-agent-context-and-decision-records.md) (feature flags tracked as knowledge slug)
