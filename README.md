# App Agent

A turnkey Nuxt 4 monorepo template designed for companies to fork and customize.

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
├── core/                  # Shared Nuxt layer (components, composables)
│   ├── cli/               # Dev tooling
│   └── docs/              # Living documentation (port 3000)
├── demos/                 # Reference implementations
│   ├── dashboard/         # Internal tools pattern (port 3010)
│   ├── saas/              # Customer app pattern (port 3011)
│   └── landing/           # Marketing site pattern (port 3012)
├── apps/                  # Your applications (empty initially)
├── packages/              # Optional shared packages
└── documentation/         # Architecture Decision Records
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Smart launcher - guides first-time setup or runs your apps |
| `bun run dev:demos` | Run all demo applications |
| `bun run dev:docs` | Run documentation server only |
| `bun run dev:all` | Run everything (docs + demos + apps) |
| `bun run build` | Build your apps (in /apps/) |
| `bun run typecheck` | Run TypeScript type checking |

## Demos

| Demo | Port | Description |
|------|------|-------------|
| Dashboard | 3010 | Internal tools, admin panels, analytics |
| SaaS | 3011 | Customer-facing application patterns |
| Landing | 3012 | Marketing sites, documentation |

## Documentation

The docs server runs at `http://localhost:3000` and includes:

- Getting started guides
- Demo documentation
- AI/MCP integration

### MCP Server

The docs include an MCP server for AI assistants at `/mcp`:

```bash
claude mcp add --transport http app-agent-docs http://localhost:3000/mcp
```

This enables AI tools to query documentation and introspect the codebase.

## Creating Your First App

1. Run `bun run dev` (you'll be prompted to copy a demo)
2. Or manually: `cp -r demos/dashboard apps/my-app`
3. Update `apps/my-app/package.json` with your app name
4. Run `bun install && bun run dev`

Your app automatically extends the `/core` layer.

## Technology Stack

- **Nuxt 4** - Vue framework with SSR/SSG
- **Nuxt UI v4** - 125+ components (MIT licensed)
- **Turborepo** - Fast monorepo builds
- **Bun** - Package manager and runtime
- **TypeScript** - Strict mode throughout

## License

MIT
