# Customer Documentation (Planned)

This folder is reserved for customer documentation that will be integrated with the docs infrastructure.

## Current Status

Multi-source content integration with the Nuxt UI Docs template is being investigated. For now, add your documentation to `core/docs/content/`.

## Future Vision

When implemented, this folder will allow:
- Your docs in `/docs/` separate from upstream
- No merge conflicts on upstream updates
- Same beautiful documentation infrastructure
- MCP server access to all your docs

## For Now

Add your documentation to:
```
core/docs/content/
├── 2.your-docs/           # Your documentation
│   ├── 1.index.md
│   └── ...
```

This works today and gives you full access to the documentation features.
