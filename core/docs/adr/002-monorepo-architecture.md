# ADR-002: Monorepo Architecture with Nuxt Layers

## Status
**Accepted**

## Date
2026-02-02

## Context

We need to restructure the project into a monorepo containing:
- **Core**: Shared components, composables, utilities, and base configuration
- **Admin App**: Admin interface with the **only** backend/API (`admin.app-agent.io`)
- **Demo App**: Demo/landing page (no backend, consumes Admin API) (`demo.app-agent.io`)
- **WWW App**: Main website/SaaS pricing (no backend, consumes Admin API) (`www.app-agent.io`)

The apps are based on official Nuxt UI templates:
- Admin: https://dashboard-template.nuxt.dev/
- Demo: https://landing-template.nuxt.dev/
- WWW: https://saas-template.nuxt.dev/

## Architecture

```
app-agent.io/
├── apps/
│   ├── admin/              # Admin app WITH API (extends core)
│   │   ├── app/            # admin.app-agent.io
│   │   ├── server/         # API lives here ONLY
│   │   └── nuxt.config.ts  # extends: ['../../core']
│   │
│   ├── demo/               # Demo/landing site (extends core)
│   │   ├── app/            # demo.app-agent.io
│   │   └── nuxt.config.ts  # extends: ['../../core']
│   │
│   └── www/                # Main website/SaaS (extends core)
│       ├── app/            # www.app-agent.io
│       └── nuxt.config.ts  # extends: ['../../core']
│
├── core/                   # Nuxt Layer (shared code)
│   ├── app/
│   │   ├── components/     # Shared components
│   │   ├── composables/    # Shared composables
│   │   ├── layouts/        # Base layouts
│   │   └── utils/          # Shared utilities
│   ├── server/
│   │   └── utils/          # Shared server utilities (NOT API routes)
│   └── nuxt.config.ts      # Base configuration
│
├── packages/               # Optional: non-Nuxt shared packages
│   └── types/              # Shared TypeScript types
│
├── turbo.json              # Turborepo configuration
├── package.json            # Root workspace config
└── bun.lock
```

## Decision Drivers

1. **Code Reuse**: Components, composables, and config shared across apps
2. **Single API Source**: Dashboard owns the API; other apps are consumers
3. **Independent Deployment**: Each app can be deployed separately
4. **Developer Experience**: Fast builds, HMR, TypeScript support
5. **Template Compatibility**: Leverage official Nuxt UI templates

---

## Challenges & Gotchas

### 1. Nuxt Layer Alias Resolution (Critical)

**Problem**: `~/` and `@/` in layers resolve to the **consuming app's** paths, not the layer's.

```typescript
// In core/app/components/Button.vue
import { useUtil } from '~/utils/helper'  // WRONG: resolves to apps/dashboard/utils/
import { useUtil } from '#imports'         // CORRECT: auto-imported
```

**Solution**:
- Use auto-imports (composables, components are auto-imported)
- For explicit imports in core, use relative paths or configure aliases:

```typescript
// core/nuxt.config.ts
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  alias: {
    '#core': currentDir
  }
})
```

### 2. Bun Workspace Quirks

**Problem**: `bun add package` in a workspace may install to root instead of the app.

**Solution**: Always use `--cwd` flag:

```bash
# Correct way to add dependencies
bun add @nuxt/ui --cwd apps/dashboard
bun add lodash --cwd core
```

### 3. API Architecture Complexity

**Problem**: Only Dashboard has the API. Other apps must call it via HTTP, meaning:
- Dashboard must be running/deployed for other apps to work
- Need CORS configuration
- Different base URLs for dev/staging/prod

**Solution**:

```typescript
// apps/landing/nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // Different per environment
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api'
    }
  }
})

// apps/dashboard/nuxt.config.ts (port 3001)
export default defineNuxtConfig({
  devServer: { port: 3001 },
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*' // Restrict in production
        }
      }
    }
  }
})
```

### 4. Template Integration Complexity

**Problem**: Nuxt UI templates (dashboard, landing, saas) have their own:
- Components that may conflict with core
- Layouts with specific structures
- Configurations that need merging

**Solution**:
- Clone templates as starting points, don't try to extend them as layers
- Move truly shared code to core
- Keep template-specific components in each app
- Use naming conventions to avoid conflicts (`CoreButton` vs `DashboardButton`)

### 5. TypeScript Path Resolution

**Problem**: TypeScript needs to understand cross-package imports.

**Solution**: Configure paths in each app's tsconfig:

```json
// apps/dashboard/tsconfig.json
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

### 6. Hot Module Replacement (HMR)

**Problem**: Changes in `core/` may not trigger HMR in apps.

**Solution**: Configure Nuxt to watch the core directory:

```typescript
// apps/dashboard/nuxt.config.ts
export default defineNuxtConfig({
  extends: ['../../core'],
  watch: ['../../core/**/*']
})
```

### 7. Build Order Dependencies

**Problem**:
- Core must be "prepared" before apps can build
- Dashboard API must be deployed before other apps work in production

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

### 8. Deployment Coordination

**Problem**: Apps depend on Dashboard API being available.

**Considerations**:
- Deploy Dashboard first
- Use health checks before deploying other apps
- Consider API versioning for breaking changes
- May need staging environment coordination

---

## Layer Inheritance Model

```
┌─────────────────────────────────────────────────────────┐
│                      APPS (Consumers)                    │
├─────────────────┬─────────────────┬─────────────────────┤
│      Admin      │       Demo      │        WWW          │
│   (port 3001)   │   (port 3002)   │    (port 3003)      │
│ admin.app-agent │ demo.app-agent  │  www.app-agent      │
│                 │                 │                     │
│  ┌───────────┐  │                 │                     │
│  │  server/  │  │  (no server/)   │   (no server/)      │
│  │   api/    │  │                 │                     │
│  └───────────┘  │                 │                     │
│                 │                 │                     │
│  extends ───────┼── extends ──────┼── extends ──────────┤
└─────────────────┴─────────────────┴─────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    CORE (Nuxt Layer)                     │
├─────────────────────────────────────────────────────────┤
│  app/                                                    │
│  ├── components/    # Shared UI components              │
│  ├── composables/   # useApi(), useAuth(), etc.         │
│  ├── layouts/       # Base layouts                       │
│  └── utils/         # Shared utilities                   │
│                                                          │
│  server/                                                 │
│  └── utils/         # Shared server utils (NOT routes)  │
│                                                          │
│  nuxt.config.ts     # Base modules, runtimeConfig       │
└─────────────────────────────────────────────────────────┘
```

---

## What Goes Where?

| Item | Location | Reason |
|------|----------|--------|
| Shared components (Button, Card, Modal) | `core/app/components/` | Used by all apps |
| API routes | `apps/admin/server/api/` | Single source of truth |
| Auth composables | `core/app/composables/` | All apps need auth |
| Admin-specific components | `apps/admin/app/components/` | Only admin uses them |
| Demo page sections | `apps/demo/app/components/` | Only demo uses them |
| WWW/SaaS components | `apps/www/app/components/` | Only www uses them |
| TypeScript interfaces | `packages/types/` | Shared across all |
| Base Nuxt config (modules) | `core/nuxt.config.ts` | Inherited by all |
| App-specific config | `apps/*/nuxt.config.ts` | Per-app overrides |

---

## Development Workflow

### Starting Development

```bash
# Start all apps (parallel)
bun run dev

# Start specific app
bun run dev --filter=admin
bun run dev --filter=demo
bun run dev --filter=www

# Admin must be running for demo/www to fetch API
```

### Adding Dependencies

```bash
# Add to specific app
bun add some-package --cwd apps/admin

# Add to core (shared)
bun add some-package --cwd core

# Add to root (dev tools)
bun add -d turbo
```

### Building

```bash
# Build all (respects dependencies)
bun run build

# Build specific
bun run build --filter=admin
```

---

## Alternative Approaches Considered

### Option A: Separate Repositories
- **Pros**: Complete isolation, simpler CI/CD
- **Cons**: Code duplication, version drift, harder to share

### Option B: Single Nuxt App with Route Groups
- **Pros**: Simpler setup, single deployment
- **Cons**: Monolithic, can't deploy independently, harder to scale team

### Option C: Nuxt Layers (Selected)
- **Pros**: Code sharing, independent deployment, Nuxt-native solution
- **Cons**: Complexity in setup, alias gotchas, build coordination

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Core changes break apps | High | Add integration tests, version core |
| API downtime affects all apps | High | Health checks, error boundaries, fallbacks |
| Template updates conflict | Medium | Pin template versions, document customizations |
| HMR reliability issues | Low | Restart dev server, configure watch paths |
| Build time increases | Low | Turborepo caching, parallel builds |

---

## Decisions Made

1. **API Design**: Demo and WWW apps call Admin API **directly** (no BFF proxy)

2. **Authentication**: **Cookies** shared across subdomains (`.app-agent.io`)
   - Cookies set with `domain=.app-agent.io` are accessible to all subdomains
   - Requires proper CORS configuration on Admin API

3. **Deployment Strategy**: **Subdomains**
   - `admin.app-agent.io` - Admin dashboard (has API)
   - `demo.app-agent.io` - Demo/landing page
   - `www.app-agent.io` - Main website/SaaS pricing

4. **Core Versioning**: Always use latest (monorepo, no versioning needed)

5. **Template Customization**: Start from official Nuxt UI templates, customize over time

---

## Cookie Configuration for Cross-Subdomain Auth

```typescript
// apps/admin/server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  // ... auth logic ...

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: '.app-agent.io',  // Accessible to all subdomains
    path: '/',
    maxAge: 60 * 60 * 24 * 7  // 7 days
  })
})
```

## CORS Configuration

```typescript
// apps/admin/nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'https://demo.app-agent.io,https://www.app-agent.io',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }
      }
    }
  }
})
```

## References

- [Nuxt Layers Documentation](https://nuxt.com/docs/4.x/guide/going-further/layers)
- [Turborepo + Nuxt Guide](https://turborepo.dev/docs/guides/frameworks/nuxt)
- [Nuxt Monorepo Example](https://github.com/serkodev/nuxt-monorepo)
- [Bun Workspaces](https://bun.com/docs/guides/install/workspaces)
- [Vue School: Nuxt Monorepos](https://vueschool.io/articles/vuejs-tutorials/scalable-nuxt-3-monorepos-with-pnpm-workspaces/)
