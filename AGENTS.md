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
- `core/docs/adr/` — architecture decision records (read before architectural changes)
- `core/docs/knowledge/` — slug-based knowledge base (see Context section)
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
bun run dev:demos        # Run all demos + docs
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
| 3001–3009 | Customer apps |
| 3010–3013 | Demos (dashboard, saas, landing, chat) |

## Key Constraints

- `runtimeConfig` is startup config, NOT runtime — see ADR-005 for actual runtime config
- Nuxt/Nitro versions are pinned — do NOT upgrade without reviewing `useRuntimeConfig()` mutability contract (ADR-005 Risks)
- `$meta` is an existing Nuxt convention — use it for governance namespace
- Secrets: use `.public` vs private `runtimeConfig` — no custom `$secret` needed
- Env vars (`NUXT_*`) are for provisioning only (DB connection, port)

## Conventions

### Code Annotations — `// CONTEXT: slug`

Mark code with context slugs to link to deeper knowledge:

```typescript
// CONTEXT: rate-limiting — Token bucket inherited from core layer
export default defineEventHandler(async (event) => { /* ... */ })
```

When you encounter a `// CONTEXT: slug` annotation, look up the slug in
`core/docs/knowledge/{slug}/` before modifying the annotated code.

Each slug directory can contain these aspect files:

| File | Purpose |
|------|---------|
| `description.md` | One-liner: what is this? |
| `overview.md` | 5–15 line summary |
| `faq.md` | Common questions and gotchas |
| `reasoning.md` | Why this decision was made |
| `details.md` | Full technical deep-dive |
| `history.md` | How this evolved |

### Runtime Context Wrapper

Executable code uses `context()` wrappers for slug-tagged instrumentation:

```typescript
export default defineContextHandler('rate-limiting', async (ctx, event) => {
  ctx.log('checking', event.path)  // tagged logging → logs.db
})
```

Variants: `defineContextHandler`, `defineContextComposable`, `defineContextPlugin`.
Production behavior: pass-through (single boolean check, zero overhead).

### Layer Override Rules

- Components/pages: higher layer completely replaces lower layer
- Config objects: deep-merged via `defu`
- Arrays (modules, css, plugins): concatenated across all layers
- Server middleware: ALL layers run (additive)

## Context Oracle (MCP) — In Progress

The `/docs` app will expose MCP tools for on-demand project knowledge:

- `explain(slug, aspect)` — read context for any slug
- `record(slug, aspect, content)` — capture knowledge during work sessions

If your tool supports MCP, connect to the docs app server (port 3000).
If not, read `core/docs/knowledge/{slug}/{aspect}.md` directly.

Don't pre-load all documentation. Ask for context when you need it.

## ADRs

Read these before making architectural changes (`core/docs/adr/NNN-title.md`):

| ADR | Topic |
|-----|-------|
| 001 | Nuxt 4 application setup |
| 002 | Monorepo architecture |
| 003 | Developer experience and documentation |
| 004 | Layer cascade, i18n, cross-cutting concerns |
| 005 | Runtime configuration service |
| 006 | Context oracle (this system — in progress) |
| 007 | Testing strategy (vitest, @nuxt/test-utils, directory structure) |

## Rules

- Challenge architectural decisions and assumptions. Do not default to agreement.
- If a proposal conflicts with an ADR, established pattern, or known constraint, say so directly.
- When multiple valid approaches exist, present trade-offs rather than picking the first option.
- Push back on technical debt, coupling, or scope creep with a concrete alternative.
- "I disagree because..." is always acceptable. Agreeing when you shouldn't is not.
