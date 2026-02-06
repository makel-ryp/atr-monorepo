# ADR-004: Layer Configuration Cascade, i18n, and Cross-Cutting Concerns

## Status
**Proposed**

## Date
2026-02-06

## Context

This project uses a layered Nuxt 4 monorepo architecture (see [ADR-002](./002-monorepo-architecture.md)). As we build out the platform, we need a formal understanding of how configuration, components, composables, server middleware, and services cascade across layers — and how to harness that cascade for cross-cutting concerns like internationalization, logging, health checks, rate limiting, and runtime configuration overrides.

This ADR captures the merge semantics, establishes patterns, identifies edge cases, and designs forward-looking architecture for a control plane and runtime overrides.

### Terminology

| Term | Meaning |
|------|---------|
| **Layer** | A Nuxt Layer directory (`core/`, `organization/`, `apps/*`, etc.) |
| **Cascade** | The process by which lower layers provide defaults that higher layers inherit or override |
| **defu** | The [unjs/defu](https://github.com/unjs/defu) library Nuxt uses internally for deep-merging configuration |
| **c12** | The [unjs/c12](https://github.com/unjs/c12) configuration loader that orchestrates `defu` for Nuxt |
| **Higher layer** | Closer to the app (higher priority, wins on conflict) |
| **Lower layer** | Closer to core (lower priority, provides defaults) |

---

## Part 1: The Merge Engine — How `defu` Works

Nuxt uses `defu` (via `c12`) to merge all layer configurations. Understanding its exact semantics is critical because **every architectural decision in this ADR depends on them**.

### Core Rules

| Scenario | Behavior | Example |
|----------|----------|---------|
| Both values are **plain objects** | Recursive deep merge | `{a:{b:1}}` + `{a:{c:2}}` = `{a:{b:1,c:2}}` |
| Both values are **arrays** | **Concatenate** (higher-layer first) | `[1,2]` + `[3,4]` = `[1,2,3,4]` |
| Value is a **primitive** (string, number, boolean) | Higher layer wins (replaces) | `"app"` + `"core"` = `"app"` |
| Higher layer value is `null` or `undefined` | **Skipped** — lower layer fills in | `null` + `"fallback"` = `"fallback"` |
| `0`, `""`, `false` | **Not skipped** — these are valid values, higher layer wins | `0` + `42` = `0` |
| Type conflict (object vs string, array vs non-array) | Higher layer wins (no merge attempt) | `"hello"` + `{nested:true}` = `"hello"` |
| Non-plain objects (Date, RegExp, class instances) | Higher layer wins (treated as atomic) | `new Date("2026")` + `new Date("2020")` = `new Date("2026")` |
| `__proto__` or `constructor` keys | Always skipped (security) | Prototype pollution prevention |

### Priority Order (Highest to Lowest)

```
1. App's nuxt.config.ts          (leftmost arg to defu — always wins)
2. Auto-scanned ~/layers/         (alphabetical, Z > A)
3. extends[0]                     (first entry in extends array)
4. extends[1]                     (second entry, lower priority)
5. ...and so on down the chain
```

In our architecture:

```
App (highest priority)
  └─ Organization (extends[0] in app)
       └─ Core (extends[0] in organization)
```

### The Array Concatenation Trap

Arrays in `nuxt.config.ts` **concatenate, not replace**. This is important for:

- `modules: [...]` — modules from all layers are concatenated
- `css: [...]` — stylesheets from all layers are concatenated
- `plugins: [...]` — plugins from all layers are concatenated

This means if `core` adds `@nuxtjs/i18n` to `modules`, and an app also lists `@nuxtjs/i18n`, it would appear **twice**. Nuxt deduplicates modules by name, but this is a Nuxt-specific behavior, not a `defu` guarantee.

**Edge case**: There is no way to **remove** an array item inherited from a lower layer in `nuxt.config.ts`. If core adds a module, all consuming layers inherit it. The only escape hatch is setting the module to `false` in the higher layer's config (Nuxt-specific, not a defu feature):

```typescript
// App nuxt.config.ts — disable a module inherited from core
modules: [
  ['@nuxtjs/i18n', false]  // Nuxt-specific: disables this module
]
```

### `nuxt.config.ts` vs `app.config.ts` Merge Differences

| Aspect | `nuxt.config.ts` | `app.config.ts` |
|--------|-------------------|-----------------|
| Merge engine | `defu` (standard) | `defuFn` (function-aware variant) |
| Array behavior | Concatenate | Concatenate (but can use functions to replace) |
| Function values | Treated as atomic values | **Invoked** with lower-layer value as argument |
| Override arrays | Not possible cleanly | Use `() => [newArray]` to replace |
| When resolved | Build time + runtime env vars | Build time only |
| Env var override | Yes (`NUXT_*` prefix) | No |

The `defuFn` variant in `app.config.ts` is important. If an app's `app.config.ts` defines a function for a key, it receives the lower layer's value and can transform it:

```typescript
// organization/app/app.config.ts
export default defineAppConfig({
  theme: { colors: ['red', 'green', 'blue'] }
})

// app/app.config.ts — REPLACE instead of concatenate
export default defineAppConfig({
  theme: { colors: () => ['purple', 'gold'] }  // function replaces
})
// Result: { theme: { colors: ['purple', 'gold'] } }
```

Without the function wrapper, the result would have been `['purple', 'gold', 'red', 'green', 'blue']` (concatenation).

---

## Part 2: What Cascades and How

### Directory-Level Cascade Behavior

| Directory | Cascade Behavior | Override Semantics |
|-----------|------------------|--------------------|
| `app/components/` | Auto-imported from all layers | Same-named component: higher layer wins entirely |
| `app/composables/` | Auto-imported from all layers | Same-named composable: higher layer wins |
| `app/utils/` | Auto-imported from all layers | Same-named util: higher layer wins |
| `app/layouts/` | Merged from all layers | Same-named layout: higher layer wins |
| `app/middleware/` | Merged from all layers | Same-named middleware: higher layer wins |
| `app/pages/` | Merged from all layers | Same-named page: higher layer wins |
| `app/plugins/` | Merged from all layers | Runs all from all layers |
| `server/middleware/` | **Concatenated — ALL run** | No override; all layers' middleware executes |
| `server/api/` | Merged from all layers | Same-named route: higher layer wins |
| `server/utils/` | Auto-imported from all layers | Same-named util: higher layer wins |
| `server/plugins/` | Merged from all layers | Runs all from all layers |
| `nuxt.config.ts` | Deep-merged via `defu` | See merge rules above |
| `app/app.config.ts` | Deep-merged via `defuFn` | See merge rules above |
| `public/` | Merged | Same-named file: higher layer wins |

### Critical Insight: Server Middleware Does NOT Override

Unlike components and pages where the higher layer's version replaces the lower layer's, **server middleware from ALL layers executes**. This is a Nitro behavior, not Nuxt. Both `core/server/middleware/rateLimit.ts` and `app/server/middleware/rateLimit.ts` would run — they don't replace each other.

This is **useful for cross-cutting concerns** (a core rate limiter runs for all apps automatically) but **problematic if an app needs to disable it**. The workaround is to use `runtimeConfig` flags:

```typescript
// core/server/middleware/00.rateLimit.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  if (config.rateLimiter?.enabled === false) return  // skip if disabled
  // ... rate limiting logic
})
```

### Middleware Execution Order

Server middleware runs in **alphabetical order by filename**. Use numeric prefixes to control order:

```
server/middleware/
  00.cors.ts          ← runs first (from core)
  01.rateLimit.ts     ← runs second (from core)
  02.tenantContext.ts  ← runs third (from core)
  10.appSpecific.ts   ← runs later (from app)
```

Since middleware from all layers is merged, the alphabetical sort applies across all layers' middleware files together.

---

## Part 3: Internationalization Architecture

### Decision

Use **`@nuxtjs/i18n`** (v10.x) installed at the **core layer**, with **`@nuxt/ui/locale`** bridged to it for Nuxt UI component translations.

### Why Both Are Needed

| System | What It Translates | Scope |
|--------|--------------------|-------|
| `@nuxt/ui/locale` | Nuxt UI component strings (date pickers, command palette, form messages) | Nuxt UI components only |
| `@nuxtjs/i18n` | Everything you build (pages, custom components, error messages, labels) | Your entire application |

They are complementary. `@nuxtjs/i18n` drives locale selection; `@nuxt/ui/locale` is bridged to display the correct Nuxt UI strings.

### Layer-Aware i18n Architecture

```
core/
  i18n/
    locales/
      en.json          ← shared strings: "Save", "Cancel", "Loading", "Error"
      es.json
      fr.json
  nuxt.config.ts       ← @nuxtjs/i18n module + base i18n config

organization/
  i18n/
    locales/
      en.json          ← brand strings: "Acme Corp", "support@acme.com"
      es.json
      fr.json

apps/my-app/
  i18n/
    locales/
      en.json          ← app strings: "Chat History", "New Message"
      es.json
      fr.json
```

### Translation Merge Behavior

Translation files across layers **deep-merge** following the same `_layers` priority as the rest of Nuxt:

```
Priority: App (highest) > Organization > Core (lowest)
```

Given:
```json
// core/i18n/locales/en.json
{ "actions": { "save": "Save", "cancel": "Cancel" }, "welcome": "Welcome" }

// organization/i18n/locales/en.json
{ "brand": { "name": "Acme Corp" }, "welcome": "Welcome to Acme" }

// app/i18n/locales/en.json
{ "app": { "title": "My Dashboard" }, "welcome": "Welcome to My Dashboard" }
```

Result at runtime:
```json
{
  "actions": { "save": "Save", "cancel": "Cancel" },
  "brand": { "name": "Acme Corp" },
  "app": { "title": "My Dashboard" },
  "welcome": "Welcome to My Dashboard"
}
```

- `actions.*` comes from core (not overridden)
- `brand.*` comes from organization (not overridden)
- `app.*` comes from app (not overridden)
- `welcome` is overridden at each layer — app's version wins

### Namespacing Convention

There is no built-in namespacing in `@nuxtjs/i18n`. We enforce it by convention using top-level keys:

```json
// core: use "core." prefix
{ "core": { "errors": { "notFound": "Page not found" }, "actions": { "save": "Save" } } }

// organization: use "org." prefix
{ "org": { "name": "Acme Corp", "support": "support@acme.com" } }

// app: use "app." prefix
{ "app": { "dashboard": { "title": "My Dashboard" } } }
```

Usage in templates:
```vue
<template>
  <h1>{{ $t('app.dashboard.title') }}</h1>
  <p>{{ $t('org.name') }}</p>
  <button>{{ $t('core.actions.save') }}</button>
</template>
```

This prevents accidental key collisions between layers and makes it clear where each string originates.

### Core `nuxt.config.ts` i18n Configuration

```typescript
// core/nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    lazy: true,
    langDir: 'i18n/locales',
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root'
    },
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es-ES', name: 'Espanol', file: 'es.json' },
      { code: 'fr', language: 'fr-FR', name: 'Francais', file: 'fr.json' }
    ]
  }
})
```

Apps and organization layers inherit this config. They can:
- **Add locales** by appending to the `locales` array (arrays concatenate)
- **Override i18n settings** like `defaultLocale` (scalar values override)
- **Provide their own translation files** in their own `i18n/locales/` directory

### Bridging to Nuxt UI

In the root `app.vue` (or in core's layout):

```vue
<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'

const { locale } = useI18n()

const uiLocale = computed(() => uiLocales[locale.value] || uiLocales.en)
const lang = computed(() => uiLocale.value.code)
const dir = computed(() => uiLocale.value.dir)

useHead({ htmlAttrs: { lang, dir } })
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
```

### `langDir` Path Resolution in Layers

**Known issue**: `langDir` in a layer's `nuxt.config.ts` resolves relative to the **consuming app's root**, not the layer's root. This breaks locale file resolution in layers.

**Solution**: Use absolute paths computed from `import.meta.url`:

```typescript
// core/nuxt.config.ts
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  i18n: {
    langDir: resolve(currentDir, 'i18n/locales'),
    // ...
  }
})
```

Each layer that provides translation files must compute its own absolute `langDir` path.

### Known i18n + Layers Issues

| Issue | Severity | Workaround |
|-------|----------|------------|
| `langDir` resolves relative to consuming app, not layer | High | Use absolute paths via `import.meta.url` |
| Remote layers (GitHub URLs) break i18n path resolution | Medium | Use local layers only (our monorepo does this already) |
| Cannot use function-based locale overrides (`locales: () => [...]`) | Low | Apps must add/override locales through standard array concat |
| `useI18n()` returns `undefined` with `ssr: false` in layers | Medium | Keep SSR enabled (our default) |
| Mixing lazy-load config styles (objects + strings) across layers | High | All layers must use consistent config format (all objects) |
| Deep monorepo nesting can corrupt i18n import paths via Vite | Medium | Keep layer nesting shallow (our `core -> org -> app` is fine) |

### Per-Component i18n (`<i18n>` Blocks)

Components can define their own translations using Vue I18n's SFC custom blocks:

```vue
<i18n lang="json">
{
  "en": { "greeting": "Hello" },
  "es": { "greeting": "Hola" }
}
</i18n>

<script setup>
const { t } = useI18n({ useScope: 'local' })
</script>

<template>
  <p>{{ t('greeting') }}</p>
</template>
```

- Must use `useI18n({ useScope: 'local' })` and the returned `t()` — the global `$t()` does NOT work with per-component translations
- These translations are scoped to the component and do not collide with global keys
- If an app overrides a layer's component (same name), the app's `<i18n>` block replaces entirely — no merge

---

## Part 4: Cross-Cutting Concerns via Layer Cascade

The Nuxt layer cascade is effectively **aspect-oriented programming** — cross-cutting concerns defined at the core level automatically apply to all consuming apps without those apps explicitly opting in.

### Pattern: Core Provides, Organization Configures, App Overrides

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CORE (provides infrastructure)                                          │
│                                                                          │
│  server/middleware/00.rateLimit.ts    ← rate limiting for all apps       │
│  server/middleware/01.requestId.ts    ← request ID injection             │
│  server/middleware/02.logging.ts      ← structured logging               │
│  server/plugins/telemetry.ts         ← OpenTelemetry setup              │
│  server/plugins/healthcheck.ts       ← /health endpoint registration    │
│  app/composables/useI18nSetup.ts     ← i18n initialization helper       │
│  app/composables/useAuth.ts          ← authentication composable        │
│  app/plugins/errorHandler.ts         ← global error handling            │
│                                                                          │
│  nuxt.config.ts:                                                         │
│    runtimeConfig.rateLimiter.tokensPerInterval: 150                     │
│    runtimeConfig.rateLimiter.interval: 300000                           │
│    runtimeConfig.logging.level: 'info'                                  │
│    runtimeConfig.logging.destination: 'stdout'                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ORGANIZATION (configures for company)                                    │
│                                                                          │
│  nuxt.config.ts:                                                         │
│    runtimeConfig.logging.destination: 's3://acme-logs/prod'             │
│    runtimeConfig.rateLimiter.tokensPerInterval: 500                     │
│    runtimeConfig.public.sentryDsn: 'https://...'                        │
├──────────────────────────────────────────────────────────────────────────┤
│ APP (overrides if needed)                                                │
│                                                                          │
│  nuxt.config.ts:                                                         │
│    runtimeConfig.rateLimiter.tokensPerInterval: 1000  ← high-traffic    │
└──────────────────────────────────────────────────────────────────────────┘
```

The app gets rate limiting, logging, request IDs, telemetry, and error handling **without writing any of that code**. It only needs to override configuration values if the defaults don't fit.

### Concrete Examples

#### Example 1: Centralized Structured Logging

```typescript
// core/server/middleware/02.logging.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const requestId = event.context.requestId  // set by 01.requestId.ts

  event.context.log = {
    requestId,
    startTime: Date.now(),
    level: config.logging?.level || 'info'
  }
})

// core/server/plugins/logging.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', (event) => {
    const log = event.context.log
    if (!log) return

    const entry = {
      requestId: log.requestId,
      method: event.method,
      path: event.path,
      status: getResponseStatus(event),
      duration: Date.now() - log.startTime,
      timestamp: new Date().toISOString()
    }

    // Destination is configurable via runtimeConfig
    // Core defaults to stdout, org can override to S3/GCP
    console.log(JSON.stringify(entry))
  })
})
```

The organization layer overrides `runtimeConfig.logging.destination` to `'s3://...'` — the logger reads this at runtime and ships logs to S3 instead of stdout. **No code change in the app or core.**

#### Example 2: Rate Limiting

```typescript
// core/server/middleware/00.rateLimit.ts
import { createStorage } from 'unstorage'

const storage = createStorage()

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (config.rateLimiter?.enabled === false) return

  const ip = getRequestIP(event, { xForwardedFor: true })
  const key = `rateLimit:${ip}`
  const tokens = await storage.getItem<number>(key) ?? config.rateLimiter.tokensPerInterval

  if (tokens <= 0) {
    throw createError({ statusCode: 429, message: 'Too Many Requests' })
  }

  await storage.setItem(key, tokens - 1, {
    ttl: config.rateLimiter.interval / 1000
  })
})
```

Core provides the middleware with sensible defaults (150 requests per 5 minutes). Organization bumps it to 500. A high-traffic app bumps it to 1000. All through `runtimeConfig` overrides in `nuxt.config.ts` — **the middleware code is never duplicated**.

#### Example 3: Health Check System

See Part 5 below.

#### Example 4: Tenant Context Injection

```typescript
// core/server/middleware/02.tenantContext.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.multiTenancy?.enabled) return

  // Extract tenant from JWT, subdomain, or header
  const tenantId = extractTenantId(event)
  if (!tenantId) return

  // Fetch tenant config from control plane API (or cache)
  const tenantConfig = await fetchTenantConfig(tenantId)

  // Attach to event context — available to all route handlers
  event.context.tenant = {
    id: tenantId,
    config: tenantConfig,
    features: tenantConfig.features || {}
  }
})
```

Every app inherits tenant detection. If `multiTenancy.enabled` is `false` (the default), the middleware is a no-op. The organization turns it on by setting `runtimeConfig.multiTenancy.enabled: true`.

### What Makes This "Aspect-Oriented"

Traditional AOP uses advice (before/after/around) woven into join points. Nuxt layers achieve the same thing through different mechanisms:

| AOP Concept | Nuxt Equivalent |
|-------------|-----------------|
| **Before advice** | `server/middleware/` (runs before every request) |
| **After advice** | Nitro hooks: `afterResponse`, `error` |
| **Around advice** | Higher-order composables wrapping business logic |
| **Join point** | Every HTTP request (server) or component render (client) |
| **Pointcut** | Route matching, `runtimeConfig` flags, path patterns |
| **Aspect** | A Nuxt layer providing middleware + plugins + config |
| **Weaving** | The `extends` chain in `nuxt.config.ts` — automatic at build time |

The key insight: **the core layer IS an aspect**. It weaves cross-cutting concerns (logging, auth, rate limiting, i18n, error handling) into every consuming app via the `extends` chain, without those apps knowing or caring about the implementation.

---

## Part 5: Health Check System

### Decision

Use **`draft-inadarei-api-health-check-06`** (`application/health+json`) as the response format, extended with layer introspection fields.

### Rationale

The health check response format space is fragmented:

| Format | Real-World Adoption | Semantic Richness | AI Parseability |
|--------|--------------------|--------------------|-----------------|
| IETF `draft-inadarei` | Low (~123 GH stars) | Highest | Best (self-describing fields) |
| Spring Boot Actuator | Highest (~29K companies) | High | Excellent (most training data) |
| Kubernetes probes | Universal (infrastructure) | None (status code only) | N/A |
| gRPC `health.v1` | High (all gRPC services) | Minimal | Limited |

We choose the IETF draft because:
1. It is the **only vendor-neutral, standards-track** health check response format
2. Its fields are **semantically self-describing** — AI can parse `observedValue: 250, observedUnit: "ms"` without external context
3. We are defining a new system, so existing adoption of implementations is irrelevant
4. It is compatible with Kubernetes probes (K8s only checks HTTP status codes)

### Implementation

```typescript
// core/server/routes/health.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const checks = await runHealthChecks(event)

  const overallStatus = deriveStatus(checks) // 'pass' | 'warn' | 'fail'

  const response = {
    status: overallStatus,
    version: config.public.appVersion || '0.0.0',
    serviceId: config.public.serviceId || 'unknown',
    description: `Health of ${config.public.appName || 'app-agent'}`,
    checks,
    links: {
      about: `${getRequestURL(event).origin}/docs`,
      health: `${getRequestURL(event).origin}/health`
    }
  }

  // HTTP status code mapping per spec
  setResponseStatus(event, overallStatus === 'fail' ? 503 : 200)
  setResponseHeader(event, 'Content-Type', 'application/health+json')
  setResponseHeader(event, 'Cache-Control', 'max-age=5')

  return response
})
```

### Checks Object Structure

```json
{
  "status": "warn",
  "version": "1.2.0",
  "serviceId": "my-dashboard-app",
  "checks": {
    "database:responseTime": [{
      "componentType": "datastore",
      "observedValue": 45,
      "observedUnit": "ms",
      "status": "pass",
      "time": "2026-02-06T12:00:00Z"
    }],
    "i18n:localesLoaded": [{
      "componentType": "system",
      "observedValue": ["en", "es", "fr"],
      "status": "pass",
      "time": "2026-02-06T12:00:00Z"
    }],
    "layers:cascade": [{
      "componentType": "system",
      "observedValue": {
        "chain": ["app", "organization", "core"],
        "configKeys": 47,
        "componentCount": 23,
        "composableCount": 8
      },
      "status": "pass",
      "time": "2026-02-06T12:00:00Z"
    }],
    "memory:utilization": [{
      "componentType": "system",
      "observedValue": 72,
      "observedUnit": "percent",
      "status": "warn",
      "time": "2026-02-06T12:00:00Z"
    }]
  }
}
```

### Layer Introspection Extensions

We extend the standard with custom check types for layer introspection:

- `layers:cascade` — reports the active layer chain and merged counts
- `i18n:localesLoaded` — reports which locales are available
- `config:overrides` — reports how many runtime overrides are active (from control plane)
- `features:enabled` — reports active feature flags per tenant

These custom checks follow the spec's extensibility model (any key in the `checks` object is valid).

---

## Part 6: Runtime Configuration and the Control Plane

### The Configuration Hierarchy

Configuration flows through four tiers, from build-time to runtime:

```
Tier 1: Source Code (build-time, immutable after deploy)
  └─ nuxt.config.ts, app.config.ts — merged via defu at build time
  └─ Translation files (i18n/locales/*.json) — bundled at build time

Tier 2: Environment Variables (deploy-time, requires restart)
  └─ NUXT_* env vars — override runtimeConfig values at process start
  └─ Set via Docker, K8s ConfigMap/Secret, systemd, etc.

Tier 3: Feature Flags (runtime, no restart)
  └─ OpenFeature-compatible flag service (Flagsmith, Unleash)
  └─ Boolean toggles, percentage rollouts, user targeting
  └─ Read via composable or server middleware

Tier 4: Control Plane Overrides (runtime, per-tenant, no restart)
  └─ /control app reads/writes tenant configuration
  └─ Stored in database, served via /api/settings/:appName
  └─ Applied per-request based on tenant context (JWT, subdomain)
  └─ Includes: i18n overrides, UI layout, feature entitlements, rate limits
```

### `runtimeConfig` vs `app.config` — When to Use Which

| Use Case | Config Type | Reason |
|----------|-------------|--------|
| API keys, secrets | `runtimeConfig` (private) | Server-only, env var overridable |
| API base URLs | `runtimeConfig.public` | Differs per environment |
| Theme colors, UI settings | `app.config` | Build-time, reactive on client |
| Feature flags | `runtimeConfig.public` + composable | Needs to be reactive |
| i18n default locale | `i18n` config in `nuxt.config.ts` | Module-specific |
| Logging destination | `runtimeConfig` (private) | Server-only, env var overridable |
| Rate limit thresholds | `runtimeConfig` (private) | Server-only, per-environment |

### The `/settings` API Endpoint

Core provides a server route that returns the **merged effective configuration** for any app, combining all four tiers:

```typescript
// core/server/api/settings/[appName].get.ts
export default defineEventHandler(async (event) => {
  const appName = getRouterParam(event, 'appName')

  // Tier 1+2: runtimeConfig (already merged by Nuxt/Nitro)
  const baseConfig = useRuntimeConfig(event).public

  // Tier 3: Feature flags
  const features = await getFeatureFlags(event)

  // Tier 4: Control plane overrides (per-tenant if applicable)
  const tenant = event.context.tenant
  const overrides = tenant
    ? await getControlPlaneOverrides(tenant.id, appName)
    : {}

  // Merge: overrides win over features win over base
  return defu(overrides, features, baseConfig)
})
```

This endpoint is what the `/control` app reads to show DevOps teams the **effective configuration** for each deployed app.

### The `/control` App

`/control` is a special Nuxt app in the monorepo, similar to `/docs`:

```
control/
  app/
    pages/
      index.vue            ← Dashboard: overview of all deployed apps
      apps/[name].vue      ← Per-app config viewer/editor
      tenants/[id].vue     ← Per-tenant settings
      i18n.vue             ← i18n override manager
      features.vue         ← Feature flag manager
    composables/
      useControlPlane.ts   ← API client for /api/settings/*
  nuxt.config.ts           ← extends: ['../organization']
  package.json
```

What DevOps can do:
- **Browse** all deployed apps and their effective configuration
- **Override** i18n strings at runtime (stored in database, served via Tier 4)
- **Toggle** features per tenant or globally
- **View** health status of all nodes (reading `/health` from each)
- **Inspect** the layer cascade — see what core provides, what org overrides, what the app changes
- **Chat with AI** about configuration changes (via MCP integration with docs)

### Runtime i18n Overrides (Without Redeployment)

The control plane can override translation strings at runtime:

```typescript
// core/app/plugins/i18n-overrides.client.ts
export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n
  const config = useRuntimeConfig()

  // Fetch runtime overrides from the settings API
  const overrides = await $fetch(`${config.public.apiBase}/settings/i18n-overrides`)

  if (overrides) {
    // Merge overrides into each locale's messages
    for (const [locale, messages] of Object.entries(overrides)) {
      i18n.mergeLocaleMessage(locale, messages)
    }
  }
})
```

This allows DevOps to change any translation string via the control plane UI without touching source code or redeploying. The override is fetched at app startup (or periodically) and merged on top of the build-time translations.

### How a Deployed Node Sees Its Configuration

```
                    ┌────────────────────────────────────────┐
                    │           DEPLOYED NODE                 │
                    │                                         │
Source Code ───────►│  nuxt.config merge (defu)              │
(build artifact)    │    core + org + app configs             │
                    │              │                          │
                    │              ▼                          │
Env Variables ─────►│  runtimeConfig override                │
(deploy target)     │    NUXT_* env vars applied             │
                    │              │                          │
                    │              ▼                          │
Feature Flags ─────►│  OpenFeature SDK evaluation            │
(flag service)      │    per-request flag values             │
                    │              │                          │
                    │              ▼                          │
Control Plane ─────►│  Tenant config override                │
(database/API)      │    per-tenant settings applied         │
                    │              │                          │
                    │              ▼                          │
                    │  ┌─────────────────────────────┐       │
                    │  │ EFFECTIVE CONFIGURATION      │       │
                    │  │ (what the app actually uses) │       │
                    │  └─────────────────────────────┘       │
                    │              │                          │
                    │              ▼                          │
                    │  GET /health → reports all of this     │
                    │  GET /api/settings/myapp → returns it  │
                    └────────────────────────────────────────┘
```

---

## Part 7: Edge Cases and Gotchas

### 1. Array Deduplication Is Not Guaranteed

`defu` concatenates arrays. If `core` and `organization` both list the same CSS file, it appears twice. Nuxt deduplicates `modules` by name, but does NOT deduplicate `css`, `plugins`, or other arrays.

**Mitigation**: Only define shared CSS/plugins at the core level. Higher layers add their own without repeating lower-layer entries.

### 2. `null` Means "I Don't Have an Opinion"

Setting a value to `null` in a higher layer does NOT override the lower layer's value — it defers to it. This is `defu`'s design. To explicitly set "nothing", use an empty string `""`, `false`, or `0` depending on the type.

```typescript
// WRONG: this does NOT clear the apiBase from core
{ runtimeConfig: { public: { apiBase: null } } }
// Result: apiBase is still 'http://localhost:3001/api' from core

// CORRECT: this overrides to empty string
{ runtimeConfig: { public: { apiBase: '' } } }
```

### 3. Layer Component Override Is All-or-Nothing

If `core` provides `AppHeader.vue` and an app also provides `AppHeader.vue`, the app's version completely replaces the core version. There is no "partial override" or "slot injection" at the layer level. The app must re-implement the entire component.

**Mitigation**: Design core components with `<slot>` and props for customization, so apps rarely need to fully override them.

### 4. Server Middleware Cannot Be Disabled Cleanly

Since server middleware from all layers runs, an app cannot "remove" a middleware from core. The only workaround is the `runtimeConfig` flag pattern shown in Part 2.

### 5. `app.config.ts` Function Merger Only Works in Layers

The function-based override in `app.config.ts` (`colors: () => ['new']`) can only be used in **extended layers**, not in the main project's `app.config.ts`. Practically, this means:
- Core can define defaults normally
- Organization can use functions to override core's arrays
- The app (if it's the final project) must use normal values (concatenation)

### 6. i18n `langDir` Must Be Absolute in Layers

Relative `langDir` paths in layers resolve relative to the consuming app, not the layer. Always compute absolute paths from `import.meta.url`. See Part 3 for the pattern.

### 7. `runtimeConfig` Keys Must Be Pre-Declared

Only keys already defined in `nuxt.config.ts` `runtimeConfig` can be overridden via `NUXT_*` environment variables. You cannot inject new keys at runtime — this is a security feature.

**Implication**: Core must pre-declare ALL configurable keys with default values, even if they're empty strings. If a key doesn't exist in core's `runtimeConfig`, no environment variable can set it.

### 8. Watch Paths for HMR in Layers

Changes to files in `core/` may not trigger hot module replacement in consuming apps during development. Configure watch paths explicitly:

```typescript
// apps/my-app/nuxt.config.ts
export default defineNuxtConfig({
  watch: ['../../core/**/*', '../../organization/**/*']
})
```

### 9. Build Order in Turborepo

Layers must be "prepared" before consuming apps can build. Turborepo handles this via `dependsOn: ["^build"]`, but development mode (`turbo dev`) runs everything concurrently. Occasional race conditions on first start can be resolved by restarting.

### 10. Translation File Caching

`@nuxtjs/i18n` caches lazy-loaded locale files by filename. If two layers provide files with the same name (e.g., both have `en.json`), the cache may serve the wrong version. Using absolute `langDir` paths and unique filenames per layer avoids this.

---

## Part 8: The Docs App as Configuration Inspector

The `/docs` app (see [ADR-003](./003-developer-experience-and-documentation.md)) already provides MCP tools for codebase introspection. We extend this to include configuration introspection:

### New MCP Tools for Configuration

| Tool | Description |
|------|-------------|
| `get-effective-config` | Returns the fully merged `runtimeConfig` for a given app |
| `get-layer-chain` | Returns the ordered list of layers for a given app |
| `get-i18n-messages` | Returns merged i18n messages for a locale, with source attribution |
| `get-component-registry` | Lists all auto-imported components with their source layer |
| `get-composable-registry` | Lists all auto-imported composables with their source layer |

### Source Attribution

For developers to understand what's coming from where, the docs app can trace each value back to its source:

```json
{
  "key": "runtimeConfig.rateLimiter.tokensPerInterval",
  "effectiveValue": 1000,
  "sources": [
    { "layer": "core", "value": 150 },
    { "layer": "organization", "value": 500 },
    { "layer": "app", "value": 1000, "winner": true }
  ]
}
```

This turns the docs app into a **live configuration debugger** — developers can see exactly which layer contributes each setting and why the effective value is what it is.

---

## Part 9: Future Considerations

### 9.1 OpenFeature Integration

When the project needs runtime feature flags beyond simple config overrides, integrate an [OpenFeature](https://openfeature.dev/)-compatible provider. This gives vendor portability (swap between Flagsmith, Unleash, LaunchDarkly) without code changes.

```typescript
// core/server/plugins/featureFlags.ts
import { OpenFeature } from '@openfeature/server-sdk'
import { FlagsmithProvider } from '@openfeature/flagsmith-provider'

export default defineNitroPlugin(async () => {
  await OpenFeature.setProviderAndWait(
    new FlagsmithProvider({ environmentKey: process.env.FLAGSMITH_KEY })
  )
})
```

### 9.2 Multi-Tenancy via Layer Cascade

For SaaS deployments where each tenant needs different configuration:
1. **Shared infrastructure**: All tenants run on the same Nuxt app instance
2. **Tenant isolation**: Server middleware extracts tenant ID from JWT/subdomain
3. **Per-tenant config**: Control plane API returns tenant-specific overrides
4. **Per-tenant i18n**: Tenants can have custom translations via Tier 4 overrides
5. **Per-tenant features**: OpenFeature flags with tenant-based targeting

### 9.3 Deployment Node Registry

The control plane maintains a registry of deployed nodes:
- Each node reports its effective configuration via `/health`
- The control plane aggregates health across all nodes
- DevOps can compare configuration between nodes (dev vs staging vs prod)
- Drift detection: alert when a node's effective config doesn't match expected

### 9.4 AI-Assisted Configuration Management

Since the docs app has MCP integration, and the control plane provides configuration APIs, an AI assistant can:
1. Read the current effective config for any app via MCP
2. Understand what each setting does from documentation
3. Suggest configuration changes based on observed health metrics
4. Apply changes via the control plane API (with human approval)

Example: "The health endpoint shows memory utilization at 92%. The rate limiter is set to 1000 requests per 5 minutes. I suggest reducing it to 500 to lower memory pressure."

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Configuration merge engine | `defu` via Nuxt layers (existing) | Built into Nuxt, well-understood semantics |
| i18n module | `@nuxtjs/i18n` at core layer | Industry standard, layer-aware, lazy loading |
| i18n key namespacing | Convention-based (`core.*`, `org.*`, `app.*`) | No built-in support; convention prevents collisions |
| Nuxt UI locale bridge | `useI18n()` -> `@nuxt/ui/locale` in root layout | Official recommended pattern from Nuxt UI docs |
| Cross-cutting concerns | Server middleware + Nitro hooks at core layer | Automatic cascade, configurable via `runtimeConfig` |
| Health check format | `application/health+json` (IETF draft) with extensions | Most semantically rich, AI-parseable, vendor-neutral |
| Runtime config overrides | 4-tier hierarchy (source, env, flags, control plane) | Covers all deployment scenarios without code changes |
| Control plane | Separate Nuxt app (`/control`) | Admin UI for DevOps, separate from developer docs |
| Feature flags | OpenFeature SDK (future) | Vendor-portable, standards-based |

---

## References

### Nuxt & Layers
- [Nuxt 4 Layers](https://nuxt.com/docs/4.x/getting-started/layers)
- [Authoring Nuxt Layers](https://nuxt.com/docs/4.x/guide/going-further/layers)
- [Nuxt Runtime Config](https://nuxt.com/docs/4.x/guide/going-further/runtime-config)
- [Nuxt Layers Modular Monolith Guide](https://alexop.dev/posts/nuxt-layers-modular-monolith/)
- [Dave Stewart: Modular Site Architecture with Nuxt Layers](https://davestewart.co.uk/blog/nuxt-layers/)

### Merge Engine
- [unjs/defu](https://github.com/unjs/defu) — merge library source code and docs
- [unjs/c12](https://github.com/unjs/c12) — configuration loader used by Nuxt
- [Nuxt issue #22194](https://github.com/nuxt/nuxt/issues/22194) — nuxt.config custom merge strategy request
- [Nuxt issue #15649](https://github.com/nuxt/nuxt/issues/15649) — app.config array deduplication

### i18n
- [@nuxtjs/i18n Layers Guide](https://i18n.nuxtjs.org/docs/guide/layers)
- [@nuxtjs/i18n Lazy Loading](https://i18n.nuxtjs.org/docs/guide/lazy-load-translations)
- [@nuxtjs/i18n Per-Component Translations](https://i18n.nuxtjs.org/docs/guide/per-component-translations/)
- [Nuxt UI i18n Integration](https://ui.nuxt.com/docs/getting-started/integrations/i18n/nuxt)
- [nuxt-modules/i18n issue #1890](https://github.com/nuxt-modules/i18n/issues/1890) — langDir path resolution
- [nuxt-modules/i18n issue #2978](https://github.com/nuxt-modules/i18n/issues/2978) — cannot override locales from layer

### Health Checks
- [IETF draft-inadarei-api-health-check-06](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check-06)
- [inadarei/rfc-healthcheck (GitHub)](https://github.com/inadarei/rfc-healthcheck)
- [Kubernetes Health Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Spring Boot Actuator Health](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)

### Control Plane & Multi-Tenancy
- [AWS SaaS: Control Plane vs Application Plane](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html)
- [Azure: Control Planes in Multitenant Solutions](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/control-planes)
- [OpenFeature](https://openfeature.dev/) — vendor-neutral feature flag standard

### Cross-Cutting Concerns
- [Nuxt Server Middleware](https://nuxt.com/docs/4.x/directory-structure/server)
- [nuxt-security Rate Limiter](https://nuxt-security.vercel.app/middleware/rate-limiter)
- [Nitro Hooks](https://nitro.build/guide/plugins#available-hooks)

### Related ADRs
- [ADR-001: Nuxt 4 Application Setup](./001-nuxt4-application-setup.md)
- [ADR-002: Monorepo Architecture](./002-monorepo-architecture.md)
- [ADR-003: Developer Experience and Documentation](./003-developer-experience-and-documentation.md)
