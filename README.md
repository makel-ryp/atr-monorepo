# App Agent

**Describing your product makes it exist.**

App Agent is a turnkey monorepo with an embedded AI development agent. Fork it, customize it, own it forever.

## What You Get

1. **Complete Platform Codebase** - Nuxt 4 monorepo with shared components, composables, and configuration
2. **Embedded AI Development Agent** - Understands the architecture via MCP, builds features on request
3. **Demo Applications** - Three reference implementations to copy and customize
4. **Full Ownership** - Your repo, your cloud, your data, your users. Zero lock-in.

## Quick Start

```bash
# Install dependencies
bun install

# Start development
bun run dev
```

If `/apps/` is empty, you'll be guided to copy a demo as your starting point.

## Project Structure

```
app-agent/
├── core/                  # Shared Nuxt layer (upstream maintained)
│   ├── app/               # Shared components, composables
│   ├── cli/               # Dev tooling
│   └── docs/              # Documentation with MCP server
│       └── content/       # Add your docs here
├── demos/                 # Reference implementations
│   ├── dashboard/         # Internal tools, admin panels (port 3010)
│   ├── saas/              # Customer-facing app patterns (port 3011)
│   └── landing/           # Marketing sites (port 3012)
├── apps/                  # Your applications
├── packages/              # Optional shared packages
└── documentation/         # Architecture Decision Records
```

## How It Works

### For Customers

1. **Fork this repo** - It becomes yours
2. **Run `bun run dev`** - Interactive setup guides you
3. **Copy a demo** - Start with a working pattern
4. **Build your product** - AI agent helps you build
5. **Pull upstream updates** - Get improvements without merge conflicts

### The Layering System

```
CORE (maintained upstream)
├── Shared components and composables
├── Documentation infrastructure
└── AI integration (MCP)
         │
    fork + pull upstream
         │
         ▼
YOUR REPO (your GitHub)
├── Your apps in /apps/
├── Your docs in /core/docs/content/
└── Your customizations
```

Your code stays isolated. Pull upstream updates cleanly.

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Smart launcher - guides first-time setup or runs your apps |
| `bun run dev:demos` | Run all demo applications |
| `bun run dev:docs` | Run documentation server only |
| `bun run dev:all` | Run everything |
| `bun run build` | Build your apps for production |
| `bun run typecheck` | Run TypeScript type checking |

## Demos

| Demo | Port | Description |
|------|------|-------------|
| Dashboard | 3010 | Internal tools, admin panels, analytics |
| SaaS | 3011 | Customer-facing application patterns |
| Landing | 3012 | Marketing sites, documentation |

## AI-Native Development

### MCP Server

The docs include an MCP server that enables AI assistants to:
- Query documentation
- Introspect the codebase structure
- Read source files
- Understand your apps and demos

```bash
# Add to Claude Code
claude mcp add --transport http app-agent-docs http://localhost:3000/mcp
```

### Why the AI Works

Traditional AI code generators fail because:
- No understanding of project conventions
- Context window fills up, AI contradicts itself

App Agent's AI succeeds because:
- Patterns so clear even basic models can follow them
- Conventions enforced by the system itself
- MCP gives AI complete codebase understanding
- Demos provide working examples to copy

**The AI isn't smarter. The codebase is smarter.**

## Technology Stack

- **Nuxt 4** - Latest Vue framework with `app/` directory structure
- **Nuxt UI v4** - 125+ components, fully open source (MIT)
- **Turborepo** - Fast, cached monorepo builds
- **Bun** - Package manager and runtime
- **TypeScript** - Strict mode throughout
- **MCP** - AI assistant integration protocol

## Services

Staff augmentation and expert guidance available. See documentation for details.

## Learn More

- **Documentation:** Run `bun run dev` → http://localhost:3000
- **ADRs:** See `/documentation/ADR/` for architecture decisions

## License

MIT - Own it, modify it, ship it.
