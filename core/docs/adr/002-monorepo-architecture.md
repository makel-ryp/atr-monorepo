# ADR-002: Monorepo Architecture with Nuxt Layers

## Status
**Accepted**

## Date
2026-02-02

## Context

We need a monorepo structure that supports:
- **Core**: Shared components, composables, utilities, and base configuration
- **Organization**: Company branding layer (name, logo, colors)
- **Demos**: Reference implementations for learning patterns
- **Apps**: Customer applications built on top of the layers

The architecture must allow customers to fork, customize, and pull upstream updates without merge conflicts.

## Architecture

```
app-agent.io/
├── core/                      # Nuxt Layer (upstream maintained)
│   ├── app/
│   │   ├── components/        # Shared components
│   │   ├── composables/       # useApi(), etc.
│   │   └── layouts/           # Base layouts
│   ├── server/
│   │   └── utils/             # Shared server utilities
│   ├── cli/
│   │   └── dev.js             # Smart dev launcher
│   └── docs/                  # Documentation app with MCP
│       ├── content/           # Markdown docs
│       ├── adr/               # Architecture Decision Records
│       └── server/mcp/        # MCP tools for AI
│
├── organization/              # YOUR company branding layer
│   ├── app/
│   │   └── app.config.ts      # Brand name, logo, colors
│   ├── public/                # Company assets
│   └── nuxt.config.ts         # extends: ['../core']
│
├── docs/                      # YOUR documentation app
│   ├── content/               # Your docs (merged with core docs)
│   └── nuxt.config.ts         # extends: ['../core/docs']
│
├── demos/                     # Reference implementations (read-only)
│   ├── dashboard/             # Port 3010 - Admin panels, internal tools
│   ├── saas/                  # Port 3011 - Customer-facing app
│   └── landing/               # Port 3012 - Marketing sites
│
├── apps/                      # YOUR applications (port 3001+)
│   └── .gitkeep               # Empty in upstream, yours to fill
│
├── packages/                  # Optional: non-Nuxt shared packages
│   └── types/                 # Shared TypeScript types
│
├── turbo.json                 # Turborepo configuration
├── package.json               # Root workspace config
└── bun.lock
```

## Decision Drivers

1. **Code Reuse**: Components, composables, and config shared across apps
2. **Clean Separation**: Upstream code (core, demos) vs downstream code (apps)
3. **Zero Merge Conflicts**: Customer code in `/apps/` never conflicts with upstream
4. **Developer Experience**: Fast builds, HMR, TypeScript support
5. **AI-Native**: MCP server enables AI introspection of entire codebase

---

## Layer Inheritance Model

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR APPS & DOCS                          │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   /apps/*   │   /docs/    │ dashboard   │  saas  │ landing  │
│  (3001+)    │   (3000)    │   (3010)    │ (3011) │  (3012)  │
│             │             │             │        │          │
│  extends ───┴── extends ──┴── extends ──┴────────┴──────────┤
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ORGANIZATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  /organization/                                              │
│  ├── app/app.config.ts   # Brand name, logo, colors         │
│  └── public/             # Company assets                    │
│                                                              │
│  extends ────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CORE LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  /core/                                                      │
│  ├── app/components/     # Shared UI components             │
│  ├── app/composables/    # useApi(), useAuth(), etc.        │
│  ├── app/layouts/        # Base layouts                      │
│  └── server/utils/       # Shared server utilities          │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Apps extend `organization`, which extends `core`. This gives all apps:
- Core functionality (composables, layouts)
- Company branding (configured once in organization)

---

## Challenges & Solutions

### 1. Nuxt Layer Alias Resolution

**Problem**: `~/` and `@/` in layers resolve to the **consuming app's** paths, not the layer's.

```typescript
// In core/app/components/Button.vue
import { useUtil } from '~/utils/helper'  // WRONG: resolves to app's utils/
import { useUtil } from '#imports'         // CORRECT: auto-imported
```

**Solution**:
- Use auto-imports (composables, components are auto-imported)
- For explicit imports in core, use relative paths or configure aliases

### 2. Bun Workspace Quirks

**Problem**: `bun add package` in a workspace may install to root.

**Solution**: Always use `--cwd` flag:

```bash
bun add @nuxt/ui --cwd apps/my-app
bun add lodash --cwd core
```

### 3. Hot Module Replacement (HMR)

**Problem**: Changes in `core/` may not trigger HMR in apps.

**Solution**: Configure Nuxt to watch the core directory:

```typescript
// apps/my-app/nuxt.config.ts
export default defineNuxtConfig({
  extends: ['../../organization'],
  watch: ['../../core/**/*', '../../organization/**/*']
})
```

### 4. Build Order Dependencies

**Problem**: Core must be prepared before apps can build.

**Solution**: Turborepo handles build order:

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", ".nuxt/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 5. TypeScript Path Resolution

**Problem**: TypeScript needs to understand cross-package imports.

**Solution**: Configure paths in each app's tsconfig:

```json
// apps/my-app/tsconfig.json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "#core/*": ["../../core/*"],
      "@app-agent/types": ["../../packages/types/src"]
    }
  }
}
```

---

## What Goes Where?

| Item | Location | Reason |
|------|----------|--------|
| Shared composables (useApi) | `core/app/composables/` | Used by all apps |
| Base layouts | `core/app/layouts/` | Inherited by all |
| Company branding | `organization/app/app.config.ts` | Configured once |
| Company logo/assets | `organization/public/` | Shared across apps |
| App-specific components | `apps/*/app/components/` | Only that app uses them |
| App-specific API routes | `apps/*/server/api/` | App's backend |
| Demo patterns | `demos/*/` | Reference implementations |
| TypeScript interfaces | `packages/types/` | Shared across all |
| Documentation | `docs/content/` | Your docs |
| MCP tools | `core/docs/server/mcp/` | AI introspection |

---

## Port Allocation

| App | Port | Description |
|-----|------|-------------|
| Documentation | 3000 | Docs site with MCP server |
| Customer Apps | 3001+ | Your applications in `/apps/` |
| Dashboard Demo | 3010 | Admin panels, internal tools |
| SaaS Demo | 3011 | Customer-facing app patterns |
| Landing Demo | 3012 | Marketing sites |
| Chat Demo | 3013 | AI chatbot with history |

---

## Development Workflow

### Starting Development

```bash
# Smart launcher - guides first-time setup or runs apps
bun run dev

# Run demos for reference
bun run dev:demos

# Run everything
bun run dev:all
```

### Adding Dependencies

```bash
# Add to specific app
bun add some-package --cwd apps/my-app

# Add to core (shared)
bun add some-package --cwd core

# Add to root (dev tools)
bun add -d turbo
```

### Building for Production

```bash
# Build customer apps only (not demos)
bun run build
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Core changes break apps | High | Test across demos before merging |
| Layer alias confusion | Medium | Use auto-imports, document patterns |
| HMR reliability | Low | Configure watch paths, restart dev |
| Build time increases | Low | Turborepo caching, parallel builds |

---

## References

- [Nuxt Layers Documentation](https://nuxt.com/docs/guide/going-further/layers)
- [Turborepo + Nuxt Guide](https://turborepo.dev/docs/guides/frameworks/nuxt)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [ADR-003](./003-developer-experience-and-documentation.md) - Developer experience decisions
