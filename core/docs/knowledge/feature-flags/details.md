# Feature Flag System

A unified feature registry for managing application capabilities with configuration, permissions, rollout, and UI metadata.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Core Data Model](#core-data-model)
3. [Feature Structure](#feature-structure)
4. [Enablement Model](#enablement-model)
5. [Dependencies](#dependencies)
6. [Configuration](#configuration)
7. [Metadata](#metadata)
8. [Feature Scoping](#feature-scoping) *(NEW)*
9. [Permission System](#permission-system) *(NEW)*
10. [Runtime Introspection](#runtime-introspection) *(NEW)*
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

## Philosophy

### Core Principles

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

## Core Data Model

### Path Encoding Convention

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
- Encode: `agents.default.model` → `AGENTS__DEFAULT__MODEL`
- Decode: `AGENTS__DEFAULT__MODEL` → `agents.default.model`

### TypeScript Interfaces

```typescript
/**
 * Permission set from RCX API - CRUD booleans for each permission.
 * For feature ACL, only `read` and `update` are used:
 * - `read` → can view the field
 * - `update` → can edit the field
 * - `create` and `delete` are reserved for future use
 */
interface PermissionSet {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * User's permissions map
 */
type UserPermissions = Record<string, PermissionSet>;

/**
 * Field schema for UI rendering
 */
interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json' | 'password';
  label: string;
  description?: string;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;  // For select/multiselect
  validation?: {
    required?: boolean;
    min?: number;           // For numbers
    max?: number;           // For numbers
    minLength?: number;     // For strings
    maxLength?: number;     // For strings
    pattern?: string;       // Regex for strings
  };
}

/**
 * Configurability - controls who can view/edit feature settings.
 * Maps field paths to FEATURE permission names (not RCX permissions).
 * These feature permissions are translated via featurePermissions.
 *
 * Empty object `{}` means NO access (not "unrestricted").
 * Use `{ '*': 'use' }` for default access.
 */
interface Configurability {
  view: Record<string, string>;   // path pattern → feature permission name
  edit: Record<string, string>;   // path pattern → feature permission name
}

/**
 * Feature permissions - the feature's own permission vocabulary.
 * Maps logical permission names to RCX permission strings.
 * Format: 'RCX_Permission_Name:operation' where operation is create|read|update|delete
 *
 * At load time, these are auto-prefixed with the feature ID:
 * 'use' → 'openai-integration:use'
 *
 * This abstraction allows:
 * 1. Features to think in their own terms ('use', 'configure', 'export')
 * 2. Cross-feature permission checks ('audit-logs:view')
 * 3. Swapping the entire permission backend by just changing this mapping
 */
type FeaturePermissions = Record<string, string>;

/**
 * Reason why a feature is blocked
 */
type BlockedReason = 'removed' | 'disabled' | 'dependency' | 'cycle';

/**
 * Computed state sent to client (avoids client-side graph logic)
 */
interface ComputedState {
  enabled: boolean;              // Final enabled state (lifecycle + toggle + deps)
  blockedBy?: string[];          // Feature IDs that are blocking this feature
  blockedByReason?: Record<string, BlockedReason>;  // Why each blocker is blocking
  optional: boolean;             // True if nothing requires this feature
  deprecationWarning?: string;   // Set if this or any dependency is deprecated
}

/**
 * Metadata for public configuration.
 * This is sent to the client for UI rendering.
 */
interface PublicMeta {
  name: string;                              // Human-readable feature name
  description: string;                       // What this feature does
  icon?: string;                             // Icon identifier (e.g., 'shield', 'bot')
  category?: string;                         // UI grouping (e.g., 'AI & Models', 'Security')
  variant?: string;                          // Pre-computed variant from rollout (set at login)
  state?: ComputedState;                     // Computed enablement state (set at login)
  configurability: Configurability;          // Who can view/edit settings (uses feature permissions)
  featurePermissions: FeaturePermissions;    // Feature's permission vocabulary → RCX permissions
  fields: Record<string, FieldSchema>;       // UI field definitions, keyed by config path
  exposeToClient?: boolean;                  // Default true. Set false to exclude from client bundle.
}

/**
 * Metadata for private configuration.
 * This is only used server-side or by admin interfaces.
 */
interface PrivateMeta {
  configurability: Configurability;          // Who can view/edit private settings
  featurePermissions?: FeaturePermissions;   // Additional private-only permissions (optional)
  fields: Record<string, FieldSchema>;       // Field definitions for private config
}

/**
 * Rollout variant definition
 */
interface Variant {
  id: string;        // Variant identifier (e.g., 'control', 'treatment-a')
  weight?: number;   // Relative weight, defaults to 1. NOT a percentage.
}

/**
 * Rollout configuration for A/B testing
 */
interface RolloutConfig {
  experimentId?: string;         // Salt for hash. Change to reset allocations without changing feature id.
  variants: Variant[];
}

/**
 * Feature lifecycle status.
 *
 * IMPORTANT: This is about the feature's lifecycle, NOT whether it's turned on.
 * - `active`: Feature is live and supported
 * - `deprecated`: Still works but being phased out (shows warning, still counts as enabled for deps)
 * - `removed`: No longer functional (disabled, hidden from UI)
 */
type FeatureStatus = 'active' | 'deprecated' | 'removed';

/**
 * Complete Feature definition
 */
interface Feature<TPublic = Record<string, unknown>, TPrivate = Record<string, unknown>> {
  // === Identity ===
  id: string;                    // Unique identifier, kebab-case (e.g., 'streaming-chat')

  // === Enablement ===
  enabled?: boolean;             // Runtime toggle. Default true. Can be changed at runtime.

  // === Dependencies ===
  requires?: string[];           // Array of feature IDs this depends on

  // === Configuration ===
  config: {
    public?: TPublic;            // Client-visible configuration values
    private?: TPrivate;          // Server-only configuration values
  };

  // === Metadata ===
  meta: {
    public: PublicMeta;          // Metadata for public config (always sent to client)
    private?: PrivateMeta;       // Metadata for private config (admin-only)
  };

  // === Rollout ===
  rollout?: RolloutConfig;       // A/B test configuration (server-side only)

  // === Lifecycle ===
  status: FeatureStatus;
  createdAt: string;             // ISO 8601 date string
  expiresAt?: string;            // Optional expiration date (ISO 8601)
}

/**
 * The feature registry - a flat map of feature ID to Feature
 */
type FeatureRegistry = Record<string, Feature>;

/**
 * What gets sent to the client for a single feature.
 * Note: config.private, meta.private, and rollout are stripped.
 * Computed state is injected into meta.
 */
interface ClientFeature {
  id: string;
  enabled: boolean;                           // Resolved enabled state
  requires?: string[];
  config: Record<string, unknown>;            // Just the public config values
  meta: PublicMeta;                           // Includes pre-computed variant and state
  status: FeatureStatus;
}

/**
 * What gets sent to the client at login
 */
interface ClientFeatureBundle {
  features: Record<string, ClientFeature>;
}
```

---

## Feature Structure

### Top-Level Fields

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

### Naming Conventions

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

## Enablement Model

### Three-Layer Enablement

A feature's final "enabled" state is determined by three independent factors:

| Layer | Field | Meaning | Can Change At Runtime? |
|-------|-------|---------|------------------------|
| **Lifecycle** | `status` | Is the feature live? (`active`/`deprecated` = yes, `removed` = no) | Rarely (deploy) |
| **Toggle** | `enabled` | Is the feature turned on? | Yes (admin action) |
| **Dependencies** | computed | Are all required features enabled? | Indirectly |

### Enablement Resolution

```typescript
/**
 * Compute whether a feature is enabled.
 * All three layers must pass.
 * Returns both blockers and reasons for auditability.
 */
function computeEnabled(
  featureId: string,
  registry: FeatureRegistry,
  visited: Set<string> = new Set()
): { enabled: boolean; blockedBy: string[]; blockedByReason: Record<string, BlockedReason> } {
  const feature = registry[featureId];
  const blockedBy: string[] = [];
  const blockedByReason: Record<string, BlockedReason> = {};

  // Layer 1: Lifecycle
  // "removed" means disabled. "deprecated" still counts as enabled (with warning).
  if (!feature || feature.status === 'removed') {
    blockedBy.push('self');
    blockedByReason['self'] = 'removed';
    return { enabled: false, blockedBy, blockedByReason };
  }

  // Layer 2: Toggle
  if (feature.enabled === false) {
    blockedBy.push('self');
    blockedByReason['self'] = 'disabled';
    return { enabled: false, blockedBy, blockedByReason };
  }

  // Layer 3: Dependencies (with cycle detection)
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
      // Propagate the root cause, or mark as dependency
      if (depResult.blockedByReason['self']) {
        blockedByReason[depId] = depResult.blockedByReason['self'];
      } else {
        blockedByReason[depId] = 'dependency';  // Blocked by transitive dep
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

### Deprecation Semantics

- **`deprecated` counts as enabled** for dependency purposes
- Dependents continue to work when a dependency is deprecated
- Deprecation triggers UI warnings but doesn't break functionality
- Only `removed` or `enabled: false` disables a feature

---

## Dependencies

### How Dependencies Work

Dependencies create a directed acyclic graph (DAG). Features declare what they require via the `requires` array.

```typescript
const registry: FeatureRegistry = {
  'http-server': {
    id: 'http-server',
    requires: [],  // No dependencies - this feature is independent
    // ...
  },

  'websocket': {
    id: 'websocket',
    requires: ['http-server'],  // Depends on http-server
    // ...
  },

  'streaming-chat': {
    id: 'streaming-chat',
    requires: ['websocket', 'openai-integration'],  // Multiple dependencies
    // ...
  },
};
```

### Important: No Hierarchy

A feature with `requires: []` is NOT a "root" - there is no tree. It simply has no dependencies:

```typescript
// Has no dependencies, but many features depend on it
'http-server': { requires: [] }

// Has no dependencies, and nothing depends on it (a "freebird")
'fab-button': { requires: [] }
```

### Computed Properties

These properties are NOT stored - they are computed from the graph:

```typescript
/**
 * Check if a feature is optional (nothing requires it)
 */
function isOptional(featureId: string, registry: FeatureRegistry): boolean {
  for (const feature of Object.values(registry)) {
    if (feature.requires?.includes(featureId)) {
      return false;
    }
  }
  return true;
}

/**
 * Get all transitive dependencies for a feature
 */
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

/**
 * Get all features that depend on this one (reverse dependencies)
 */
function getDependents(featureId: string, registry: FeatureRegistry): string[] {
  const dependents: string[] = [];

  for (const [id, feature] of Object.entries(registry)) {
    if (feature.requires?.includes(featureId)) {
      dependents.push(id);
    }
  }

  return dependents;
}

/**
 * Topological sort - returns features in dependency order
 */
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

/**
 * Check for deprecation warnings in dependency chain
 */
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

## Configuration

### Public vs Private

| Aspect | `config.public` | `config.private` |
|--------|-----------------|------------------|
| Sent to client | Yes | **Never** |
| Editable by users | Yes (with configurability) | No |
| Editable by admins | Yes | Yes (via separate admin API) |
| Visible in UI | Yes | Only in admin tools |
| Use case | User preferences, toggles | API keys, internal limits |

### Example

```typescript
{
  id: 'openai-integration',
  enabled: true,  // Runtime toggle
  config: {
    public: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4096,
    },
    private: {
      apiKey: 'sk-...',
      rateLimitPerMinute: 100,
      orgId: 'org-...',
    },
  },
  meta: {
    public: {
      name: 'OpenAI Integration',
      description: 'Connect to OpenAI models for AI capabilities',
      icon: 'bot',
      category: 'AI & Models',
      // Feature's permission vocabulary → RCX permissions
      featurePermissions: {
        'use': 'AI_Integration_Models:read',
        'configure': 'AI_Settings_Admin:update',
        'tuneTemperature': 'AI_Integration_Models:update'
      },
      // Who can view/edit settings (uses feature permission names)
      configurability: {
        view: { '*': 'use' },
        edit: { '*': 'configure', 'temperature': 'tuneTemperature' },
      },
      fields: {
        'model': {
          type: 'select',
          label: 'Model',
          options: [
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          ],
        },
        'temperature': {
          type: 'number',
          label: 'Temperature',
          description: 'Controls randomness. Lower is more deterministic.',
          validation: { min: 0, max: 2 },
        },
        'maxTokens': {
          type: 'number',
          label: 'Max Tokens',
          validation: { min: 1, max: 128000 },
        },
      },
    },
    private: {
      // Private config uses same featurePermissions from public meta
      configurability: {
        view: { '*': 'configure' },
        edit: { '*': 'configure' },
      },
      fields: {
        'apiKey': {
          type: 'password',
          label: 'API Key',
          description: 'Your OpenAI API key',
        },
        'rateLimitPerMinute': {
          type: 'number',
          label: 'Rate Limit (per minute)',
          validation: { min: 1, max: 10000 },
        },
      },
    },
  },
  status: 'active',
  createdAt: '2024-01-01',
}
```

---

## Metadata

### Public Metadata (`meta.public`)

Always sent to the client (unless `exposeToClient: false`). Contains everything needed to render the feature in the UI.

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Human-readable feature name |
| `description` | Yes | - | What this feature does |
| `icon` | No | - | Icon identifier for UI |
| `category` | No | - | UI grouping category |
| `variant` | No | - | Pre-computed variant from rollout (set at login) |
| `state` | No | - | Computed enablement state (set at login) |
| `configurability` | Yes | - | Who can view/edit settings (uses feature permission names) |
| `featurePermissions` | Yes | - | Feature's permission vocabulary → RCX permission mapping |
| `fields` | Yes | - | Field schemas for UI rendering |
| `exposeToClient` | No | `true` | Set `false` to exclude from client bundle |

### Private Metadata (`meta.private`)

Only used server-side or in admin interfaces. Contains field definitions and configurability for private config.

| Field | Required | Description |
|-------|----------|-------------|
| `configurability` | Yes | Who can view/edit private settings |
| `featurePermissions` | No | Additional private-only permissions |
| `fields` | Yes | Field schemas for private config |

### Field Schema

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

**Type to value mapping for env var parsing:**

| Schema Type | Env Value Type | Example |
|-------------|---------------|---------|
| `string` | string | `hello` |
| `password` | string | `secret123` |
| `number` | number | `42` |
| `boolean` | boolean | `true` or `false` |
| `select` | string | `gpt-4` |
| `multiselect` | JSON array | `["a","b","c"]` |
| `json` | JSON object or array | `{"key":"value"}` |

---

## Feature Scoping

### The `feature()` Function

All feature code is wrapped in `feature()` scopes. This is the core mechanism for:
- **Traceability** - Know exactly what code belongs to what feature
- **Permission scoping** - `hasPermission()` auto-prefixes with feature ID
- **Disable handling** - Features decide their own disable behavior
- **Runtime introspection** - Features self-register for reporting

### Basic Usage

```typescript
import { feature } from './lib/features';

// Wrap feature code in a scope
feature('audit-logs', (scope) => {
  // scope.disabled - is this feature turned off?
  // scope.hasPermission('action') - check permission (auto-prefixed)
  // scope.config - the feature's config values
  // scope.meta - the feature's metadata

  if (scope.disabled) {
    return { message: 'Audit logging is currently disabled' };
  }

  if (!scope.hasPermission('view')) {
    return { error: 'Permission denied' };
  }

  return getAuditLogs();
});
```

### Why `feature()` Instead of `featureScope()`?

| Option | Chars | Grep-ability | Cognitive Load |
|--------|-------|--------------|----------------|
| `featureScope()` | 12 | Excellent | Higher |
| `feature()` | 7 | Poor (common word) | **Low** |

We use `feature()` because:
1. **Natural language**: `feature('audit-logs', scope => ...)` reads as "this is the audit-logs feature"
2. **Low cognitive load**: It's just a function wrapper
3. **Runtime introspection solves grep-ability**: Every `feature()` call self-registers (see [Runtime Introspection](#runtime-introspection))

### The Scope Object

The scope object passed to your callback provides:

```typescript
interface FeatureScope {
  // Identity
  id: string;                    // Feature ID

  // State
  disabled: boolean;             // Is this feature turned off?
  isEnabled(): boolean;          // Cleaner: !disabled

  // Configuration access
  config: Record<string, any>;   // Raw feature's config.public values
  getPublicConfig<T>(path?: string): T | undefined;   // Typed config access
  getPrivateConfig<T>(path?: string): T | undefined;  // Server-side only

  // Metadata
  meta: PublicMeta;              // Feature's metadata

  // Permissions (auto-prefixes with feature ID)
  hasPermission(action: string): boolean;
  hasPermission(fullPermission: string): boolean;  // e.g., 'other-feature:action'

  // Logging (with feature context)
  log(message: string, level?: 'debug' | 'info' | 'warn' | 'error'): void;
}
```

**Config access examples:**

```typescript
feature('code-execution', (scope) => {
  // Get entire public config
  const config = scope.getPublicConfig();  // { maxTime: 30, languages: [...] }

  // Get specific value with type
  const maxTime = scope.getPublicConfig<number>('maxTime');  // 30

  // Get nested value
  const model = scope.getPublicConfig<string>('agents.default.model');

  // Server-side only: get private config
  const apiKey = scope.getPrivateConfig<string>('sandboxApiKey');
});
```

### Disable Behavior is Code

What happens when a feature is disabled is **Turing-complete** - the feature code decides:

```typescript
feature('premium-search', (scope) => {
  if (scope.disabled) {
    // Could return nothing
    // Could show a message
    // Could fall back to basic search
    // Could check upgrade permissions
    // ANYTHING - it's code!

    if (scope.hasPermission('trial')) {
      return { limitedResults: basicSearch(query).slice(0, 5) };
    }
    return { message: 'Premium search is not available in your plan' };
  }

  return fullPremiumSearch(query);
});
```

This keeps disable logic:
- **Self-contained** in the feature
- **Testable** via unit tests
- **Flexible** - no config-based disable mode limitations

### Cross-Feature Scoping

Features can scope into other features to check their state:

```typescript
feature('audit-logs', (scope) => {
  function logAction(action: string) {
    // Check another feature's permission (full namespace required)
    if (scope.hasPermission('pii-redaction:redact')) {
      action = redactPII(action);
    }
    saveToAuditLog(action);
  }

  // Scope into another feature
  feature('notifications', (notifyScope) => {
    if (!notifyScope.disabled && notifyScope.hasPermission('send')) {
      notifyAdmins('Audit log entry created');
    }
  });
});
```

This creates **detectable dependencies** - the introspection system can see that `audit-logs` interacts with `pii-redaction` and `notifications`.

### Async Scope Support

Feature scopes fully support async functions:

```typescript
feature('data-export', async (scope) => {
  if (!scope.isEnabled()) {
    return { error: 'Export feature is disabled' };
  }

  const data = await fetchLargeDataset();
  const result = await processData(data);

  scope.log('Export completed', 'info');
  return result;
});
```

### Higher-Order Function Pattern

For functional code, use `feature.wrap()`:

```typescript
// Wrap a named function - auto-registers at module load
export const processStream = feature.wrap('streaming-responses',
  async function processStream(input: StreamInput) {
    // Function is wrapped in feature scope
    // 'this' is the scope object
    if (this.disabled) return fallback(input);
    return doProcessing(input);
  }
);

// Usage - scope is implicit
const result = await processStream(myInput);
```

### MCP Tool Integration Pattern

MCP tools use feature scopes at registration time:

```typescript
// tools/sandbox/index.ts
import { feature } from '../../lib/features';

export function register(server: McpServer, sdk: SDK) {
  feature('rcx-tools-code-execution', (scope) => {
    // Feature-level disable: don't register the tool at all
    if (!scope.isEnabled()) {
      scope.log('Tool not registered - feature disabled', 'info');
      return;
    }

    // Check if we have required config
    const apiKey = scope.getPrivateConfig<string>('sandboxApiKey');
    if (!apiKey) {
      scope.log('Tool not registered - missing API key', 'warn');
      return;
    }

    // Register the tool with feature-scoped handler
    server.tool(
      'run_code',
      scope.meta.description,
      { code: z.string(), language: z.string() },
      async (params) => {
        // Permission check at execution time
        if (!scope.hasPermission('execute')) {
          return { content: [{ type: 'text', text: 'Permission denied' }] };
        }

        // Get config from feature registry
        const maxTime = scope.getPublicConfig<number>('maxExecutionTime') ?? 30;
        const languages = scope.getPublicConfig<string[]>('supportedLanguages') ?? [];

        if (!languages.includes(params.language)) {
          return { content: [{ type: 'text', text: `Language not enabled: ${params.language}` }] };
        }

        scope.log(`Executing ${params.language} code`, 'debug');

        // Execute with feature config
        const sandbox = await Sandbox.create({
          template: LANGUAGE_CONFIG[params.language].template,
          apiKey,
          timeout: maxTime * 1000
        });

        try {
          const result = await sandbox.runCode(params.code);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } finally {
          await sandbox.kill();
        }
      }
    );
  });
}
```

**Key patterns:**
1. **Early exit if disabled** - Don't register the tool at all
2. **Config from registry** - Use `scope.getPrivateConfig()` not raw env vars
3. **Permission checks** - Use `scope.hasPermission()` at execution time
4. **Feature-scoped logging** - Use `scope.log()` for traceability

### Decorators (Not Recommended)

While TypeScript decorators could technically be used (`@featureScope('id')`), they are **not recommended** because:
- Decorators add "magic" that obscures control flow
- HOF patterns (`feature()`, `feature.wrap()`) work everywhere
- Decorators require experimental TypeScript flags
- Testing is easier with explicit function wrapping

Use HOF patterns exclusively unless there's a compelling reason for decorators.

---

## Permission System

### Two-Layer Permission Model

Permissions have two layers:

1. **Feature Permissions** - Logical, feature-specific vocabulary (`'use'`, `'configure'`, `'export'`)
2. **RCX Permissions** - Actual permission system (`'AI_Governance:read'`, `'AI_Settings_Admin:update'`)

Features think in their own terms. Translation happens once, in `featurePermissions`.

### Feature Definition Example

```typescript
{
  id: 'openai-integration',
  meta: {
    public: {
      // What permissions are needed to configure settings
      configurability: {
        view: { '*': 'use' },           // Need 'use' permission to view settings
        edit: { '*': 'configure' }       // Need 'configure' permission to edit
      },

      // Feature's permission vocabulary → RCX permissions
      featurePermissions: {
        'use': 'AI_Integration_Models:read',
        'configure': 'AI_Settings_Admin:update',
        'switchModel': 'AI_Integration_Models:update'
      }
    }
  }
}
```

### Auto-Prefixing at Load Time

At feature load time, permissions are auto-prefixed with the feature ID:

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

This enables:
- **Cross-feature checks**: `hasPermission('audit-logs:export')`
- **Detectable dependencies**: Introspection can find all cross-feature permission checks
- **No collisions**: `'use'` in feature A doesn't conflict with `'use'` in feature B

### The `hasPermission()` Function

Within a feature scope, `hasPermission()` auto-prefixes:

```typescript
feature('openai-integration', (scope) => {
  // These are equivalent:
  scope.hasPermission('use')                      // Auto-prefixed
  scope.hasPermission('openai-integration:use')   // Explicit

  // Check another feature's permission:
  scope.hasPermission('audit-logs:export')        // Must be explicit
});
```

### sdk.hasPermission() - Global Access

Outside of feature scopes, use `sdk.hasPermission()`:

```typescript
// The SDK is initialized at boot with user context
const sdk = await setup(userContext);

// Anywhere in code - must use full namespace
sdk.hasPermission('openai-integration:use')
sdk.hasPermission('audit-logs:export')
```

For unit tests, mock the SDK:

```typescript
const mockSdk = createMockSdk({
  permissions: {
    'openai-integration:use': true,
    'audit-logs:view': false
  }
});
```

### Why This Architecture?

1. **Swappable permission backend** - Change `featurePermissions` mappings, not feature code
2. **Clean feature code** - Features use `'use'`, not `'AI_Integration_Models:read'`
3. **Traceable dependencies** - Cross-feature permission checks are visible
4. **No permission bile leakage** - RCX permission strings stay in one place

---

## Runtime Introspection

### Self-Registering Features

Every `feature()` call registers itself at runtime:

```typescript
// When this runs:
feature('audit-logs', (scope) => { ... });

// The registry records:
{
  'audit-logs': {
    callSites: [
      { file: 'src/logs/handler.ts', line: 42, function: 'getAuditLogs' },
      { file: 'src/sidebar.tsx', line: 15, function: 'Sidebar' }
    ],
    lastCalled: '2024-01-11T14:32:00Z',
    callCount: 847,
    dependencies: ['pii-redaction', 'notifications'],  // Detected from nested feature() calls
    permissionChecks: ['audit-logs:view', 'pii-redaction:redact']  // All hasPermission() calls
  }
}
```

### No Grep Needed

Instead of `grep -r "feature(" src/`, use the introspection API:

```typescript
// Get all registered features
const registry = sdk.features.getIntrospection();

// How many features are in use?
console.log(Object.keys(registry).length);

// What code uses audit-logs?
console.log(registry['audit-logs'].callSites);

// What does audit-logs depend on?
console.log(registry['audit-logs'].dependencies);

// What permissions does it check?
console.log(registry['audit-logs'].permissionChecks);
```

### API Endpoint

```http
GET /api/features/introspect
Authorization: Bearer <admin-token>

{
  "features": {
    "audit-logs": {
      "defined": true,         // Exists in feature registry
      "usedInCode": true,      // Has feature() calls
      "callSites": [...],
      "callCount": 847,
      "dependencies": ["pii-redaction", "notifications"],
      "permissionChecks": ["audit-logs:view", "pii-redaction:redact"]
    },
    "streaming-responses": {
      "defined": true,
      "usedInCode": true,
      "callSites": [...],
      ...
    }
  },
  "stats": {
    "totalFeatures": 15,
    "featuresWithCode": 12,     // Have feature() calls
    "orphanedFeatures": 3,      // Defined but no code
    "undefinedScopes": 0        // feature() calls with no definition (bug!)
  }
}
```

### Coverage Reporting

Track feature-flagged vs unflagged code:

```typescript
// In development mode, capture stack traces
const introspection = sdk.features.getIntrospection();

// Generate report
console.log(`
Feature Coverage Report:
- Features defined: ${introspection.stats.totalFeatures}
- Features with code: ${introspection.stats.featuresWithCode}
- Orphaned definitions: ${introspection.stats.orphanedFeatures}
- Undefined scopes: ${introspection.stats.undefinedScopes} (should be 0!)

Top features by call count:
${Object.entries(introspection.features)
  .sort((a, b) => b[1].callCount - a[1].callCount)
  .slice(0, 5)
  .map(([id, data]) => `  ${id}: ${data.callCount} calls`)
  .join('\n')}
`);
```

### How Introspection Works

1. **Development mode**: Capture stack traces via `new Error().stack` on each `feature()` call
2. **Runtime**: Track call counts, timing, and nested `feature()` calls
3. **Permission tracking**: Record all `hasPermission()` calls for dependency detection
4. **Near-instant**: All data is in-memory, no file scanning

---

## Configurability (Settings ACL)

### What is Configurability?

`configurability` controls who can view and edit feature settings in the UI. It uses **feature permission names** (not RCX permissions directly).

```typescript
configurability: {
  view: { '*': 'use' },           // Need 'use' permission to view settings
  edit: { '*': 'configure' }       // Need 'configure' permission to edit
}
```

The actual RCX permission lookup happens via `featurePermissions`:

```typescript
featurePermissions: {
  'use': 'AI_Integration_Models:read',
  'configure': 'AI_Settings_Admin:update'
}
```

### Pattern Matching

Configurability supports wildcard patterns for field paths:

```typescript
configurability: {
  view: {
    '*': 'use',                          // Default: need 'use' to view
    'advanced.*': 'configure',            // Advanced fields need 'configure'
  },
  edit: {
    '*': 'configure',                     // Default: need 'configure' to edit
    'model': 'use',                       // But 'model' field only needs 'use'
  },
}
```

### Pattern Specificity

When multiple patterns match, the most specific wins:

1. **Exact match** beats any wildcard
2. **More literal segments** beats fewer
3. **Fewer wildcards** beats more
4. **Deeper paths** beats shallower (tiebreaker)

### Wildcard Reference

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `*` | All paths | - |
| `timeout` | Only `timeout` | `timeout.max` |
| `agents.*` | `agents.default`, `agents.custom` | `agents.default.model` |
| `agents.**` | `agents.default`, `agents.default.model`, `agents.x.y.z` | `timeout` |

### Permission Resolution Flow

```
1. Field path: 'agents.default.model'
2. Match configurability pattern: '*' → 'use'
3. Prefix with feature ID: 'openai-integration:use'
4. Look up in featurePermissions: 'AI_Integration_Models:read'
5. Check user's RCX permissions: aiPermissions['AI_Integration_Models'].read === true
```

### Check Functions

```typescript
function canViewSetting(
  featureId: string,
  fieldPath: string,
  userPermissions: UserPermissions
): boolean {
  const feature = featureRegistry.get(featureId);
  if (!feature) return false;

  // 1. Match pattern to get feature permission name
  const featurePerm = matchPattern(fieldPath, feature.meta.public.configurability.view);
  if (!featurePerm) return false;

  // 2. Prefix and look up RCX permission
  const fullPerm = `${featureId}:${featurePerm}`;
  const rcxPerm = feature.meta.public.featurePermissions[featurePerm];
  if (!rcxPerm) return false;

  // 3. Parse and check
  const [permName, operation] = rcxPerm.split(':');
  return userPermissions[permName]?.[operation] === true;
}
```

---

## Rollout & Variants

### How Rollout Works

Rollout enables A/B testing by assigning users to variants. The assignment is:
1. **Deterministic** - Same user always gets same variant for same feature (unless experimentId changes)
2. **Pre-computed** - Calculated at login, not at runtime
3. **Server-side** - The `rollout` config is never sent to client, only the resolved `variant`

### Variant Definition

```typescript
rollout: {
  experimentId: 'search-v2-2024',  // Optional salt. Change to reset allocations.
  variants: [
    { id: 'control', weight: 1 },      // Weight 1
    { id: 'treatment-a', weight: 2 },  // Weight 2 (2x more likely)
    { id: 'treatment-b', weight: 1 },  // Weight 1
  ],
}
// Total weight = 4
// control: 1/4 = 25%
// treatment-a: 2/4 = 50%
// treatment-b: 1/4 = 25%
```

### Stability Guarantee

Variant assignment is stable as long as:
- `experimentId` doesn't change (or remains undefined)
- `variants` array doesn't change
- User ID doesn't change

To reset allocations for a new experiment round, change `experimentId`.

### Variant Assignment Algorithm

Uses consistent hashing:

```typescript
import crypto from 'crypto';

function computeVariant(
  userId: string,
  featureId: string,
  rollout: RolloutConfig
): string {
  const { variants, experimentId } = rollout;

  if (!variants || variants.length === 0) {
    return 'default';
  }

  if (variants.length === 1) {
    return variants[0].id;
  }

  // Include experimentId in hash for allocation reset capability
  const salt = experimentId ?? featureId;
  const hash = crypto
    .createHash('md5')
    .update(`${userId}:${salt}`)
    .digest('hex');

  // Convert first 8 hex chars to number, mod 10000 for precision
  const bucket = parseInt(hash.substring(0, 8), 16) % 10000;

  // Calculate total weight
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);

  // Find which variant this bucket falls into
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += ((variant.weight ?? 1) / totalWeight) * 10000;
    if (bucket < cumulative) {
      return variant.id;
    }
  }

  return variants[variants.length - 1].id;
}
```

### Using Variants

The variant is pre-computed at login and stored in `meta.variant`:

```typescript
// What the client receives
{
  id: 'enhanced-search',
  config: { maxResults: 20 },
  meta: {
    name: 'Enhanced Search',
    variant: 'semantic',  // Pre-computed at login
    // ...
  },
}
```

Client-side usage:

```typescript
const variant = features['enhanced-search'].meta.variant;

if (variant === 'semantic') {
  // Use semantic search UI
} else {
  // Use classic search UI
}
```

---

## Environment Variable Overrides

### Overview

Environment variables can override feature config at runtime. This allows deployment-specific configuration without changing code.

### Naming Convention

```
FEATURE_<FEATURE_ID>__<PATH>=value              # Public config
FEATURE_<FEATURE_ID>__PRIVATE__<PATH>=value     # Private config
```

**Encoding rules:**
- Feature ID: kebab-case → SCREAMING_SNAKE (e.g., `openai-integration` → `OPENAI_INTEGRATION`)
- Path separator: `.` → `__` (double underscore)
- Path segments: camelCase → SCREAMING_SNAKE
- `PRIVATE__` prefix routes to `config.private`
- No prefix routes to `config.public` (default)

### Examples

```bash
# Feature: openai-integration
# Path: model (public)
FEATURE_OPENAI_INTEGRATION__MODEL=gpt-4-turbo

# Path: agents.default.model (nested public)
FEATURE_OPENAI_INTEGRATION__AGENTS__DEFAULT__MODEL=gpt-4

# Path: apiKey (private)
FEATURE_OPENAI_INTEGRATION__PRIVATE__API_KEY=sk-new-key

# Path: rateLimit.perMinute (nested private)
FEATURE_OPENAI_INTEGRATION__PRIVATE__RATE_LIMIT__PER_MINUTE=200
```

### JSON Values

For complex objects or arrays, pass JSON strings:

```bash
# Object value (for type: json)
FEATURE_AI_AGENTS__AGENTS='{"default":{"model":"gpt-4","temperature":0.7}}'

# Array value (for type: multiselect)
FEATURE_PII_REDACTION__CUSTOM_PATTERNS='["SSN-\\d{3}-\\d{2}-\\d{4}","ACCT-\\d+"]'
```

### Implementation

```typescript
/**
 * Decode SCREAMING_SNAKE to camelCase
 */
function snakeToCamel(s: string): string {
  return s.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Decode env var path to dot-separated config path
 * AGENTS__DEFAULT__MODEL → agents.default.model
 */
function decodeEnvPath(envPath: string): string {
  return envPath
    .split('__')
    .map(segment => snakeToCamel(segment))
    .join('.');
}

/**
 * Determine expected value type from field schema
 */
function getExpectedType(
  schema: FieldSchema | undefined
): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  if (!schema) return 'string';

  switch (schema.type) {
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'multiselect': return 'array';
    case 'json': return 'object';  // Could also be array; parse will detect
    case 'string':
    case 'password':
    case 'select':
    default:
      return 'string';
  }
}

/**
 * Parse an environment variable value based on expected type
 */
function parseEnvValue(value: string, expectedType: string): unknown {
  // For object/array types, parse as JSON
  if (expectedType === 'object' || expectedType === 'array') {
    try {
      const parsed = JSON.parse(value);
      if (expectedType === 'array' && !Array.isArray(parsed)) {
        throw new Error(`Expected array, got ${typeof parsed}`);
      }
      if (expectedType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed))) {
        throw new Error(`Expected object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
      }
      return parsed;
    } catch (e) {
      throw new Error(`Invalid JSON for ${expectedType}: ${value}`);
    }
  }

  // Boolean
  if (expectedType === 'boolean') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new Error(`Invalid boolean: ${value}`);
  }

  // Number
  if (expectedType === 'number') {
    const num = parseFloat(value);
    if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
    return num;
  }

  // String (default)
  return value;
}

/**
 * Set a value at a nested dot-path
 */
function setNestedValue(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Find feature by normalized ID (longest match wins to handle prefix collisions)
 */
function findFeatureByEnvId(
  normalizedId: string,
  registry: FeatureRegistry
): Feature | undefined {
  let bestMatch: Feature | undefined;
  let bestLength = 0;

  for (const feature of Object.values(registry)) {
    const featureNormalized = feature.id.toUpperCase().replace(/-/g, '_');

    // Check if normalizedId starts with this feature's normalized ID
    if (normalizedId === featureNormalized || normalizedId.startsWith(featureNormalized + '__')) {
      if (featureNormalized.length > bestLength) {
        bestMatch = feature;
        bestLength = featureNormalized.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Apply environment variable overrides to registry.
 * Called AFTER validation to ensure base registry is valid.
 *
 * SECURITY: Only allows overriding paths that exist in meta.fields.
 * This prevents env vars from creating arbitrary config paths.
 */
function applyEnvOverrides(registry: FeatureRegistry): void {
  const ENV_PREFIX = 'FEATURE_';
  const errors: string[] = [];

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(ENV_PREFIX) || value === undefined) continue;

    const remainder = key.substring(ENV_PREFIX.length);

    // Find matching feature
    const feature = findFeatureByEnvId(remainder, registry);
    if (!feature) {
      console.warn(`[feature-flags] No feature found for env var: ${key}`);
      continue;
    }

    // Extract path after feature ID
    const featureNormalized = feature.id.toUpperCase().replace(/-/g, '_');
    let pathPart = remainder.substring(featureNormalized.length);
    if (pathPart.startsWith('__')) pathPart = pathPart.substring(2);

    if (!pathPart) {
      console.warn(`[feature-flags] No path specified in env var: ${key}`);
      continue;
    }

    // Determine visibility
    let visibility: 'public' | 'private' = 'public';
    if (pathPart.startsWith('PRIVATE__')) {
      visibility = 'private';
      pathPart = pathPart.substring(9);
    }

    // Decode path
    const configPath = decodeEnvPath(pathPart);

    // Get target config
    const targetConfig = visibility === 'public'
      ? feature.config.public
      : feature.config.private;

    if (!targetConfig) {
      console.warn(`[feature-flags] No ${visibility} config for feature ${feature.id}`);
      continue;
    }

    // SECURITY: Validate that path exists in meta.fields
    // This prevents env vars from creating arbitrary config paths
    const meta = visibility === 'public' ? feature.meta.public : feature.meta.private;
    const fieldSchema = meta?.fields?.[configPath];

    if (!fieldSchema) {
      errors.push(`${key} targets undefined field: ${feature.id}.config.${visibility}.${configPath}`);
      continue;
    }

    // Get expected type from schema
    const expectedType = getExpectedType(fieldSchema);

    // Parse and apply
    try {
      const parsedValue = parseEnvValue(value, expectedType);
      setNestedValue(targetConfig as Record<string, unknown>, configPath, parsedValue);
      console.log(`[feature-flags] Applied: ${key} → ${feature.id}.config.${visibility}.${configPath}`);
    } catch (e) {
      errors.push(`${key}: ${e}`);
    }
  }

  // Fail fast on any invalid env overrides
  if (errors.length > 0) {
    throw new Error(
      `[feature-flags] Invalid environment overrides:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}
```

---

## Lifecycle Management

### Status Values

| Status | Meaning | Enabled for deps? | UI Behavior |
|--------|---------|-------------------|-------------|
| `active` | Feature is live and supported | Yes | Normal display |
| `deprecated` | Still works but being phased out | **Yes** | Warning badge, sunset date |
| `removed` | No longer functional | No | Hidden, errors if accessed |

### Expiration

Features can have optional expiration dates for temporary experiments:

```typescript
{
  id: 'holiday-promo-2024',
  status: 'active',
  createdAt: '2024-11-01',
  expiresAt: '2025-01-15',  // Auto-deprecate after this date
}
```

### Expiration Check

Run at startup and periodically:

```typescript
function checkExpirations(registry: FeatureRegistry): void {
  const now = new Date();

  for (const feature of Object.values(registry)) {
    if (feature.expiresAt && feature.status === 'active') {
      const expirationDate = new Date(feature.expiresAt);
      if (expirationDate < now) {
        feature.status = 'deprecated';
        console.log(`[feature-flags] Feature ${feature.id} expired, marked deprecated`);
      }
    }
  }
}
```

---

## Client Bundle

### What Gets Sent

The client bundle includes:
- `id`, `enabled` (computed), `requires`, `status`
- `config` (public only)
- `meta` (public only, with computed `variant` and `state`)

Excluded:
- `config.private`
- `meta.private`
- `rollout` (only the resolved `variant` is sent)
- Features with `meta.public.exposeToClient === false`
- Features with `status === 'removed'`

### Computed State

The `meta.state` field is computed at login to avoid client-side graph logic:

```typescript
interface ComputedState {
  enabled: boolean;           // Final enabled state
  blockedBy?: string[];       // What's blocking this feature
  blockedByReason?: Record<string, BlockedReason>;  // Why each is blocking
  optional: boolean;          // True if nothing requires this
  deprecationWarning?: string; // Warning if deprecated
}

// Example state for a blocked feature:
{
  enabled: false,
  blockedBy: ['openai-integration', 'self'],
  blockedByReason: {
    'openai-integration': 'disabled',  // Admin turned it off
    'self': 'dependency',              // This feature blocked by dep
  },
  optional: true,
  deprecationWarning: undefined,
}
```

### Bundle Preparation

```typescript
function prepareClientBundle(
  userId: string,
  registry: FeatureRegistry
): Record<string, ClientFeature> {
  const bundle: Record<string, ClientFeature> = {};

  for (const [id, feature] of Object.entries(registry)) {
    // Skip removed features
    if (feature.status === 'removed') continue;

    // Skip features not exposed to client
    if (feature.meta.public.exposeToClient === false) continue;

    // Compute enablement (now includes reasons)
    const { enabled, blockedBy, blockedByReason } = computeEnabled(id, registry);

    // Compute variant if rollout exists
    let variant: string | undefined;
    if (feature.rollout?.variants) {
      variant = computeVariant(userId, id, feature.rollout);
    }

    // Compute state with reasons for auditability
    const state: ComputedState = {
      enabled,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      blockedByReason: blockedBy.length > 0 ? blockedByReason : undefined,
      optional: isOptional(id, registry),
      deprecationWarning: getDeprecationWarning(id, registry),
    };

    // Build client feature
    bundle[id] = {
      id: feature.id,
      enabled,
      requires: feature.requires,
      config: feature.config.public ?? {},
      meta: {
        ...feature.meta.public,
        variant,
        state,
      },
      status: feature.status,
    };
  }

  return bundle;
}
```

---

## Validation

### Validation Guarantees

The registry loader MUST validate:

1. **ID consistency**: `feature.id === registryKey`
2. **No unknown dependencies**: All `requires` entries exist in registry
3. **No cycles**: Dependency graph is acyclic
4. **Valid rollout**: If `rollout` exists, `variants` is non-empty and weights are positive
5. **Schema-config alignment**: Every path in `meta.fields` exists in corresponding `config`
6. **Configurability has defaults**: Configurability objects are either empty (no access) or have `'*'` pattern
7. **Env override safety**: Environment variables can ONLY override paths defined in `meta.fields` - prevents injection of arbitrary config paths

### Validation Implementation

```typescript
interface ValidationError {
  featureId: string;
  field: string;
  message: string;
}

function validateRegistry(registry: FeatureRegistry): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [id, feature] of Object.entries(registry)) {
    // 1. ID consistency
    if (feature.id !== id) {
      errors.push({
        featureId: id,
        field: 'id',
        message: `ID mismatch: key="${id}", feature.id="${feature.id}"`,
      });
    }

    // 2. Unknown dependencies
    for (const depId of feature.requires ?? []) {
      if (!registry[depId]) {
        errors.push({
          featureId: id,
          field: 'requires',
          message: `Unknown dependency: "${depId}"`,
        });
      }
    }

    // 3. Rollout validation
    if (feature.rollout) {
      if (!feature.rollout.variants || feature.rollout.variants.length === 0) {
        errors.push({
          featureId: id,
          field: 'rollout.variants',
          message: 'Rollout defined but variants array is empty',
        });
      }
      for (const variant of feature.rollout.variants ?? []) {
        if (variant.weight !== undefined && variant.weight <= 0) {
          errors.push({
            featureId: id,
            field: 'rollout.variants',
            message: `Variant "${variant.id}" has non-positive weight: ${variant.weight}`,
          });
        }
      }
    }

    // 4. Schema-config alignment (public)
    if (feature.meta.public.fields && feature.config.public) {
      for (const fieldPath of Object.keys(feature.meta.public.fields)) {
        const value = getNestedValue(feature.config.public, fieldPath);
        if (value === undefined) {
          errors.push({
            featureId: id,
            field: `meta.public.fields.${fieldPath}`,
            message: `Field schema path does not exist in config.public`,
          });
        }
      }
    }

    // 5. Schema-config alignment (private)
    if (feature.meta.private?.fields && feature.config.private) {
      for (const fieldPath of Object.keys(feature.meta.private.fields)) {
        const value = getNestedValue(feature.config.private, fieldPath);
        if (value === undefined) {
          errors.push({
            featureId: id,
            field: `meta.private.fields.${fieldPath}`,
            message: `Field schema path does not exist in config.private`,
          });
        }
      }
    }
  }

  // 6. Cycle detection (separate pass)
  const cycleError = detectCycles(registry);
  if (cycleError) {
    errors.push({
      featureId: cycleError,
      field: 'requires',
      message: `Circular dependency detected`,
    });
  }

  return errors;
}

function detectCycles(registry: FeatureRegistry): string | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function visit(id: string): string | null {
    if (recursionStack.has(id)) return id;
    if (visited.has(id)) return null;

    visited.add(id);
    recursionStack.add(id);

    const feature = registry[id];
    for (const dep of feature?.requires ?? []) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }

    recursionStack.delete(id);
    return null;
  }

  for (const id of Object.keys(registry)) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }

  return null;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
```

---

## Implementation Guide

### File Structure

```
lib/
  features/
    types.ts              # TypeScript interfaces (from this doc)
    registry.ts           # FeatureRegistry class
    loader.ts             # Load features from JSON files
    validation.ts         # Validation functions
    resolver.ts           # Dependency resolution functions
    rollout.ts            # Variant computation
    env-overrides.ts      # Environment variable processing
    client-bundle.ts      # Prepare features for client
    configurability.ts    # Configurability pattern matching

config/
  features/
    index.json            # Feature registry (or split into files)
    infrastructure.json
    ai-models.json
    governance.json

ai/
  features/
    <feature-id>.md       # Feature documentation (one per feature)
```

### Feature Documentation

Each feature should have corresponding documentation in `ai/features/<feature-id>.md`. This documentation serves as the source of truth for:

- Feature purpose and architecture
- Current implementation details (files, line counts)
- Featurization status and plans
- Configuration options
- Dependencies
- Testing requirements
- Common issues and solutions

**Documentation Template:**

```markdown
# Feature: <feature-id>

> One-line description of what the feature does.

## Status

| Aspect | Value |
|--------|-------|
| **Current State** | Production (featurized) / Production (unfeaturized) / Development |
| **Feature Definition** | `src/features/<feature-id>.ts` or N/A |
| **Complexity** | Low / Medium / High |
| **Risk** | Low / Medium / High |

---

## Overview

Brief description of the feature's purpose and capabilities.

---

## Current Implementation

### Files

| File | Purpose | Lines |
|------|---------|-------|
| `path/to/file.ts` | Description | ~100 |

### How It Works

Technical explanation of the current implementation.

---

## Dependencies

List of required features (from `requires` array).

---

## Configuration Options

| Path | Type | Default | Description |
|------|------|---------|-------------|
| `configPath` | type | default | Description |

---

## Testing Plan

1. Test case 1
2. Test case 2

---

## References

- Links to external documentation
- Links to related internal docs
```

**When to create documentation:**

1. **New features** - Create doc when defining the feature
2. **Existing features** - Create doc during featurization planning
3. **Complex features** - Document architecture, common issues, debugging tips

**Naming convention:** `ai/features/<feature-id>.md` where `<feature-id>` matches the feature's `id` field exactly (kebab-case).

### Feature Registry Class

```typescript
import { Feature, FeatureRegistry, ClientFeature } from './types';
import { validateRegistry } from './validation';
import { computeVariant } from './rollout';
import { applyEnvOverrides } from './env-overrides';
import { computeEnabled, isOptional, getDeprecationWarning } from './resolver';

class FeatureRegistryManager {
  private features: Map<string, Feature> = new Map();
  private loaded = false;

  /**
   * Load features into the registry
   */
  load(features: FeatureRegistry): void {
    // Validate first
    const errors = validateRegistry(features);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `${e.featureId}.${e.field}: ${e.message}`);
      throw new Error(`Feature registry validation failed:\n${errorMessages.join('\n')}`);
    }

    // Register features
    for (const [id, feature] of Object.entries(features)) {
      this.features.set(id, feature);
    }

    // Check expirations
    this.checkExpirations();

    // Apply environment overrides (after validation)
    applyEnvOverrides(Object.fromEntries(this.features));

    this.loaded = true;
    console.log(`[feature-flags] Loaded ${this.features.size} features`);
  }

  /**
   * Check and apply expirations
   */
  private checkExpirations(): void {
    const now = new Date();
    for (const feature of this.features.values()) {
      if (feature.expiresAt && feature.status === 'active') {
        if (new Date(feature.expiresAt) < now) {
          feature.status = 'deprecated';
          console.log(`[feature-flags] Feature ${feature.id} expired, marked deprecated`);
        }
      }
    }
  }

  /**
   * Get a feature by ID
   */
  get(id: string): Feature | undefined {
    return this.features.get(id);
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(id: string): boolean {
    const registry = Object.fromEntries(this.features);
    return computeEnabled(id, registry).enabled;
  }

  /**
   * Get public config value
   */
  getPublicConfig<T>(featureId: string, path?: string): T | undefined {
    const feature = this.features.get(featureId);
    if (!feature?.config.public) return undefined;

    if (!path) return feature.config.public as T;
    return getNestedValue(feature.config.public, path) as T;
  }

  /**
   * Get private config value (server-side only)
   */
  getPrivateConfig<T>(featureId: string, path?: string): T | undefined {
    const feature = this.features.get(featureId);
    if (!feature?.config.private) return undefined;

    if (!path) return feature.config.private as T;
    return getNestedValue(feature.config.private, path) as T;
  }

  /**
   * Prepare client bundle for a user (called at login)
   */
  prepareClientBundle(userId: string): Record<string, ClientFeature> {
    const registry = Object.fromEntries(this.features);
    const bundle: Record<string, ClientFeature> = {};

    for (const [id, feature] of this.features) {
      if (feature.status === 'removed') continue;
      if (feature.meta.public.exposeToClient === false) continue;

      const { enabled, blockedBy, blockedByReason } = computeEnabled(id, registry);

      let variant: string | undefined;
      if (feature.rollout?.variants) {
        variant = computeVariant(userId, id, feature.rollout);
      }

      bundle[id] = {
        id: feature.id,
        enabled,
        requires: feature.requires,
        config: feature.config.public ?? {},
        meta: {
          ...feature.meta.public,
          variant,
          state: {
            enabled,
            blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
            blockedByReason: blockedBy.length > 0 ? blockedByReason : undefined,
            optional: isOptional(id, registry),
            deprecationWarning: getDeprecationWarning(id, registry),
          },
        },
        status: feature.status,
      };
    }

    return bundle;
  }

  /**
   * Get all feature IDs
   */
  getIds(): string[] {
    return Array.from(this.features.keys());
  }
}

// Export singleton
export const featureRegistry = new FeatureRegistryManager();
```

### Login Integration

```typescript
// In routes/api/index.ts - login handler

const userId = userProfile.id || username;

// Prepare feature bundle with pre-computed variants and state
const featureBundle = featureRegistry.prepareClientBundle(userId);

res.json({
  token,
  exp,
  id: userProfile.id,
  login: userProfile.login,
  email: userProfile.email,
  aiPermissions: filteredPermissions,
  isAdmin,
  features: featureBundle,  // Pre-computed, ready to use
});
```

### Client-Side Usage

```typescript
interface AppState {
  user: User | null;
  features: Record<string, ClientFeature>;
}

// Check if feature is enabled (uses pre-computed state)
function hasFeature(featureId: string): boolean {
  return appState.features[featureId]?.enabled === true;
}

// Get feature config
function getFeatureConfig<T>(featureId: string, path?: string): T | undefined {
  const feature = appState.features[featureId];
  if (!feature) return undefined;
  if (!path) return feature.config as T;
  return getNestedValue(feature.config, path) as T;
}

// Get variant (simple path lookup)
function getVariant(featureId: string): string | undefined {
  return appState.features[featureId]?.meta.variant;
}

// Check configurability for viewing
function canViewField(featureId: string, fieldPath: string): boolean {
  const feature = appState.features[featureId];
  if (!feature) return false;

  // 1. Match pattern to get feature permission name
  const featurePerm = matchPattern(fieldPath, feature.meta.configurability.view);
  if (!featurePerm) return false;

  // 2. Look up RCX permission mapping
  const rcxPerm = feature.meta.featurePermissions[featurePerm];
  if (!rcxPerm) return false;

  // 3. Parse and check (e.g., 'AI_Integration_Models:read' → ['AI_Integration_Models', 'read'])
  const [permName, operation] = rcxPerm.split(':');
  return appState.user?.aiPermissions?.[permName]?.[operation] === true;
}

// Check configurability for editing
function canEditField(featureId: string, fieldPath: string): boolean {
  const feature = appState.features[featureId];
  if (!feature) return false;

  const featurePerm = matchPattern(fieldPath, feature.meta.configurability.edit);
  if (!featurePerm) return false;

  const rcxPerm = feature.meta.featurePermissions[featurePerm];
  if (!rcxPerm) return false;

  const [permName, operation] = rcxPerm.split(':');
  return appState.user?.aiPermissions?.[permName]?.[operation] === true;
}

// Get computed state (no graph logic needed client-side)
function getFeatureState(featureId: string): ComputedState | undefined {
  return appState.features[featureId]?.meta.state;
}
```

---

## Integration with Existing Systems

### Settings Store Integration

The feature registry provides defaults. The settings store provides runtime overrides.

```typescript
function getEffectiveConfig<T>(
  featureId: string,
  path: string,
  visibility: 'public' | 'private' = 'public'
): T | undefined {
  // Check settings store for override
  const overrideKey = `features.${featureId}.config.${visibility}.${path}`;
  const override = settingsStore.get(overrideKey);

  if (override !== undefined) {
    return override.value as T;
  }

  // Fall back to registry default
  if (visibility === 'public') {
    return featureRegistry.getPublicConfig<T>(featureId, path);
  } else {
    return featureRegistry.getPrivateConfig<T>(featureId, path);
  }
}
```

### Migration from Current Config

The current system uses `config.json` with `meta.schema` for UI. Migration:

1. **Group config sections into features**
2. **Move field schemas into feature.meta.public.fields**
3. **Define featurePermissions** - Map feature-level permission names to RCX permissions
4. **Define configurability** - Set view/edit patterns using feature permission names
5. **Add requires based on implicit dependencies**
6. **Add enabled: true explicitly if the feature should be toggleable**

---

## Examples

### Infrastructure Feature (Private Only)

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
      exposeToClient: false,  // Infra feature, client doesn't need it
      featurePermissions: {
        'configure': 'AI_Settings_Admin:update'
      },
      configurability: { view: {}, edit: {} },  // No public config
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

### User-Facing Feature with Dependencies

```typescript
{
  id: 'pii-redaction',
  enabled: true,
  requires: ['ai-governance'],
  config: {
    public: {
      redactEmails: true,
      redactPhones: true,
      redactSSN: true,
      redactCreditCards: true,
      customPatterns: [],
    },
  },
  meta: {
    public: {
      name: 'PII Redaction',
      description: 'Automatically redact personally identifiable information',
      icon: 'shield',
      category: 'Data Privacy & Compliance',
      featurePermissions: {
        'view': 'AI_Governance:read',
        'configure': 'AI_Settings_Admin:update'
      },
      configurability: {
        view: { '*': 'view' },
        edit: { '*': 'configure' },
      },
      fields: {
        'redactEmails': { type: 'boolean', label: 'Redact Email Addresses' },
        'redactPhones': { type: 'boolean', label: 'Redact Phone Numbers' },
        'redactSSN': { type: 'boolean', label: 'Redact Social Security Numbers' },
        'redactCreditCards': { type: 'boolean', label: 'Redact Credit Card Numbers' },
        'customPatterns': {
          type: 'multiselect',
          label: 'Custom Patterns',
          description: 'Additional regex patterns to redact',
          options: [],
        },
      },
    },
  },
  status: 'active',
  createdAt: '2024-03-15',
}
```

### A/B Test Feature with Rollout

```typescript
{
  id: 'enhanced-search',
  enabled: true,
  requires: ['search-service', 'embeddings-api'],
  config: {
    public: {
      maxResults: 20,
      showRelevanceScore: false,
    },
    private: {
      embeddingModel: 'text-embedding-3-small',
      similarityThreshold: 0.7,
    },
  },
  meta: {
    public: {
      name: 'Enhanced Search',
      description: 'New search algorithm with semantic matching',
      icon: 'search',
      category: 'Search',
      featurePermissions: {
        'use': 'AI_Integration_Search:read',
        'configure': 'AI_Settings_Admin:update'
      },
      configurability: {
        view: { '*': 'use' },
        edit: { '*': 'configure' },
      },
      fields: {
        'maxResults': {
          type: 'number',
          label: 'Maximum Results',
          validation: { min: 1, max: 100 },
        },
        'showRelevanceScore': {
          type: 'boolean',
          label: 'Show Relevance Score',
        },
      },
    },
    private: {
      configurability: {
        view: { '*': 'configure' },
        edit: { '*': 'configure' },
      },
      fields: {
        'embeddingModel': {
          type: 'select',
          label: 'Embedding Model',
          options: [
            { value: 'text-embedding-3-small', label: 'Small (faster)' },
            { value: 'text-embedding-3-large', label: 'Large (better)' },
          ],
        },
        'similarityThreshold': {
          type: 'number',
          label: 'Similarity Threshold',
          validation: { min: 0, max: 1 },
        },
      },
    },
  },
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

### Freebird Feature (Optional, No Dependencies)

```typescript
{
  id: 'floating-action-button',
  enabled: true,
  requires: [],
  config: {
    public: {
      position: 'bottom-right',
      actions: ['new-chat', 'quick-search'],
    },
  },
  meta: {
    public: {
      name: 'Floating Action Button',
      description: 'Quick access button for common actions',
      icon: 'plus-circle',
      category: 'UI & Experience',
      featurePermissions: {
        'use': 'AI_Settings_User:read',
        'configure': 'AI_Settings_User:update'
      },
      configurability: {
        view: { '*': 'use' },
        edit: { '*': 'configure' },
      },
      fields: {
        'position': {
          type: 'select',
          label: 'Position',
          options: [
            { value: 'bottom-right', label: 'Bottom Right' },
            { value: 'bottom-left', label: 'Bottom Left' },
          ],
        },
        'actions': {
          type: 'multiselect',
          label: 'Quick Actions',
          options: [
            { value: 'new-chat', label: 'New Chat' },
            { value: 'quick-search', label: 'Quick Search' },
            { value: 'voice-input', label: 'Voice Input' },
          ],
        },
      },
    },
  },
  status: 'active',
  createdAt: '2024-04-01',
}
```

---

## Summary

| Concept | Location | Description |
|---------|----------|-------------|
| Feature identity | `id` | Unique kebab-case identifier |
| Runtime toggle | `enabled` | Boolean, default true, can be changed at runtime |
| Lifecycle | `status` | active/deprecated/removed (deprecated still enables) |
| Dependencies | `requires` | Array of feature IDs (flat registry, graph via edges) |
| Client config | `config.public` | Sent to client, user-editable |
| Server config | `config.private` | Never sent to client |
| Client metadata | `meta.public` | UI info, configurability, field schemas for public config |
| Server metadata | `meta.private` | Configurability and field schemas for private config |
| Permission vocabulary | `meta.public.featurePermissions` | Feature permission names → RCX permission strings |
| A/B testing | `rollout.variants` | Weight-based, pre-computed at login |
| Experiment reset | `rollout.experimentId` | Change to reset variant allocations |
| Resolved variant | `meta.variant` | Set at login, simple path lookup |
| Computed state | `meta.state` | enabled, blockedBy, blockedByReason, optional, deprecationWarning |
| Settings access | `meta.*.configurability.view/edit` | Wildcard patterns → feature permission names |
| Client visibility | `meta.public.exposeToClient` | Default true, set false to hide |
| Env overrides | `FEATURE_<ID>__<PATH>` | `__` for dots, `PRIVATE__` prefix for private |
| Optional detection | `meta.state.optional` | Computed: nothing requires it |
| Validation | At load | Schema-config alignment, no cycles, valid deps |
| Env safety | At load | Env vars can only override paths defined in meta.fields |
