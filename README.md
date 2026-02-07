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

### First-Run Experience

If `/apps/` is empty, the smart launcher guides you through setup:

1. **Choose an option:**
   - Copy a demo to start your first app
   - Run demos to explore first
   - Exit

2. **If copying a demo:**
   - Select which demo to copy (dashboard, saas, or landing)
   - Enter a name for your app
   - The demo is copied to `/apps/<your-name>/`
   - Package.json is updated with your app name
   - Development server starts automatically

## Project Structure

```
app-agent/
├── core/                  # Shared Nuxt layer (upstream maintained)
│   ├── app/               # Shared components, composables, layouts
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

## The Layering System

App Agent uses a three-layer inheritance model:

```
CORE (maintained upstream - don't modify)
├── Shared components and composables
├── Documentation infrastructure
└── AI integration (MCP)
         │
         ▼
ORGANIZATION (your company branding)
├── Brand name, logo, colors
├── Social links
└── Company-wide defaults
         │
         ▼
YOUR APPS (your code)
├── /apps/* - Your applications
├── /docs/ - Your documentation
└── /demos/* - Reference implementations
```

### Customizing Your Brand

Edit `/organization/app/app.config.ts` to set:
- Company name and logo
- Brand colors
- Social media links
- Default UI settings

All apps automatically inherit these settings.

## Port Allocation

| App | Port | Description |
|-----|------|-------------|
| Docs | 3000 | Documentation site with MCP server |
| Your Apps | 3001+ | Customer applications in /apps/ |
| Dashboard Demo | 3010 | Internal tools, admin panels, analytics |
| SaaS Demo | 3011 | Customer-facing application patterns |
| Landing Demo | 3012 | Marketing sites, landing pages |
| Chat Demo | 3013 | AI chatbot with persistent history |

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Smart launcher - guides first-time setup or runs your apps |
| `bun run dev:demos` | Run all demo applications |
| `bun run dev:docs` | Run documentation server only |
| `bun run dev:all` | Run everything |
| `bun run build` | Build your apps for production |
| `bun run typecheck` | Run TypeScript type checking |

## AI-Native Development

### MCP Server

The docs include an MCP server that enables AI assistants to understand and work with your codebase.

```bash
# Add to Claude Code
claude mcp add --transport http app-agent-docs http://localhost:3000/mcp
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list-apps` | Shows all apps and demos with metadata |
| `list-components` | Lists components, pages, composables in any app |
| `get-file` | Returns source code of any file |
| `get-page` | Retrieves documentation content |
| `list-pages` | Lists all routes in an app |

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

## Shared Utilities

### useApi Composable

All apps have access to a shared HTTP client:

```typescript
const { get, post, put, delete: del } = useApi()

// Usage
const users = await get<User[]>('/users')
const created = await post<User>('/users', { name: 'John' })
```

Configure the API base URL via `NUXT_PUBLIC_API_BASE` environment variable.

## Documentation System

### Adding Your Docs

Place your documentation in `/docs/content/`:

```
docs/content/
├── internal/              # Merges into /internal/ section
│   └── 2.my-team/         # Your internal docs
└── 2.company/             # New top-level section
    └── 1.handbook.md
```

### Navigation

- Numbered prefixes control order (e.g., `1.getting-started/`, `2.guides/`)
- Use `index.md` or `0.index.md` for section landing pages
- Your docs appear alongside App Agent reference docs

### Content Collections

| Collection | Purpose |
|------------|---------|
| `docs` | App Agent reference docs (from /core/docs) |
| `customerInternal` | Your internal docs (merges into /internal/) |
| `customerDocs` | Your top-level doc sections |

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
- **ADRs:** See `/core/docs/adr/` for architecture decisions

## License

MIT - Own it, modify it, ship it.
