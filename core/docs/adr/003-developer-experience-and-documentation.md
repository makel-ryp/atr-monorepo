# ADR-003: Developer Experience, Documentation, and Demo Architecture

## Status
**Accepted** (Implemented 2026-02-03)

## Date
2026-02-03

## Context

This repository is designed as a **turnkey upstream template** that companies can fork and customize. The architecture must support:

1. **Upstream maintainers** (us) developing core features and demos
2. **Downstream customers** forking and building their own apps
3. **AI assistants** (Claude, Cursor, etc.) understanding and working with the codebase

Key problems identified with the current structure:

1. **Naming conflicts**: Customers wanting `/apps/admin` conflict with our demo
2. **Port confusion**: Developers must remember localhost:3001/3002/3003
3. **Demo noise**: Demos run by default, cluttering customer development
4. **No documentation system**: AI and humans lack structured knowledge access
5. **Script conflicts**: `/scripts/` at root may conflict with customer scripts

## Decision Drivers

1. **Zero-friction first experience**: New users should have a working app immediately
2. **Clean separation**: Demos vs customer apps must be clearly separated
3. **AI-native development**: Documentation should be queryable by AI via MCP
4. **Conflict avoidance**: Upstream files should never conflict with downstream customizations
5. **Living documentation**: Docs should auto-discover and describe the actual codebase

---

## Decisions

### Decision 1: Restructure Demos to `/demos/`

**Current structure:**
```
/apps/
  admin/    ← conflict risk
  demo/     ← unclear name
  www/      ← unclear name
```

**New structure:**
```
/demos/
  dashboard/   ← matches Nuxt UI template name
  saas/        ← matches Nuxt UI template name
  landing/     ← matches Nuxt UI template name
/apps/         ← empty, reserved for customers
```

**Rationale:**
- `/demos/` clearly indicates "reference implementations, not your code"
- Customers can delete `/demos/` entirely without merge conflicts
- Naming matches [Nuxt UI templates](https://ui.nuxt.com/templates) for instant recognition
- `/apps/` is reserved exclusively for customer applications

**Naming mapping:**
| Old Name | New Name | Nuxt UI Template |
|----------|----------|------------------|
| admin | dashboard | [Dashboard](https://ui.nuxt.com/templates/dashboard) |
| demo | saas | [SaaS](https://ui.nuxt.com/templates/saas) |
| www | landing | [Landing](https://ui.nuxt.com/templates/landing) |

---

### Decision 2: Smart Dev Launcher with First-Run Setup

**Problem**: If `bun run dev` only runs `/apps/*` and it's empty, nothing runs.

**Solution**: A smart launcher script that detects first-run state.

**Flow:**
```
bun run dev
    │
    ├── /apps/ is empty?
    │   │
    │   └── Interactive prompt:
    │       "No apps found. Would you like to:"
    │       1. Copy 'dashboard' demo → /apps/my-app
    │       2. Copy 'saas' demo → /apps/my-app
    │       3. Copy 'landing' demo → /apps/my-app
    │       4. Run 'bun run dev:demos' to explore first
    │       5. Browse documentation at localhost:3000
    │
    └── /apps/ has content?
        │
        └── Run turbo dev (apps + docs)
```

**Scripts:**
```json
{
  "dev": "node core/cli/dev.js",
  "dev:apps": "turbo run dev --filter=./apps/*",
  "dev:demos": "turbo run dev --filter=./demos/*",
  "dev:all": "turbo run dev",
  "build": "turbo run build --filter=./apps/*"
}
```

**Rationale:**
- First-time users get guided setup, not an empty/broken state
- Experienced users with apps just run `dev` and it works
- Core developers use `dev:demos` for daily work
- Production builds (`build`) only include customer apps, never demos

---

### Decision 3: Living Documentation in `/core/docs/`

**Problem**: Scripts and documentation at root may conflict with customer files.

**Solution**: All upstream tooling lives inside `/core/`:

```
/core/
  ├── nuxt.config.ts       ← the layer (components, composables)
  ├── components/
  ├── composables/
  │
  ├── cli/                 ← dev scripts live here
  │   ├── dev.js           ← smart launcher
  │   └── utils/
  │
  └── docs/                ← Nuxt docs template
      ├── nuxt.config.ts
      ├── content/
      │   ├── 1.getting-started/
      │   ├── 2.demos/
      │   │   ├── 1.dashboard.md
      │   │   ├── 2.saas.md
      │   │   └── 3.landing.md
      │   └── 3.guides/
      ├── server/
      │   └── mcp/         ← custom MCP tools
      └── package.json     ← @app-agent/docs
```

**Rationale:**
- Customers never touch `/core/` except to pull updates
- `/core/cli/` avoids conflicts with customer `/scripts/`
- `/core/docs/` avoids conflicts with customer `/docs/` or `/documentation/`
- Clear ownership: everything in `/core/` is upstream-maintained

---

### Decision 4: MCP Server for AI-Native Documentation

**What**: The docs app uses [Nuxt Docs Template](https://docs-template.nuxt.dev/) which includes a built-in MCP server.

**Built-in MCP tools:**
- `list-pages` - Lists all documentation pages
- `get-page` - Retrieves full markdown content

**Custom MCP tools we add:**

| Tool | Description |
|------|-------------|
| `list-apps` | Returns all apps in `/apps/*` and `/demos/*` with metadata |
| `get-app-structure` | Returns file tree for any app |
| `list-components` | Lists all components in an app |
| `list-pages` | Lists all pages/routes in an app |
| `list-composables` | Lists all composables |
| `list-api-routes` | Lists all server API routes |
| `get-file` | Returns source code of any file |

**Usage:**
```bash
# Add to Claude Code once
claude mcp add --transport http app-agent-docs http://localhost:3000/mcp
```

**Rationale:**
- AI can query "what demos are available?" and get structured answers
- AI can introspect customer apps without manual documentation
- Always up-to-date - reads actual filesystem, not stale docs
- Follows [Nuxt's MCP approach](https://nuxt.com/blog/building-nuxt-mcp)

---

### Decision 5: Demo Metadata in Documentation

**Problem**: Where do we define demo metadata (description, port, links)?

**Solution**: Markdown frontmatter in `/core/docs/content/demos/`:

```yaml
# /core/docs/content/2.demos/1.dashboard.md
---
title: Dashboard
description: Internal tools, admin panels, analytics dashboards
port: 3001
nuxtUiTemplate: https://ui.nuxt.com/templates/dashboard
features:
  - Admin authentication
  - Data tables
  - Charts and analytics
  - Settings panels
---

The Dashboard demo showcases patterns for building internal tools...
```

**How it's used:**
1. **Dev launcher** reads this to show demo options
2. **MCP server** exposes it for AI queries
3. **Humans** can browse at localhost:3000/demos/dashboard

**Rationale:**
- Single source of truth for demo metadata
- Human-readable markdown format
- Queryable by both the CLI and MCP server
- Easy to extend with new fields

---

### Decision 6: Auto-Introspection of Customer Apps

**Problem**: How does AI learn about customer apps without manual documentation?

**Solution**: MCP tools dynamically scan `/apps/*` directory:

```typescript
// core/docs/server/mcp/tools/list-apps.ts
export default defineMCPTool({
  name: 'list-apps',
  description: 'List all apps and demos in the monorepo',
  async handler() {
    const apps = await scanDirectory('../../apps')
    const demos = await scanDirectory('../../demos')
    return {
      apps: apps.map(analyzeNuxtApp),
      demos: demos.map(analyzeNuxtApp)
    }
  }
})
```

**What gets auto-discovered:**
- App name and package.json metadata
- Directory structure
- Components (from `/app/components/`)
- Pages/routes (from `/app/pages/`)
- Composables (from `/app/composables/`)
- API routes (from `/server/api/`)
- Nuxt config settings

**Example AI interaction:**
```
Developer: "Add a page similar to the dashboard's analytics page"

AI (via MCP):
  1. list-apps → finds dashboard in /demos
  2. list-pages("dashboard") → finds /app/pages/analytics.vue
  3. get-file("demos/dashboard/app/pages/analytics.vue") → reads source
  4. Understands pattern, creates new page in customer app
```

**Rationale:**
- Zero documentation effort for customer apps
- Always up-to-date (reads filesystem)
- AI learns customer patterns automatically
- Same introspection for demos AND customer apps

---

### Decision 7: TypeScript Checking Disabled in Dev

**Problem**: `vite-plugin-checker` has a [known bug](https://github.com/fi3ework/vite-plugin-checker/issues/610) on Windows + monorepos where it fails to copy TypeScript lib files, causing false errors like "Cannot find global type 'Boolean'".

**Solution**: Disable `typeCheck` in all Nuxt configs:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  typescript: {
    typeCheck: false
  }
})
```

**Type checking is still available via:**
1. **IDE** (VS Code + Volar) - real-time inline errors
2. **Manual command** - `bun run typecheck`
3. **CI pipeline** - run typecheck in CI

**Rationale:**
- Bug is upstream in vite-plugin-checker, unfixed as of v0.12.0
- Affects Nuxt 4.2.0+, Windows, and monorepo workspaces
- The "errors" were false positives, not real type issues
- IDE still provides excellent type checking experience
- We stay on latest versions instead of downgrading

**References:**
- [vite-plugin-checker #610](https://github.com/fi3ework/vite-plugin-checker/issues/610)
- [Nuxt #33647](https://github.com/nuxt/nuxt/issues/33647)

---

### Decision 8: Documentation Excluded from Production Builds

**Problem**: Docs should run during dev (for AI MCP access) but not be included in customer production builds.

**Solution**: Docs is a separate app, not part of the layer:

```json
{
  "scripts": {
    "dev": "node core/cli/dev.js",      // runs docs + apps
    "build": "turbo run build --filter=./apps/*"  // only apps
  }
}
```

**Rationale:**
- Customer apps `extend: ['../../core']` - they extend the layer, not docs
- Docs is a sibling that runs during dev, not a dependency
- Production builds explicitly filter to `/apps/*` only
- If customers want to deploy docs separately: `bun run build:docs`

---

## New Directory Structure

```
app-agent.io/
├── core/                          # Upstream-maintained (customers pull updates)
│   ├── nuxt.config.ts             # The Nuxt layer
│   ├── app/
│   │   ├── components/            # Shared UI components
│   │   ├── composables/           # Shared composables
│   │   └── layouts/               # Base layouts
│   │
│   ├── cli/                       # Dev tooling
│   │   ├── dev.js                 # Smart launcher
│   │   └── utils/
│   │
│   └── docs/                      # Living documentation
│       ├── nuxt.config.ts
│       ├── app/
│       ├── content/               # Markdown documentation
│       │   ├── 1.getting-started/
│       │   ├── 2.demos/
│       │   └── 3.guides/
│       ├── server/
│       │   └── mcp/               # Custom MCP tools
│       └── package.json           # @app-agent/docs
│
├── demos/                         # Reference implementations
│   ├── dashboard/                 # Admin/internal tools pattern
│   │   ├── nuxt.config.ts         # extends: ['../../core']
│   │   └── app/
│   ├── saas/                      # Customer-facing app pattern
│   │   └── ...
│   └── landing/                   # Marketing site pattern
│       └── ...
│
├── apps/                          # Customer applications (empty in upstream)
│   └── .gitkeep
│
├── packages/                      # Shared non-Nuxt packages
│   └── types/
│
├── turbo.json
├── package.json
└── bun.lock
```

---

## Updated Package Scripts

```json
{
  "scripts": {
    "dev": "node core/cli/dev.js",
    "dev:apps": "turbo run dev --filter=./apps/*",
    "dev:demos": "turbo run dev --filter=./demos/*",
    "dev:docs": "turbo run dev --filter=@app-agent/docs",
    "dev:all": "turbo run dev",
    "build": "turbo run build --filter=./apps/*",
    "build:docs": "turbo run build --filter=@app-agent/docs",
    "typecheck": "turbo run typecheck"
  }
}
```

---

## Implementation Plan

### Phase 1: Restructure Demos
1. Create `/demos/` directory
2. Move and rename: `apps/admin` → `demos/dashboard`
3. Move and rename: `apps/demo` → `demos/saas`
4. Move and rename: `apps/www` → `demos/landing`
5. Update package names: `@app-agent/demo-dashboard`, etc.
6. Update ports: dashboard:3010, saas:3011, landing:3012 (reserve 3001-3009 for customer apps)
7. Create empty `/apps/.gitkeep`
8. Update `workspaces` in root package.json

### Phase 2: Update Build Configuration
1. Update turbo.json with new paths
2. Update root package.json scripts with filters
3. Remove old app-specific scripts (dev:admin, dev:demo, dev:www)
4. Test that `dev:demos` and `build` work correctly

### Phase 3: Create Smart Dev Launcher
1. Create `/core/cli/dev.js`
2. Implement `/apps/` empty detection
3. Implement interactive demo selection
4. Implement demo copy functionality
5. Test first-run experience

### Phase 4: Set Up Documentation
1. Initialize Nuxt docs template in `/core/docs/`
2. Configure MCP server
3. Create demo documentation pages with frontmatter
4. Wire up dev launcher to read from docs content

### Phase 5: Implement Custom MCP Tools
1. Create `list-apps` tool
2. Create `get-app-structure` tool
3. Create `list-components`, `list-pages`, etc.
4. Create `get-file` tool
5. Test AI introspection capabilities

### Phase 6: Migration Cleanup
1. Move `/documentation/ADR/*` content into `/core/docs/content/`
2. Update any hardcoded paths
3. Update README with new structure
4. Delete old `/documentation/` directory

---

## Consequences

### Positive
- Clear separation between upstream (core, demos) and downstream (apps)
- Zero merge conflicts when customers create their own apps
- AI assistants have structured access to entire codebase
- First-time users get guided, working experience
- Documentation stays in sync with actual code

### Negative
- More complex initial setup (docs app, MCP tools)
- Customers must understand the demo vs apps distinction
- MCP server requires docs to be running for AI benefits

### Neutral
- Demos are opt-in to run, opt-in to keep
- Documentation can be deployed separately or not at all
- Structure matches Nuxt UI conventions

---

## Resolved Questions

### 1. Should docs auto-start with dev?
**Yes.** Without docs running, AI is crippled (no MCP access). Additionally:
- Developers familiar with Nuxt expect localhost:3000
- Docs can orient them to what's actually running (ports, apps, demos)
- MCP provides real-time introspection of running services

### 2. Port assignments
**Docs: 3000, Customer apps: 3001+, Demos: 3010+**

Customer apps are first-class citizens:
- `bun run dev` with customer apps → docs:3000, their-app:3001
- `bun run dev:demos` → docs:3000, dashboard:3010, saas:3011, landing:3012

Ports should be easily customizable (via config or nuxt.config.ts).

### 3. Copy vs symlink when creating app from demo
**Full copy, always.** Rationale:
- Symlinks create confusion: "I changed this file but it affected the demo!"
- Upstream owns `/demos/` - changes there shouldn't affect customer apps
- User chooses the folder name (e.g., "my-admin", "client-portal")
- Users can copy the same demo multiple times:
  - Copy 1: Their working app
  - Copy 2: Pristine reference to compare against
- Extra ~10mb of files is worth the DX clarity
- Clean mental model: "demos are read-only references, apps are yours"

---

## References

- [Nuxt UI Templates](https://ui.nuxt.com/templates) - Free, MIT licensed
- [Nuxt Docs Template](https://docs-template.nuxt.dev/) - With MCP server
- [Building Nuxt MCP](https://nuxt.com/blog/building-nuxt-mcp) - Official blog post
- [MCP Server Docs](https://ui.nuxt.com/docs/getting-started/ai/mcp) - Configuration guide
- [vite-plugin-checker #610](https://github.com/fi3ework/vite-plugin-checker/issues/610) - TypeScript bug
- [Turborepo Filters](https://turbo.build/repo/docs/reference/run#--filter-string) - Filter syntax
