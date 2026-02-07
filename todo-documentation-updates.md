# Documentation Updates

This file tracks all documentation that needs updating across the codebase.

---

# Part 1: README Updates

## 1.1 Add Organization Layer Explanation

**Current state:** Not mentioned at all

**Needed:** Explain the 3-layer inheritance model:
- `/core/` - Upstream maintained (don't modify)
- `/organization/` - YOUR company branding (customize here)
- `/apps/*`, `/demos/*`, `/docs/` - All extend organization

Include that customers customize branding in `/organization/app/app.config.ts` (brand name, logo, colors, social links).

---

## 1.2 Fix Project Structure Diagram

**Current issues:**
- Shows `documentation/` for ADRs - actually at `/core/docs/adr/`
- Missing `/organization/` directory
- Missing `/docs/` (customer docs app)
- Says docs go in `/core/docs/content/` but customers use `/docs/content/`

**Corrected structure:**
```
app-agent/
├── core/                  # Shared Nuxt layer (upstream maintained)
│   ├── app/               # Shared components, composables
│   ├── cli/               # Dev tooling (smart launcher)
│   ├── server/            # Shared server utilities
│   └── docs/              # Documentation layer
│       ├── content/       # App Agent reference docs (read-only)
│       ├── adr/           # Architecture Decision Records
│       └── server/mcp/    # MCP server and tools
├── organization/          # YOUR company branding layer
│   ├── app/               # Brand config (app.config.ts)
│   └── public/            # Company assets (logos, etc.)
├── docs/                  # YOUR documentation app
│   ├── content/           # Add your docs here
│   └── app/               # Your doc site customizations
├── demos/                 # Reference implementations
│   ├── dashboard/         # Internal tools, admin panels (port 3010)
│   ├── saas/              # Customer-facing app patterns (port 3011)
│   └── landing/           # Marketing sites (port 3012)
├── apps/                  # Your applications (port 3001+)
└── packages/              # Optional shared packages
```

---

## 1.3 Add Complete Port Allocation

**Current:** Only shows demo ports (3010-3012)

**Add to table:**
| App | Port | Description |
|-----|------|-------------|
| Docs | 3000 | Documentation site with MCP server |
| Your Apps | 3001+ | Customer applications in /apps/ |
| Dashboard Demo | 3010 | Internal tools, admin panels |
| SaaS Demo | 3011 | Customer-facing application patterns |
| Landing Demo | 3012 | Marketing sites, landing pages |

---

## 1.4 List MCP Tools

**Current:** Just mentions MCP exists

**Add section listing available tools:**
- `list-apps` - Shows all apps and demos with metadata
- `list-components` - Lists components, pages, composables in any app
- `get-file` - Returns source code of any file
- `get-page` - Retrieves documentation content
- `list-pages` - Lists all routes in an app

---

## 1.5 Add API Architecture Section

**Current:** Not mentioned

**Add:**
- Explain `useApi()` composable from `/core/app/composables/useApi.ts`
- Show usage: `const { get, post, put, delete } = useApi()`
- Mention `apiBase` configuration via `NUXT_PUBLIC_API_BASE`
- Explain shared server utilities in `/core/server/`

---

## 1.6 Expand First-Run Experience

**Current:** "If `/apps/` is empty, you'll be guided to copy a demo as your starting point."

**Expand to explain the interactive CLI:**
1. Detects empty `/apps/` directory
2. Presents options:
   - Copy a demo as starting point
   - Explore demos first
   - Exit
3. Prompts for app name
4. Copies demo to `/apps/<your-name>/`
5. Updates package.json with new name
6. Starts development server

---

## 1.7 Explain Documentation System

**Current:** Vague "Add your docs here"

**Add section covering:**

### Content Collections
- `landing` - Index/landing page
- `docs` - App Agent reference docs (from /core/docs)
- `customerInternal` - Your internal docs (merges into /internal/)
- `customerDocs` - Your top-level doc sections

### Directory Structure
- `/docs/content/internal/` - Merges into internal section alongside App Agent docs
- `/docs/content/<section>/` - Creates new top-level navigation sections

### Navigation
- Numbered prefixes control order (e.g., `1.getting-started/`, `2.guides/`)
- `index.md` or `0.index.md` for section landing pages

---

# Part 2: Architecture Decision Records

## 2.1 ADR-002 is Entirely Outdated (CRITICAL)

**File:** `/core/docs/adr/002-monorepo-architecture.md`

**Problem:** Describes the OLD architecture that was superseded by ADR-003:
- Claims apps named `admin`, `demo`, `www` in `/apps/`
- Claims ports 3001, 3002, 3003
- Claims `extends: ['../../core']` directly
- References subdomains that don't exist

**Reality:**
- Demos are in `/demos/` (dashboard, saas, landing)
- Ports are 3000, 3010, 3011, 3012
- Apps extend `/organization/` which extends `/core/`

**Action:** Archive ADR-002 or rewrite to reflect current architecture. Consider marking as "Superseded by ADR-003".

---

# Part 3: Getting Started Documentation

## 3.1 Wrong Extends Path in Usage Docs (HIGH)

**File:** `/core/docs/content/1.internal/1.app-agent/1.getting-started/3.usage.md`

**Current (lines 42-62):**
```typescript
extends: ['../../core'],
```

**Should be:**
```typescript
extends: ['../../organization'],
```

**Impact:** Customers copying this example will create apps that don't inherit the organization layer, breaking company branding/defaults.

---

## 3.2 Non-Existent Component Reference (HIGH)

**File:** `/core/docs/content/1.internal/1.app-agent/1.getting-started/3.usage.md` (lines 113-118)

**Current:**
```vue
<CoreButton @click="handleClick">Click me</CoreButton>
```

**Problem:**
- No `CoreButton` component exists in `core/app/components/`
- Core only has `useApi.ts` composable and `default.vue` layout
- Actual components come from Nuxt UI, not this codebase

**Action:** Remove or replace with real example using Nuxt UI components (e.g., `<UButton>`).

---

## 3.3 Wrong First-Run CLI Options (MEDIUM)

**File:** `/core/docs/content/1.internal/1.app-agent/1.getting-started/2.installation.md` (lines 53-71)

**Documentation claims option 3 is:**
```
3. Browse documentation at localhost:3000
```

**Actual option 3 in `core/cli/dev.js` (lines 143-146):**
```
3. Exit
```

**Action:** Either update docs to match code, or update code to add the docs browsing option.

---

# Part 4: Demo Documentation

## 4.1 SaaS Demo Claims Unbuilt API Consumption (MEDIUM)

**File:** `/core/docs/content/1.internal/1.app-agent/2.demos/3.saas.md` (lines 49-60)

**Claims:**
```
This demo consumes APIs from the Dashboard demo, showing how multiple apps can share a single API source.
```

**Reality:**
- SaaS demo has NO `server/` directory
- Dashboard demo's `server/api/` contains minimal/no actual API implementations
- The cross-app API consumption pattern is not actually demonstrated

**Action:** Either implement the API consumption pattern or update documentation to reflect current state.

---

# Part 5: MCP Documentation

## 5.1 Missing Tool Documentation (MEDIUM)

**File:** `/core/docs/content/1.internal/1.app-agent/4.ai/1.mcp.md`

**Missing:** Documentation for `get-page` tool (exists in codebase but not documented)

**Incomplete:** Type filtering details in `list-components` may not match actual implementation

**Action:** Add `get-page` tool documentation and verify `list-components` filtering options.

---

# Summary Checklist

## README (`/README.md`)
- [x] Add organization layer explanation
- [x] Fix project structure diagram
- [x] Add complete port allocation table
- [x] List all MCP tools with descriptions
- [x] Add API architecture section
- [x] Expand first-run experience documentation
- [x] Explain documentation system and content collections

## ADRs (`/core/docs/adr/`)
- [x] Rewrote ADR-002 to reflect actual architecture (git tracks history)

## Getting Started Docs (`/core/docs/content/1.internal/1.app-agent/1.getting-started/`)
- [x] Fix extends path in usage.md (core → organization)
- [x] Remove/replace CoreButton example in usage.md
- [x] Fix CLI options in installation.md

## Demo Docs (`/core/docs/content/1.internal/1.app-agent/2.demos/`)
- [x] Update saas.md to reflect actual implementation

## MCP Docs (`/core/docs/content/1.internal/1.app-agent/4.ai/`)
- [x] get-page tool already documented (lines 88-99)
- [x] list-components filtering documented correctly
