# ADR-007: Testing Strategy

## Status
**Proposed**

## Date
2026-02-09

## Context

The monorepo has no test infrastructure yet. As we build out the Context Oracle (ADR-006) and platform features, we need a testing strategy that:

1. Works with Nuxt 4's auto-import system without conflicts
2. Handles the layered monorepo architecture (`core/` → `organization/` → `apps/*`)
3. Covers server-side code (Nitro handlers, server utils) and client-side code (composables, components)
4. Doesn't fight the framework

### What Nuxt 4 Prescribes

The [Nuxt 4 testing docs](https://nuxt.com/docs/4.x/getting-started/testing) are explicit about the recommended setup:

- **Test runner:** vitest (the only supported runner for unit/runtime tests)
- **Test utils:** `@nuxt/test-utils` v4 (requires vitest v4 as peer dependency)
- **Configuration:** `defineVitestProject` from `@nuxt/test-utils/config` for monorepo workspace support
- **Directory structure:** `test/unit/`, `test/nuxt/`, `test/e2e/` — NOT colocated with source
- **TypeScript:** Files in `test/nuxt/` and `tests/nuxt/` automatically get Nuxt alias resolution (`~/`, `@/`, `#imports`) and auto-import type awareness

The official vitest config uses the **projects** pattern:

```typescript
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
```

### The Server-Side Testing Gap

The `nuxt` vitest environment is a **client environment** (happy-dom/jsdom). It does not resolve Nitro auto-imports like `defineEventHandler`, `readBody`, or `getRouterParams`. [Issue #531](https://github.com/nuxt/test-utils/issues/531) tracks server environment support — still open as of February 2026 with no merged PRs.

The established community workaround is `vi.stubGlobal()` in a setup file:

```typescript
// test/setup-server.ts
vi.stubGlobal('defineEventHandler', vi.fn((handler) => handler))
vi.stubGlobal('defineNitroPlugin', vi.fn((plugin) => plugin))
vi.stubGlobal('readBody', vi.fn())
```

This is the same pattern we used in the `temp/` prototype tests for `context.ts`. It works because our server handlers are pure functions that Nitro wraps — we test the inner logic, not the Nitro integration.

### Why Not Colocate Tests?

Nuxt auto-imports everything from `composables/`, `utils/`, `server/utils/`, and other scanned directories. A `foo.test.ts` file in `composables/` would be auto-imported, pulling in `vitest` as a runtime dependency and breaking the build. No official docs or community examples colocate tests inside Nuxt-scanned directories.

### Why Not bun:test?

We prototyped with `bun:test` in `temp/`. Two problems:

1. **Native modules:** `better-sqlite3`'s DLL doesn't load under Bun on Windows (NAPI mismatch). It works through Nitro's bundling but not in direct `bun test` execution.
2. **No Nuxt integration:** No equivalent to `@nuxt/test-utils`. Every Nitro/Nuxt global must be manually stubbed with no framework support.

vitest solves both — it runs on Node (native modules work) and `@nuxt/test-utils` provides `mockNuxtImport`, `mountSuspended`, `registerEndpoint`, etc.

### Performance Considerations

Tests in the `nuxt` environment boot a Nuxt instance, which is slow. One developer [reported](https://dev.to/aloisseckar/i-made-my-vitest-suite-in-nuxt-run-ten-times-faster-6j7) going from 180s to 18s by consolidating to a single Nuxt instance. The rule: **use `node` environment by default, `nuxt` environment only when strictly necessary** (component mounting, composables that need `useNuxtApp()`, etc.).

---

## Decision

### Test Runner & Libraries

| Package | Purpose |
|---------|---------|
| `vitest` (v4) | Test runner |
| `@nuxt/test-utils` (v4) | Nuxt vitest environment, `defineVitestProject`, mocking helpers |
| `@vue/test-utils` | Vue component mounting (`mount`, `shallowMount`) |
| `happy-dom` | DOM environment for component tests |

### Directory Structure

Each layer gets its own `tests/` directory and `vitest.config.ts`:

```
core/
  tests/
    unit/             ← node environment: pure logic, schema validation, formatData
    server/           ← node environment + setup-server.ts stubs: handlers, plugins, server utils
    nuxt/             ← nuxt environment: composables needing auto-imports, components
    setup-server.ts   ← vi.stubGlobal for Nitro auto-imports
  vitest.config.ts

organization/
  tests/
    unit/
    nuxt/
  vitest.config.ts

apps/*/
  tests/
    unit/
    server/
    nuxt/
    e2e/              ← apps get e2e tests, layers don't
  vitest.config.ts

vitest.workspace.ts   ← root: references all packages
```

### Three Test Environments

| Environment | Directory | Use For | Speed |
|-------------|-----------|---------|-------|
| `node` | `tests/unit/` | Pure functions, schemas, data transforms, business logic | Fast |
| `node` + server stubs | `tests/server/` | Server handlers, plugins, server utils (Nitro globals stubbed) | Fast |
| `nuxt` | `tests/nuxt/` | Composables needing `useNuxtApp()`, components, auto-imports | Slow |

**Default to `node`.** Only escalate to `nuxt` when a test genuinely needs the Nuxt runtime.

### Server Stubs Pattern

A shared setup file stubs Nitro globals for server tests:

```typescript
// tests/setup-server.ts
import { vi } from 'vitest'

// Nitro auto-imports — these are globals at runtime, stubs in tests
vi.stubGlobal('defineEventHandler', vi.fn((handler: Function) => handler))
vi.stubGlobal('defineNitroPlugin', vi.fn((plugin: Function) => plugin))
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getQuery', vi.fn())
vi.stubGlobal('getRouterParams', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => new Error(opts.statusMessage || opts.message)))
```

Referenced via `setupFiles` in the vitest config for the `server` project.

### Layer vitest.config.ts Pattern

Each layer's config follows the same structure. Example for `core/`:

```typescript
// core/vitest.config.ts
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core:unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'core:server',
          include: ['tests/server/**/*.{test,spec}.ts'],
          environment: 'node',
          setupFiles: ['tests/setup-server.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'core:nuxt',
          include: ['tests/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
```

### Root Workspace

```typescript
// vitest.workspace.ts
export default [
  'core/vitest.config.ts',
  'organization/vitest.config.ts',
  'apps/*/vitest.config.ts',
]
```

### File Naming

- Test files: `*.test.ts` (not `.spec.ts` — pick one convention)
- Mirror source paths: `core/server/utils/context.ts` → `core/tests/server/context.test.ts`
- Setup files: `setup-server.ts`, `setup-nuxt.ts` (not `.test.ts`)

### What Goes Where — Decision Table

| Code Under Test | Environment | Directory | Why |
|-----------------|-------------|-----------|-----|
| `logs-db.ts` (schema, writeLog) | `node` | `tests/unit/` | Pure SQLite, no Nuxt |
| `feature.ts` (createFeatureScope) | `node` | `tests/server/` | Uses Nitro globals (stubbed) |
| `defineFeatureHandler` | `node` | `tests/server/` | Wraps defineEventHandler (stubbed) |
| `defineFeatureComposable.ts` | `node` | `tests/unit/` | Pure function, no Nuxt deps |
| Vue components | `nuxt` | `tests/nuxt/` | Need auto-imports, mount |
| Composables using `useNuxtApp()` | `nuxt` | `tests/nuxt/` | Need Nuxt runtime |
| Composables that are pure functions | `node` | `tests/unit/` | No Nuxt deps |
| API route handlers | `node` | `tests/server/` | Nitro globals stubbed |
| e2e flows | `node` | `tests/e2e/` | Full HTTP via `@nuxt/test-utils/e2e` |

---

## Consequences

### Positive

- **No auto-import conflicts.** Tests live outside Nuxt-scanned directories.
- **Fast by default.** Most tests run in `node` environment — no Nuxt boot overhead.
- **Native modules work.** vitest runs on Node, so `better-sqlite3` loads correctly.
- **Layered testing.** Each layer tests independently, root workspace runs everything.
- **Framework-aligned.** Follows the exact structure from the [Nuxt 4 testing docs](https://nuxt.com/docs/4.x/getting-started/testing).

### Negative

- **Server stubs are manual.** Until [#531](https://github.com/nuxt/test-utils/issues/531) lands, Nitro globals must be stubbed by hand. If Nitro adds new auto-imports, we add new stubs.
- **Tests are separate from source.** Requires navigating between `server/utils/context.ts` and `tests/server/context.test.ts`. Mitigated by mirroring the directory structure.
- **`nuxt` environment is slow.** Component tests will be slower than unit tests. Keep the `nuxt` test count minimal.

### Risks

- **`@nuxt/test-utils` v4 requires vitest v4.** If vitest v4 introduces breaking changes to the workspace/projects API, our config may need updates. Mitigated by pinning versions.
- **Server environment support (#531) may change the architecture.** If `@nuxt/test-utils` adds a `nitro` environment, we could migrate `tests/server/` to use it instead of manual stubs. This would be additive, not breaking.
- **Workspace glob (`apps/*/vitest.config.ts`) may not work if no apps exist.** The smart launcher creates apps on first run; tests should handle the empty case gracefully or be skipped.

---

## References

- [Nuxt 4 Testing Docs](https://nuxt.com/docs/4.x/getting-started/testing) — official guide, vitest config, directory structure
- [Nuxt 4 Module Testing Docs](https://nuxt.com/docs/4.x/guide/modules/testing) — module-specific testing
- [`@nuxt/test-utils` GitHub](https://github.com/nuxt/test-utils) — source, issues, releases
- [`@nuxt/test-utils` v4.0.0 Release](https://github.com/nuxt/test-utils/releases) — vitest v4 requirement, improved mocking
- [Issue #531: Server Environment Support](https://github.com/nuxt/test-utils/issues/531) — open, tracks Nitro test environment
- [Issue #664: Vitest Workspaces](https://github.com/nuxt/test-utils/issues/664) — resolved, `defineVitestProject` works in workspaces
- [Issue #827: Nitro Auto-imports](https://github.com/nuxt/test-utils/issues/827) — closed, redirected to #531
- [Vitest Projects Docs](https://vitest.dev/guide/workspace) — `projects` config (replaces deprecated `workspace`)
