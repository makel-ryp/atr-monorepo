# ADR-004: Layer Configuration Cascade, i18n, and Cross-Cutting Concerns

## Status
**Proposed**

> **Revision note (2026-02-07):** Part 6 was revised to separate build-time and runtime configuration concerns. Runtime configuration (control plane, per-layer overrides, runtime i18n overrides) has been extracted to [ADR-005](./005-runtime-configuration-service.md). Feature flags are tracked as the `feature-flags` knowledge slug (see [ADR-006: Context Oracle](./006-agent-context-and-decision-records.md)).

> **Revision note (2026-02-10):** Example 4 (Tenant Context Injection) is superseded by ADR-005's extensible layer model. Layer resolution is app-specific, not a core middleware concern — the `config_layers` 4-tuple `(app_id, environment, layer_name, layer_key)` generalizes past single-tenant context. Middleware execution order updated to reflect implemented middleware: `00.requestId.ts`, `01.rateLimit.ts`, `02.logging.ts`.

## Date
2026-02-06

## Context

This project uses a layered Nuxt 4 monorepo architecture (see [ADR-002](./002-monorepo-architecture.md)). As we build out the platform, we need a formal understanding of how configuration, components, composables, server middleware, and services cascade across layers — and how to harness that cascade for cross-cutting concerns like internationalization, logging, health checks, rate limiting, and runtime configuration overrides.

This ADR captures the merge semantics, establishes patterns, identifies edge cases, and provides build-time configuration guidance. Runtime configuration (hot-reloadable settings, per-layer overrides, control plane) is covered separately in [ADR-005](./005-runtime-configuration-service.md).

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
  00.requestId.ts     ← runs first (from core) — request ID injection
  01.rateLimit.ts     ← runs second (from core) — token bucket rate limiting
  02.logging.ts       ← runs third (from core) — structured logging context
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

#### Example 4: Layer Resolution Context (Superseded)

> **Note:** The original tenant context injection pattern described here has been superseded by [ADR-005](./005-runtime-configuration-service.md)'s extensible layer model.

The `config_layers` 4-tuple `(app_id, environment, layer_name, layer_key)` replaces the single-tenant model. Layer resolution context is app-specific — each app defines its own merge chain via `$meta.layers` and resolves layer keys from its own auth/identity system.

Per-request configuration resolution is handled by the JWT-keyed cache layer described in ADR-005 Part 6, not by a core middleware. This keeps the core layer agnostic to how apps model their users, groups, or tenants.

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
- `features:enabled` — reports active feature flags per app

These custom checks follow the spec's extensibility model (any key in the `checks` object is valid).

---

## Part 6: Build-Time Configuration Guidance

This section covers how configuration is structured at **build time** — the values baked into `nuxt.config.ts` and `app.config.ts` via the layer cascade, and the startup-time environment variable overrides that Nuxt applies at process start.

> **Note:** Runtime configuration (per-layer overrides, control plane, live settings changes) is defined in [ADR-005](./005-runtime-configuration-service.md). Feature flags are defined in ADR-006.

### Two Tiers of Build-Time Configuration

```
Tier 1: Source Code (build-time, immutable after deploy)
  - nuxt.config.ts, app.config.ts — merged via defu at build time
  - Translation files (i18n/locales/*.json) — bundled at build time
  - Environment-specific builds via $production, $development, $env

Tier 2: Startup Environment Variables (process start, cached for lifetime)
  - NUXT_* env vars — override runtimeConfig values at process start
  - Set via Docker, K8s ConfigMap/Secret, systemd, etc.
  - Read once at startup, cached via a mutable getter
```

### Understanding Nuxt 4's `runtimeConfig`

Despite its name, Nuxt 4's `runtimeConfig` is really **startup config**. Environment variables prefixed with `NUXT_` are read once when the Nitro server process starts and are cached for the lifetime of that process. The values are exposed through a mutable getter (not `Object.freeze`), but the Nuxt documentation treats them as read-only and they are not designed to be mutated after startup.

**Key implications:**

- `runtimeConfig` values do **not** change while the process is running
- Changing a `NUXT_*` environment variable requires a **process restart** to take effect
- `runtimeConfig` is for **provisioning** concerns: database connection strings, API URLs, port numbers, external service credentials
- `runtimeConfig` is **not** for application-level configuration that needs to change at runtime (use [ADR-005](./005-runtime-configuration-service.md) for that)

### Environment-Specific Builds

Nuxt 4 provides `$production`, `$development`, and `$env` overrides within `nuxt.config.ts` for environment-specific build-time configuration:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    logging: { level: 'info' }
  },
  $production: {
    runtimeConfig: { logging: { level: 'warn' } }
  },
  $development: {
    runtimeConfig: { logging: { level: 'debug' } }
  },
  $env: {
    staging: {
      runtimeConfig: {
        logging: { level: 'info' },
        public: { apiBase: 'https://staging-api.example.com' }
      }
    }
  }
})
```

These overrides are resolved at **build time** and become part of the built artifact. They follow the same `defu` merge rules as layer configuration.

### `runtimeConfig` vs `app.config` — When to Use Which

| Use Case | Config Type | Reason |
|----------|-------------|--------|
| API keys, secrets | `runtimeConfig` (private) | Server-only, env var overridable |
| API base URLs | `runtimeConfig.public` | Differs per environment |
| Theme colors, UI settings | `app.config` | Build-time, reactive on client |
| i18n default locale | `i18n` config in `nuxt.config.ts` | Module-specific |
| Logging destination | `runtimeConfig` (private) | Server-only, env var overridable |
| Rate limit thresholds | `runtimeConfig` (private) | Server-only, per-environment |
| Database connection string | `runtimeConfig` (private) | Provisioning concern |
| Feature flags | See `feature-flags` knowledge slug | Requires runtime evaluation |
| Per-layer settings | See [ADR-005](./005-runtime-configuration-service.md) | Requires runtime service |

### What `runtimeConfig` Is NOT For

Environment variables and `runtimeConfig` are the correct mechanism for **provisioning**. They are the wrong mechanism for **application configuration** that needs to change without restarting the process, vary per tenant or per user, be toggled by non-developers, or support gradual rollouts. These concerns are addressed by [ADR-005](./005-runtime-configuration-service.md) and ADR-006.

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

The `/docs` app (see [ADR-003](./003-developer-experience-and-documentation.md)) already provides MCP tools for codebase introspection. We extend this to include build-time configuration introspection.

> **Note:** Runtime configuration introspection tools (live settings, per-layer overrides, control plane dashboards) are defined in [ADR-005](./005-runtime-configuration-service.md).

### New MCP Tools for Configuration

| Tool | Description |
|------|-------------|
| `get-effective-config` | Returns the fully merged `runtimeConfig` for a given app |
| `get-layer-chain` | Returns the ordered list of layers for a given app |
| `get-i18n-messages` | Returns merged i18n messages for a locale, with source attribution |
| `get-component-registry` | Lists all auto-imported components with their source layer |
| `get-composable-registry` | Lists all auto-imported composables with their source layer |

---

## Part 9: Future Considerations

### 9.1 Feature Flag System

Nuxt 4 has no built-in feature flag system. The existing Nuxt module ecosystem for feature flags targets Nuxt 3 only. The approach is tracked as the `feature-flags` knowledge slug, including building components as toggleable features for A/B testing and production on/off control.

### 9.2 Multi-Tenancy via Layer Cascade

The layer cascade provides the **build-time foundation** for multi-tenancy: shared build artifacts, layer-based defaults, and build-time tenant variants via `$env` overrides. Runtime multi-tenancy concerns are defined in [ADR-005](./005-runtime-configuration-service.md).

### 9.3 `$meta.lock` for Build-Time Config Locking

There is an open proposal ([nuxt/nuxt#34270](https://github.com/nuxt/nuxt/issues/34270)) to add a `$meta.lock` convention to Nuxt's configuration system. This would allow lower-priority layers to lock specific config paths so that higher-priority layers cannot override them. This aligns with Nuxt's existing `$meta` convention and would give build-time configuration the same governance capability that [ADR-005](./005-runtime-configuration-service.md) provides at runtime.

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
| Build-time config tiers | 2-tier: source code + startup env vars | Matches Nuxt 4's actual behavior |
| Runtime configuration | See [ADR-005](./005-runtime-configuration-service.md) | Separated to clarify build-time vs runtime boundary |
| Feature flags | See `feature-flags` knowledge slug | No Nuxt 4 module exists; requires dedicated design |

---

## References

### Nuxt & Layers
- [Nuxt 4 Layers](https://nuxt.com/docs/4.x/getting-started/layers)
- [Authoring Nuxt Layers](https://nuxt.com/docs/4.x/guide/going-further/layers)
- [Nuxt Runtime Config](https://nuxt.com/docs/4.x/guide/going-further/runtime-config)

### Merge Engine
- [unjs/defu](https://github.com/unjs/defu)
- [unjs/c12](https://github.com/unjs/c12)

### i18n
- [@nuxtjs/i18n Layers Guide](https://i18n.nuxtjs.org/docs/guide/layers)
- [@nuxtjs/i18n Lazy Loading](https://i18n.nuxtjs.org/docs/guide/lazy-load-translations)
- [Nuxt UI i18n Integration](https://ui.nuxt.com/docs/getting-started/integrations/i18n/nuxt)

### Health Checks
- [IETF draft-inadarei-api-health-check-06](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check-06)

### Build-Time Configuration
- [Nuxt issue #34270](https://github.com/nuxt/nuxt/issues/34270) — `$meta.lock` feature request

### Related ADRs
- [ADR-001: Nuxt 4 Application Setup](./001-nuxt4-application-setup.md)
- [ADR-002: Monorepo Architecture](./002-monorepo-architecture.md)
- [ADR-003: Developer Experience and Documentation](./003-developer-experience-and-documentation.md)
- [ADR-005: Runtime Configuration Service](./005-runtime-configuration-service.md)
- [ADR-006: Context Oracle](./006-agent-context-and-decision-records.md) (feature flags tracked as knowledge slug)
