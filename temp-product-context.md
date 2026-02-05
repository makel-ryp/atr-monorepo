# App Agent - Project Context

## Executive Summary

App Agent is a turnkey monorepo with an embedded AI development agent. It provides a production-ready foundation that customers fork and customize, with full ownership and zero lock-in.

**One-liner:** "Describing your product makes it exist."

**Domain:** app-agent.io

---

## The Offering

### What Customers Get

1. **Complete Platform Codebase**
   - Nuxt 4 monorepo with layering architecture
   - Auth, billing, admin, multi-tenancy built-in (planned)
   - SOC2 compliance infrastructure - audit logs with undo/redo (planned)
   - Feature flag system with hot-reload across all nodes globally (planned)
   - Works anywhere: GCP, AWS, Azure, Vercel, Cloudflare, on-prem, air-gapped

2. **Embedded AI Development Agent**
   - Understands the entire codebase via MCP
   - Can build features on request
   - Works with Claude Code, Cursor, Windsurf, etc.
   - Patterns prevent AI mistakes

3. **Documentation Infrastructure**
   - Docs in `core/docs/content/`
   - App Agent reference in `internal/app-agent/`
   - MCP server gives AI full documentation access
   - Add your own docs alongside

4. **Demo Applications**
   - Dashboard - admin panels, internal tools
   - SaaS - customer-facing app patterns
   - Landing - marketing sites

### What Customers Own

**100% of everything.** No asterisks.

- Their GitHub/GitLab repo
- Their cloud account
- Their domain
- Their CI/CD
- Their data
- Their users

They can stop using the service whenever they want. They keep everything. Zero lock-in.

---

## What's Built (As of Feb 2026)

### Core Infrastructure ✅

- **Nuxt 4 Monorepo** - Turborepo + Bun + TypeScript
- **Layering Architecture** - `/core` extends into `/apps/*` and `/demos/*`
- **Smart Dev Launcher** - Interactive first-run setup (`core/cli/dev.js`)
- **Documentation Infrastructure** - Multi-source content with MCP server

### Project Structure ✅

```
app-agent/
├── core/                  # Shared Nuxt layer (upstream maintained)
│   ├── app/               # Shared components, composables
│   ├── cli/               # Dev tooling (smart launcher)
│   └── docs/              # Documentation with MCP
│       └── content/       # All docs live here
├── demos/                 # Reference implementations
│   ├── dashboard/         # Internal tools pattern (port 3010)
│   ├── saas/              # Customer app pattern (port 3011)
│   └── landing/           # Marketing site pattern (port 3012)
├── apps/                  # Customer applications (empty initially)
├── packages/              # Optional shared packages
└── documentation/         # Architecture Decision Records
```

### Developer Experience ✅

- `bun run dev` - Smart launcher with interactive setup
- `bun run dev:demos` - Run all demo apps
- `bun run dev:docs` - Run documentation server
- First-time users guided to copy a demo as starting point
- Clean separation: demos are references, apps are yours

### AI-Native Documentation ✅

- MCP server at `/mcp` endpoint (6 tools)
- Built-in tools: `list-pages`, `get-page`
- Custom tools: `list-apps`, `get-app-structure`, `list-components`, `get-file`
- All docs in `core/docs/content/`
- App Agent reference in `internal/app-agent/`
- Works with Claude Code, Cursor, Windsurf, etc.

### Demo Applications ✅

Based on Nuxt UI templates (all free/MIT):
- **Dashboard** - Admin panels, internal tools, data tables, charts
- **SaaS** - Customer-facing app with content management
- **Landing** - Marketing site with documentation

---

## What's Needed 📋

### Core Features (Priority)

- [ ] Auth layer (login, registration, sessions, OAuth)
- [ ] Billing layer (Stripe integration, subscriptions)
- [ ] Admin layer (user management, settings)
- [ ] Multi-tenancy layer (org/team structure)
- [ ] Compliance layer (audit logs, SOC2 controls)
- [ ] Feature flag system (toggle features, hot-reload)

### AI Agent Integration

- [ ] Agent tab in navigation
- [ ] Feature building via natural language
- [ ] Code generation with convention enforcement
- [ ] Auto-linting, unit tests, integration tests
- [ ] Safe deployment pipeline

### Control Plane

- [ ] Live introspection dashboard
- [ ] Connected users view
- [ ] Feature usage analytics
- [ ] Hot-deploy capabilities

### Business Operations

- [ ] Onboarding flow / customer docs
- [ ] Repo handoff process (automated fork)
- [ ] Legal contracts / license model
- [ ] Landing page (use the landing demo!)
- [ ] Sales pipeline

---

## Technical Architecture

### Nuxt 4 Layering System

```
CORE REPO (maintained upstream)
├── Shared components and composables
├── Documentation infrastructure
├── AI integration (MCP)
└── Dev tooling
         │
    fork + pull upstream
         │
         ▼
CUSTOMER REPO (customer's GitHub)
├── Their apps in /apps/
├── Their docs in /core/docs/content/
├── Their CI/CD pipeline
└── Their cloud infrastructure
```

**Key Benefits:**
- Pull upstream updates WITHOUT merge conflicts
- Customer customizations stay isolated
- Documentation infrastructure just works
- Same codebase deploys to any infrastructure

### Why the AI Agent Works When Others Fail

**The Problem with Bolt/Lovable/V0:**
- AI generates code with no conventions
- Context window fills up (15-20+ components)
- AI starts contradicting itself
- Customers spend $1,000+ debugging AI spaghetti

**Why App Agent's AI Doesn't Break:**
- Patterns so clear even basic models can follow them
- Conventions enforced by the system itself
- MCP server gives AI full codebase understanding
- The codebase prevents mistakes

The AI isn't smarter. The codebase is smarter.

---

## Customer Spectrum

### Non-Technical Founder
- **Experience:** Describe your product. It gets built.
- **Interaction:** Talks to AI agent, never sees code
- **Value:** Complete execution without hiring

### Technical Founder
- **Experience:** Skip 6 months of setup. Ship features day one.
- **Interaction:** Uses AI as senior pair programmer
- **Value:** Speed + best practices encoded

### Startup with Team
- **Experience:** Foundation + guardrails. Their devs work in the repo.
- **Interaction:** AI assists their team
- **Value:** Professional architecture from day one

### Enterprise
- **Experience:** SOC2, on-prem, air-gapped. Compliance team loves it.
- **Interaction:** Custom SLAs, dedicated support
- **Value:** Enterprise-grade without enterprise timeline

---

## Services

### Staff Augmentation

Available services for customers who need additional support:

- **Setup assistance** - Help with initial deployment and configuration
- **Architecture guidance** - Design reviews and best practices
- **Feature development** - Build features using the AI-native workflow
- **Training** - Onboard your team to the platform

Contact for pricing and availability.

---

## Key Differentiators

### Technical Moat

Anyone can copy "Nuxt 4 monorepo with auth and billing."

Nobody can copy:
- Patterns encoded into self-enforcing conventions
- Documentation infrastructure that serves both internal and customer docs
- An AI integration where the codebase itself prevents mistakes
- MCP server that gives AI complete codebase understanding

The code is open. The judgment is earned.

### Zero Lock-In as Feature

- Most vendors create lock-in for retention
- App Agent creates anti-lock-in for trust
- Customers stay because of value, not switching costs

---

## Taglines & Copy

### Primary Tagline
**"Describing your product makes it exist."**

### Supporting Lines
- "The AI isn't smarter. The codebase is smarter."
- "Fork it, customize it, own it forever."
- "Stop building infrastructure. Start building product."

### For Skeptics
- "Own 100% of everything. Zero lock-in."
- "Your repo, your cloud, your data."

---

## ADRs (Architecture Decision Records)

Key decisions documented in `/documentation/ADR/`:

1. **ADR-001:** Nuxt 4 Application Setup with Bun
2. **ADR-002:** Monorepo Architecture with Nuxt Layers
3. **ADR-003:** Developer Experience and Documentation (demos, MCP, smart launcher)

---

*Last updated: February 2026*
*Context file for Claude AI project collaboration*
