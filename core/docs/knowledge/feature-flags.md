---
title: Feature Flags
description: Unified feature registry for managing application capabilities with configuration, permissions, rollout, and UI metadata.
---

## Details

### Table of Contents

1. [Philosophy](#philosophy)
2. [Core Data Model](#core-data-model)
3. [Feature Structure](#feature-structure)
4. [Enablement Model](#enablement-model)
5. [Dependencies](#dependencies)
6. [Configuration](#configuration)
7. [Metadata](#metadata)
8. [Feature Scoping](#feature-scoping)
9. [Permission System](#permission-system)
10. [Runtime Introspection](#runtime-introspection)
11. [Configurability (Settings ACL)](#configurability-settings-acl)
12. [Rollout & Variants](#rollout--variants)
13. [Environment Variable Overrides](#environment-variable-overrides)
14. [Lifecycle Management](#lifecycle-management)
15. [Client Bundle](#client-bundle)
16. [Validation](#validation)
17. [Implementation Guide](#implementation-guide)
18. [Integration with Existing Systems](#integration-with-existing-systems)
19. [Examples](#examples)

---

### Philosophy

#### Core Principles

1. **Features ARE the application** - Every capability is a feature, from infrastructure (HTTP server, database) to user-facing functionality (streaming chat, PII redaction). There is no distinction between "core" and "feature" - everything is a feature.

2. **Flat registry, graph via requires** - The registry is a flat key-value map. There is NO parent-child hierarchy. Dependencies are expressed through `requires` arrays, creating a directed acyclic graph (DAG).

3. **Emergent properties** - Properties like "is this feature optional?" are computed by analyzing the graph, not declared. A feature is optional if nothing else requires it.

4. **Productized naming** - Name features by capability (`streaming-chat`, `pii-redaction`), not temporality (`new-chat-ui`, `chat-v2`). Temporal names rot; capability names remain meaningful.

5. **Separation of concerns**:
   - `config` = values (what the feature uses)
   - `meta` = presentation (how to render it)
   - `rollout` = distribution (who gets which variant)

6. **Public/Private separation** - Public config is sent to clients. Private config never leaves the server. These are completely separate concerns with separate metadata.

7. **Scoped code is traceable code** - All feature code is wrapped in `feature()` scopes. This makes features countable, their dependencies detectable, and their boundaries visible. No grep-hunting through codebases.

8. **Permission abstraction** - Features define their own permission vocabulary (`'use'`, `'configure'`, `'export'`). The translation to the actual permission system (RCX permissions) happens in one place. Swap permission backends without touching feature code.

9. **Disable behavior is code, not config** - What happens when a feature is disabled is Turing-complete - the feature code decides (return nothing, show message, fall back, etc.). This keeps disable logic testable and self-contained.

---

### Core Data Model

#### Path Encoding Convention

**Canonical form**: Dot-separated, camelCase segments.
```
agents.default.model
validation.maxTokens
```

**Environment variable form**: Double-underscore for dots, SCREAMING_SNAKE for segments.
```
FEATURE_<ID>__<PATH>=value
FEATURE_OPENAI_INTEGRATION__AGENTS__DEFAULT__MODEL=gpt-4
```

This encoding round-trips cleanly:
- Encode: `agents.default.model` -> `AGENTS__DEFAULT__MODEL`
- Decode: `AGENTS__DEFAULT__MODEL` -> `agents.default.model`

#### TypeScript Interfaces

```typescript
interface PermissionSet {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

type UserPermissions = Record<string, PermissionSet>;

interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json' | 'password';
  label: string;
  description?: string;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

interface Configurability {
  view: Record<string, string>;
  edit: Record<string, string>;
}

type FeaturePermissions = Record<string, string>;
type BlockedReason = 'removed' | 'disabled' | 'dependency' | 'cycle';

interface ComputedState {
  enabled: boolean;
  blockedBy?: string[];
  blockedByReason?: Record<string, BlockedReason>;
  optional: boolean;
  deprecationWarning?: string;
}

interface PublicMeta {
  name: string;
  description: string;
  icon?: string;
  category?: string;
  variant?: string;
  state?: ComputedState;
  configurability: Configurability;
  featurePermissions: FeaturePermissions;
  fields: Record<string, FieldSchema>;
  exposeToClient?: boolean;
}

interface PrivateMeta {
  configurability: Configurability;
  featurePermissions?: FeaturePermissions;
  fields: Record<string, FieldSchema>;
}

interface Variant {
  id: string;
  weight?: number;
}

interface RolloutConfig {
  experimentId?: string;
  variants: Variant[];
}

type FeatureStatus = 'active' | 'deprecated' | 'removed';

interface Feature<TPublic = Record<string, unknown>, TPrivate = Record<string, unknown>> {
  id: string;
  enabled?: boolean;
  requires?: string[];
  config: {
    public?: TPublic;
    private?: TPrivate;
  };
  meta: {
    public: PublicMeta;
    private?: PrivateMeta;
  };
  rollout?: RolloutConfig;
  status: FeatureStatus;
  createdAt: string;
  expiresAt?: string;
}

type FeatureRegistry = Record<string, Feature>;

interface ClientFeature {
  id: string;
  enabled: boolean;
  requires?: string[];
  config: Record<string, unknown>;
  meta: PublicMeta;
  status: FeatureStatus;
}

interface ClientFeatureBundle {
  features: Record<string, ClientFeature>;
}
```

---

### Feature Structure

#### Top-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | Yes | - | Unique identifier in kebab-case. Used as the registry key. |
| `enabled` | No | `true` | Runtime toggle. Can be changed at runtime without changing lifecycle. |
| `requires` | No | `[]` | Array of feature IDs this feature depends on. |
| `config` | Yes | - | Object containing `public` and/or `private` configuration. |
| `meta` | Yes | - | Object containing `public` (required) and `private` (optional) metadata. |
| `rollout` | No | - | A/B test configuration with variants and weights. |
| `status` | Yes | - | Lifecycle status: `'active'`, `'deprecated'`, or `'removed'`. |
| `createdAt` | Yes | - | ISO 8601 date when the feature was created. |
| `expiresAt` | No | - | ISO 8601 date when the feature should auto-deprecate. |

#### Naming Conventions

**Feature IDs:**
- Use kebab-case: `pii-redaction`, `streaming-chat`, `openai-integration`
- Name by capability, not time: `streaming-chat` not `new-chat-ui`
- Be specific: `email-pii-redaction` not just `redaction`
- Avoid IDs that are prefixes of other IDs (e.g., don't have both `ai` and `ai-agents`)

**Config Paths:**
- Use camelCase for config keys: `maxResults`, `apiTimeout`, `enableStreaming`
- Nest logically with dots: `agents.default.model`, `validation.maxTokens`
- Field schema keys MUST match actual config paths

---

### Enablement Model

#### Three-Layer Enablement

A feature's final "enabled" state is determined by three independent factors:

| Layer | Field | Meaning | Can Change At Runtime? |
|-------|-------|---------|------------------------|
| **Lifecycle** | `status` | Is the feature live? (`active`/`deprecated` = yes, `removed` = no) | Rarely (deploy) |
| **Toggle** | `enabled` | Is the feature turned on? | Yes (admin action) |
| **Dependencies** | computed | Are all required features enabled? | Indirectly |

#### Enablement Resolution

```typescript
function computeEnabled(
  featureId: string,
  registry: FeatureRegistry,
  visited: Set<string> = new Set()
): { enabled: boolean; blockedBy: string[]; blockedByReason: Record<string, BlockedReason> } {
  const feature = registry[featureId];
  const blockedBy: string[] = [];
  const blockedByReason: Record<string, BlockedReason> = {};

  if (!feature || feature.status === 'removed') {
    blockedBy.push('self');
    blockedByReason['self'] = 'removed';
    return { enabled: false, blockedBy, blockedByReason };
  }

  if (feature.enabled === false) {
    blockedBy.push('self');
    blockedByReason['self'] = 'disabled';
    return { enabled: false, blockedBy, blockedByReason };
  }

  if (visited.has(featureId)) {
    blockedBy.push('self');
    blockedByReason['self'] = 'cycle';
    return { enabled: false, blockedBy, blockedByReason };
  }
  visited.add(featureId);

  for (const depId of feature.requires ?? []) {
    const depResult = computeEnabled(depId, registry, new Set(visited));
    if (!depResult.enabled) {
      blockedBy.push(depId);
      if (depResult.blockedByReason['self']) {
        blockedByReason[depId] = depResult.blockedByReason['self'];
      } else {
        blockedByReason[depId] = 'dependency';
      }
    }
  }

  return {
    enabled: blockedBy.length === 0,
    blockedBy,
    blockedByReason,
  };
}
```

#### Deprecation Semantics

- **`deprecated` counts as enabled** for dependency purposes
- Dependents continue to work when a dependency is deprecated
- Deprecation triggers UI warnings but doesn't break functionality
- Only `removed` or `enabled: false` disables a feature

---

### Dependencies

#### How Dependencies Work

Dependencies create a directed acyclic graph (DAG). Features declare what they require via the `requires` array.

```typescript
const registry: FeatureRegistry = {
  'http-server': {
    id: 'http-server',
    requires: [],
  },
  'websocket': {
    id: 'websocket',
    requires: ['http-server'],
  },
  'streaming-chat': {
    id: 'streaming-chat',
    requires: ['websocket', 'openai-integration'],
  },
};
```

#### Important: No Hierarchy

A feature with `requires: []` is NOT a "root" - there is no tree. It simply has no dependencies.

#### Computed Properties

These properties are NOT stored - they are computed from the graph:

```typescript
function isOptional(featureId: string, registry: FeatureRegistry): boolean {
  for (const feature of Object.values(registry)) {
    if (feature.requires?.includes(featureId)) {
      return false;
    }
  }
  return true;
}

function getDependencies(featureId: string, registry: FeatureRegistry): string[] {
  const deps = new Set<string>();
  const stack = [...(registry[featureId]?.requires ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (deps.has(current)) continue;
    deps.add(current);
    const feature = registry[current];
    if (feature?.requires) {
      stack.push(...feature.requires);
    }
  }
  return Array.from(deps);
}

function getDependents(featureId: string, registry: FeatureRegistry): string[] {
  const dependents: string[] = [];
  for (const [id, feature] of Object.entries(registry)) {
    if (feature.requires?.includes(featureId)) {
      dependents.push(id);
    }
  }
  return dependents;
}

function getLoadOrder(registry: FeatureRegistry): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const feature = registry[id];
    for (const dep of feature?.requires ?? []) {
      visit(dep);
    }
    result.push(id);
  }
  for (const id of Object.keys(registry)) {
    visit(id);
  }
  return result;
}

function getDeprecationWarning(featureId: string, registry: FeatureRegistry): string | undefined {
  const feature = registry[featureId];
  if (feature?.status === 'deprecated') {
    return `Feature "${featureId}" is deprecated`;
  }
  for (const depId of getDependencies(featureId, registry)) {
    const dep = registry[depId];
    if (dep?.status === 'deprecated') {
      return `Dependency "${depId}" is deprecated`;
    }
  }
  return undefined;
}
```

---

### Configuration

#### Public vs Private

| Aspect | `config.public` | `config.private` |
|--------|-----------------|------------------|
| Sent to client | Yes | **Never** |
| Editable by users | Yes (with configurability) | No |
| Editable by admins | Yes | Yes (via separate admin API) |
| Visible in UI | Yes | Only in admin tools |
| Use case | User preferences, toggles | API keys, internal limits |

---

### Metadata

#### Public Metadata (`meta.public`)

Always sent to the client (unless `exposeToClient: false`). Contains everything needed to render the feature in the UI.

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Human-readable feature name |
| `description` | Yes | - | What this feature does |
| `icon` | No | - | Icon identifier for UI |
| `category` | No | - | UI grouping category |
| `configurability` | Yes | - | Who can view/edit settings (uses feature permission names) |
| `featurePermissions` | Yes | - | Feature's permission vocabulary |
| `fields` | Yes | - | Field schemas for UI rendering |
| `exposeToClient` | No | `true` | Set `false` to exclude from client bundle |

#### Field Schema

```typescript
interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json' | 'password';
  label: string;
  description?: string;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}
```

---

### Feature Scoping

#### The `feature()` Function

All feature code is wrapped in `feature()` scopes for traceability, permission scoping, disable handling, and runtime introspection.

```typescript
feature('audit-logs', (scope) => {
  if (scope.disabled) {
    return { message: 'Audit logging is currently disabled' };
  }
  if (!scope.hasPermission('view')) {
    return { error: 'Permission denied' };
  }
  return getAuditLogs();
});
```

#### The Scope Object

```typescript
interface FeatureScope {
  id: string;
  disabled: boolean;
  isEnabled(): boolean;
  config: Record<string, any>;
  getPublicConfig<T>(path?: string): T | undefined;
  getPrivateConfig<T>(path?: string): T | undefined;
  meta: PublicMeta;
  hasPermission(action: string): boolean;
  log(message: string, level?: 'debug' | 'info' | 'warn' | 'error'): void;
}
```

#### Disable Behavior is Code

What happens when a feature is disabled is Turing-complete - the feature code decides:

```typescript
feature('premium-search', (scope) => {
  if (scope.disabled) {
    if (scope.hasPermission('trial')) {
      return { limitedResults: basicSearch(query).slice(0, 5) };
    }
    return { message: 'Premium search is not available in your plan' };
  }
  return fullPremiumSearch(query);
});
```

---

### Permission System

#### Two-Layer Permission Model

1. **Feature Permissions** - Logical, feature-specific vocabulary (`'use'`, `'configure'`, `'export'`)
2. **RCX Permissions** - Actual permission system (`'AI_Governance:read'`, `'AI_Settings_Admin:update'`)

Features think in their own terms. Translation happens once, in `featurePermissions`.

#### Auto-Prefixing at Load Time

```typescript
// What you define:
featurePermissions: {
  'use': 'AI_Integration_Models:read',
  'configure': 'AI_Settings_Admin:update'
}

// What gets registered internally:
{
  'openai-integration:use': 'AI_Integration_Models:read',
  'openai-integration:configure': 'AI_Settings_Admin:update'
}
```

---

### Runtime Introspection

Every `feature()` call registers itself at runtime:

```typescript
{
  'audit-logs': {
    callSites: [
      { file: 'src/logs/handler.ts', line: 42, function: 'getAuditLogs' },
    ],
    lastCalled: '2024-01-11T14:32:00Z',
    callCount: 847,
    dependencies: ['pii-redaction', 'notifications'],
    permissionChecks: ['audit-logs:view', 'pii-redaction:redact']
  }
}
```

No grep needed. Use the introspection API instead.

---

### Configurability (Settings ACL)

Controls who can view and edit feature settings in the UI using feature permission names.

```typescript
configurability: {
  view: { '*': 'use' },
  edit: { '*': 'configure' }
}
```

Supports wildcard patterns for field paths. Most specific pattern wins.

---

### Rollout & Variants

Rollout enables A/B testing by assigning users to variants. Assignment is deterministic (same user always gets same variant), pre-computed at login, and server-side only.

```typescript
rollout: {
  experimentId: 'search-v2-2024',
  variants: [
    { id: 'control', weight: 1 },
    { id: 'treatment-a', weight: 2 },
    { id: 'treatment-b', weight: 1 },
  ],
}
```

Uses consistent hashing for stable variant allocation.

---

### Environment Variable Overrides

```
FEATURE_<FEATURE_ID>__<PATH>=value              # Public config
FEATURE_<FEATURE_ID>__PRIVATE__<PATH>=value     # Private config
```

Security: Only allows overriding paths that exist in `meta.fields`. Prevents injection of arbitrary config paths.

---

### Lifecycle Management

| Status | Meaning | Enabled for deps? | UI Behavior |
|--------|---------|-------------------|-------------|
| `active` | Feature is live and supported | Yes | Normal display |
| `deprecated` | Still works but being phased out | **Yes** | Warning badge, sunset date |
| `removed` | No longer functional | No | Hidden, errors if accessed |

Features can have optional `expiresAt` dates for temporary experiments.

---

### Client Bundle

Client receives: `id`, `enabled` (computed), `requires`, `status`, `config` (public only), `meta` (public only, with computed `variant` and `state`).

Excluded: `config.private`, `meta.private`, `rollout` (only resolved `variant` is sent), features with `exposeToClient === false`, features with `status === 'removed'`.

---

### Validation

The registry loader validates:
1. ID consistency (`feature.id === registryKey`)
2. No unknown dependencies (all `requires` entries exist)
3. No cycles (DAG is acyclic)
4. Valid rollout (non-empty variants, positive weights)
5. Schema-config alignment (every path in `meta.fields` exists in config)
6. Configurability has defaults
7. Env override safety (only defined paths)

---

### Implementation Guide

#### File Structure

```
lib/
  features/
    types.ts              # TypeScript interfaces
    registry.ts           # FeatureRegistry class
    loader.ts             # Load features from JSON files
    validation.ts         # Validation functions
    resolver.ts           # Dependency resolution
    rollout.ts            # Variant computation
    env-overrides.ts      # Environment variable processing
    client-bundle.ts      # Prepare features for client
    configurability.ts    # Configurability pattern matching

config/
  features/
    index.json            # Feature registry
```

---

### Examples

#### Infrastructure Feature (Private Only)

```typescript
{
  id: 'sqlite-database',
  enabled: true,
  requires: [],
  config: {
    public: {},
    private: {
      path: './data/app.db',
      walMode: true,
      busyTimeout: 5000,
    },
  },
  meta: {
    public: {
      name: 'SQLite Database',
      description: 'Embedded database for settings and logs',
      icon: 'database',
      category: 'Infrastructure',
      exposeToClient: false,
      featurePermissions: { 'configure': 'AI_Settings_Admin:update' },
      configurability: { view: {}, edit: {} },
      fields: {},
    },
    private: {
      configurability: {
        view: { '*': 'configure' },
        edit: { '*': 'configure' },
      },
      fields: {
        'path': { type: 'string', label: 'Database Path' },
        'walMode': { type: 'boolean', label: 'WAL Mode' },
        'busyTimeout': { type: 'number', label: 'Busy Timeout (ms)' },
      },
    },
  },
  status: 'active',
  createdAt: '2024-01-01',
}
```

#### A/B Test Feature with Rollout

```typescript
{
  id: 'enhanced-search',
  enabled: true,
  requires: ['search-service', 'embeddings-api'],
  rollout: {
    experimentId: 'search-semantic-2024-q2',
    variants: [
      { id: 'control', weight: 1 },
      { id: 'semantic', weight: 2 },
    ],
  },
  status: 'active',
  createdAt: '2024-06-01',
  expiresAt: '2024-09-01',
}
```

---

### Summary

| Concept | Location | Description |
|---------|----------|-------------|
| Feature identity | `id` | Unique kebab-case identifier |
| Runtime toggle | `enabled` | Boolean, default true |
| Lifecycle | `status` | active/deprecated/removed |
| Dependencies | `requires` | Array of feature IDs (flat registry, graph via edges) |
| Client config | `config.public` | Sent to client, user-editable |
| Server config | `config.private` | Never sent to client |
| Permission vocabulary | `meta.public.featurePermissions` | Feature permissions to RCX permissions |
| A/B testing | `rollout.variants` | Weight-based, pre-computed at login |
| Computed state | `meta.state` | enabled, blockedBy, optional, deprecationWarning |
| Env overrides | `FEATURE_<ID>__<PATH>` | `__` for dots, `PRIVATE__` prefix for private |
