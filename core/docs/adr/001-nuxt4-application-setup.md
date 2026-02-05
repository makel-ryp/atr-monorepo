# ADR-001: Nuxt 4 Application Setup with Bun

## Status
Accepted

## Date
2026-02-02

## Context
We need to create a new web application for app-agent.io. The application requires a modern, performant frontend framework with server-side rendering capabilities, excellent developer experience, and TypeScript support.

## Decision Drivers
- Need for SSR/SSG capabilities for SEO and performance
- TypeScript-first development approach
- Fast development iteration cycles
- Modern tooling and ecosystem support
- Long-term maintainability

## Considered Options

### Option 1: Nuxt 4 with Bun (Selected)
**Pros:**
- Nuxt 4 released July 2025 with stability focus
- New `app/` directory structure provides cleaner project organization
- Improved TypeScript support with separate virtual TS projects for app/server/shared contexts
- Hybrid rendering support (SSR, SSG, SPA per route)
- Auto-imports reduce boilerplate
- Bun provides faster package installation and runtime performance
- Active maintenance until at least July 2027

**Cons:**
- Bun ecosystem still maturing
- Some edge cases may require Node.js fallback

### Option 2: Next.js 15 with npm
**Pros:**
- Large ecosystem and community
- Vercel backing and deployment optimization

**Cons:**
- More complex mental model (App Router vs Pages Router)
- Heavier bundle sizes by default

### Option 3: Nuxt 3 with npm
**Pros:**
- Battle-tested stability

**Cons:**
- End-of-life July 2026
- Missing Nuxt 4 improvements

## Decision
Use **Nuxt 4 with Bun** as the package manager and runtime.

## Technical Details

### Directory Structure
```
├── app/                    # Application code (Nuxt 4 convention)
│   ├── app.vue            # Root component
│   ├── components/        # Auto-imported components
│   ├── composables/       # Auto-imported composables
│   ├── layouts/           # Layout components
│   ├── middleware/        # Route middleware
│   ├── pages/             # File-based routing
│   └── plugins/           # Nuxt plugins
├── server/                # Server-side code
│   ├── api/               # API routes
│   └── middleware/        # Server middleware
├── shared/                # Shared utilities (typed separately)
├── public/                # Static assets
├── documentation/         # Project documentation
│   └── ADR/              # Architecture Decision Records
├── nuxt.config.ts         # Nuxt configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

### Bun Integration
- Use `bunx nuxi@latest init` for scaffolding
- Use `--bun` flag for all commands to ensure Bun runtime
- Scripts: `bun --bun run dev`, `bun --bun run build`, `bun --bun run preview`

### Best Practices Applied
1. **Rendering Strategy**: Default SSR with route-level configuration for hybrid rendering
2. **TypeScript**: Strict mode enabled, leveraging Nuxt 4's improved type separation
3. **Performance**:
   - Lazy loading for non-critical components
   - Image optimization with @nuxt/image (when needed)
   - Route rules for caching
4. **Code Organization**: Follow Nuxt 4 conventions for auto-imports
5. **Development**: Use Nuxt DevTools for debugging

## Consequences

### Positive
- Fast development cycles with Bun's speed
- Clean separation of concerns with new directory structure
- Type-safe development across all contexts
- Future-proof choice with Nuxt 5 on horizon

### Negative
- Team needs familiarity with Nuxt 4 changes from Nuxt 3
- Must remember to use `--bun` flag for consistent runtime

### Neutral
- Migration path to Nuxt 5 will be available when released

## References
- [Nuxt 4 Announcement](https://nuxt.com/blog/v4)
- [Nuxt 4 Performance Best Practices](https://nuxt.com/docs/4.x/guide/best-practices/performance)
- [Build an app with Nuxt and Bun](https://bun.com/docs/guides/ecosystem/nuxt)
- [Nuxt 4 Roadmap](https://nuxt.com/docs/4.x/community/roadmap)
