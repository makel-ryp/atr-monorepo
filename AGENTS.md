# AGENTS.md

Nuxt 4 layered monorepo — a standards-based, AI-focused "tech company in a box" framework.

> **Environment:** Windows (Git Bash). Always use forward slashes in paths.
> Never use `2>nul` (creates a literal file) — use `2>/dev/null` instead.

## Architecture

Three-layer cascade with config merging via `defu`:

```
core/           → Base platform (upstream-maintained)
organization/   → Brand & company config overrides
apps/*          → Customer applications (your code)
demos/          → Reference implementations (read-only)
```

Layer inheritance: `apps/*` extends `organization/` extends `core/`.
Config objects deep-merge, arrays concatenate, primitives override (higher layer wins).
Server middleware from ALL layers executes (additive, never overrides).
`null` in layer config means "defer to lower layer" — never use it to mean "disabled".

### Key Directories

- `core/app/` — shared components, composables, layouts, plugins (auto-imported)
- `core/docs/` — documentation app + MCP server (port 3000)
- `core/control/` — control plane app (port 3001)
- `core/docs/adr/` — architecture decision records (read before architectural changes)
- `core/docs/knowledge/` — slug-based feature knowledge (see Feature Knowledge section)
- `core/server/` — server middleware for cross-cutting concerns
- `core/cli/dev.js` — smart dev launcher with first-run setup
- `organization/` — brand config (`app.config.ts`), company assets
- `demos/` — dashboard (3010), saas (3011), landing (3012), chat (3013)
- `apps/` — customer apps (empty upstream, populated via smart launcher)
- `packages/types/` — shared TypeScript definitions

## Build & Dev

```bash
bun install              # Install dependencies
bun run dev              # Smart launcher (detects empty apps/, offers setup)
bun run dev:demos        # Run all demos + docs + control
bun run dev:control      # Control plane only (port 3001)
bun run dev:docs         # Documentation only (port 3000)
bun run typecheck        # TypeScript check (disabled during dev server)
bun run lint             # ESLint
bun run build            # Build apps/* only
bun run clean            # Clean all build artifacts
```

Package manager: `bun@1.2.15` (pinned). Runtime: Bun (`nitro: { preset: 'bun' }`).
Build orchestration: Turborepo. TypeScript strict mode is on.

### Port Allocation

| Range | Service |
|-------|---------|
| 3000 | Documentation + MCP server |
| 3001 | Control plane |
| 3002–3009 | Customer apps |
| 3010–3013 | Demos (dashboard, saas, landing, chat) |

## Secrets Management

<!-- SEE: feature "secrets-management" at core/docs/knowledge/secrets-management.md -->

Secret `.env` files are encrypted into `encrypted.json` (committed to git) using `multi-encrypt`.

```bash
bun run enc              # Encrypt all secret files (interactive password prompt)
bun run dec              # Decrypt all secret files (interactive password prompt)
```

**Manifest:** The `# Secrets` section at the bottom of `.gitignore` lists which files to encrypt. To add a new secret file, append its path there and run `bun run enc`.

**Auto-decrypt:** The smart launcher (`bun run dev`) checks for missing secret files on startup. If `encrypted.json` exists but listed `.env` files are missing, it prompts for the password automatically.

**CI/CD:** Store password as `MULTI_ENCRYPT_PASSWORD` GitHub Actions secret. Deploy workflows pipe it via stdin: `echo "$PASSWORD" | bunx multi-encrypt dec`.

**Adding secrets for a new app:** When `copyDemo()` copies a demo that has a `.env`, the launcher warns you to add the new path to `# Secrets` in `.gitignore` and run `bun run enc`.

## Key Constraints

- `runtimeConfig` is startup config, NOT runtime — see ADR-005 for actual runtime config
- Nuxt/Nitro versions are pinned — do NOT upgrade without reviewing `useRuntimeConfig()` mutability contract (ADR-005 Risks)
- `$meta` is an existing Nuxt convention — use it for governance namespace
- Secrets: use `.public` vs private `runtimeConfig` — no custom `$secret` needed
- Env vars (`NUXT_*`) are for provisioning only (DB connection, port)

## Conventions

### Code Annotations — `// SEE: feature "slug"`

Mark code with feature references to link to deeper knowledge:

```typescript
// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md
export default defineEventHandler(async (event) => { /* ... */ })
```

When you encounter a `// SEE: feature "slug"` annotation, look up the slug's
knowledge file before modifying the annotated code. The path after `at` points
directly to the knowledge file. If the file doesn't exist, create a stub as a
sub-task — broken references are repair work orders.

Knowledge files are single markdown files per slug with YAML frontmatter and H2
sections for aspects: description, overview, faq, reasoning, details, history.

### Runtime Feature Wrapper

Executable code uses `defineFeature*()` wrappers for slug-tagged instrumentation:

```typescript
export default defineFeatureHandler('rate-limiting', async (feat, event) => {
  feat.log('checking', event.path)  // tagged logging → logs.db
})
```

Variants: `defineFeatureHandler`, `defineFeatureComposable`, `defineFeaturePlugin`.
Production behavior: pass-through (single boolean check, zero overhead).

### Feature Nesting and Dependencies

Inside any `defineFeature*()` wrapper, use `feat.feature()` for containment and
`feat.getFeature()` for cross-feature dependencies:

```typescript
export default defineFeatureHandler('rate-limiting', async (feat, event) => {
  // Nest a sub-feature (containment edge)
  feat.feature('ip-throttle', (child) => {
    child.log('checking ip', event.path)
  })

  // Access another feature's scope (dependency edge)
  const auth = feat.getFeature('authentication')
  auth.log('verifying token')
})
```

`feature()` creates a fresh scope each call. `getFeature()` caches per parent scope
(meta accumulates across calls). Both record edges in the dev-mode feature registry.

### i18n Namespace Convention

Translation keys are namespaced by layer to prevent collisions:

- `core.*` — shared strings (actions, errors, status) in `core/i18n/locales/`
- `org.*` — brand/company strings in `organization/i18n/locales/`
- `app.*` — app-specific strings in `apps/*/i18n/locales/`

Usage: `$t('core.actions.save')`, `$t('org.name')`, `$t('app.dashboard.title')`.
Config: `@nuxtjs/i18n` installed at core, `langDir` must use absolute paths in layers.

### Layer Override Rules

- Components/pages: higher layer completely replaces lower layer
- Config objects: deep-merged via `defu`
- Arrays (modules, css, plugins): concatenated across all layers
- Server middleware: ALL layers run (additive)

## Runtime Config Service (ADR-005)

Hot-reloadable settings with `$meta.lock` governance. Provider-agnostic (PostgreSQL-compatible datasource).

- **Provider abstraction:** `core/server/utils/config-service/` — `ConfigProvider` interface
- **Providers:** `supabase` (implemented), `pg`, `neon`, `sqlite` (planned)
- **Extensible layer model:** `core → core:org → core:app → [...app-defined] → user`
  - Core layers (`core`, `core:org`) are always first with `app_id='*'`
  - App defines custom chain via `$meta.layers` in its `core:app` row
  - `user` is always last, keyed as `{appId}/{userId}`
  - Environment is a FILTER (exact match or `*`), not a merge position
- **`$meta.lock`:** paths locked by higher-priority layers cannot be overridden
- **API:** All routes require `appId` and `environment` params
  - `GET /api/settings?appId=...&environment=...&userId=...` — effective merged config
  - `PUT /api/settings/:key` — body: `{ value, appId, environment, layerName, layerKey }`
  - `DELETE /api/settings/:key?appId=...&environment=...&layerName=...&layerKey=...`
  - `GET /api/settings/audit?appId=...&environment=...&layerName=...&layerKey=...`
  - `GET /api/settings/stats`
- **DB setup:** Run `scripts/db-setup.sql` in your datasource's SQL editor
- **Core datasource env (NOT in runtimeConfig — read via process.env):**
  - `CORE_DATASOURCE_URL` — connection endpoint
  - `CORE_DATASOURCE_KEY` — service/admin API key
  - `CORE_DATASOURCE_PROVIDER` — which provider to load (default: `supabase`)
  - `CORE_ENVIRONMENT` — environment identifier (falls back to `NODE_ENV`)

## Authentication

<!-- SEE: feature "authentication" at core/docs/knowledge/authentication.md -->

Opt-in auth using `nuxt-auth-utils` with 3-role RBAC (public/registered/admin).

- **Core provides** types, server utils, middleware, composable, and `CoreUserMenu` component
- **Apps opt in** by adding `nuxt-auth-utils` to their `modules` array
- **User table:** `app_agent_users` (namespaced to avoid collision with client backends)
- **Two modes:** session-only (cookie, no DB) or database-backed (lookup-or-create via `DbAdapter`)

### Server guards (auto-imported)

```typescript
const user = await requireAuth(event)        // 401 if not logged in
const admin = await requireRole(event, 'admin') // 403 if not admin
const user = await getAuthUser(event)         // null if not logged in
```

### Client composable

```typescript
const { loggedIn, user, role, isAdmin, login, logout } = useAuth()
login('github')  // OAuth popup
```

### OAuth route pattern

Each app defines `server/routes/auth/[provider].get.ts` with a handlers map dispatching to `handleOAuthSuccess()`.

### Env vars

- `NUXT_SESSION_PASSWORD` — session encryption (auto-generated in dev)
- `NUXT_OAUTH_<PROVIDER>_CLIENT_ID` / `CLIENT_SECRET` — per-provider OAuth credentials

## Feature Knowledge (MCP) — In Progress

The `/docs` app exposes MCP tools for on-demand feature knowledge:

- `explain(slug, aspect)` — read knowledge for any feature slug
- `record(slug, aspect, content)` — capture knowledge during work sessions

If your tool supports MCP, connect to the docs app server (port 3000).
If not, read `core/docs/knowledge/{slug}.md` directly.

Don't pre-load all documentation. Ask for knowledge when you need it.

## ADRs

Read these before making architectural changes (`core/docs/adr/NNN-title.md`):

| ADR | Topic |
|-----|-------|
| 001 | Nuxt 4 application setup |
| 002 | Monorepo architecture |
| 003 | Developer experience and documentation |
| 004 | Layer cascade, i18n, cross-cutting concerns |
| 005 | Runtime configuration service |
| 006 | Feature knowledge system (in progress) |
| 007 | Testing strategy (vitest, @nuxt/test-utils, directory structure) |
| 008 | Naming: "context" → "feature" (rationale for the rename) |

## Rules

- NEVER start dev servers (`bun run dev`, `nuxi dev`, etc.). The user always has them running. Ask the user to restart if needed.
- Challenge architectural decisions and assumptions. Do not default to agreement.
- If a proposal conflicts with an ADR, established pattern, or known constraint, say so directly.
- When multiple valid approaches exist, present trade-offs rather than picking the first option.
- Push back on technical debt, coupling, or scope creep with a concrete alternative.
- "I disagree because..." is always acceptable. Agreeing when you shouldn't is not.
- Use precise constraint language ("immutable", "critical", "required by design"), not authority language ("sacrosanct", "unquestionable", "absolute"). Every assumption should feel challengeable.
