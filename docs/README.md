# Documentation App

This is your documentation app. It extends the `@app-agent/docs-layer` from `/core/docs/` and runs on `localhost:3000` during development.

## Structure

```
/docs/
├── nuxt.config.ts      # App config - extends ../core/docs
├── package.json        # App package - depends on @app-agent/docs-layer
├── content.config.ts   # Content sources configuration
│
├── app/
│   └── app.config.ts   # YOUR BRANDING - logos, social links, credits
│
├── public/
│   └── logo.png        # YOUR LOGO - place your logo files here
│
└── content/            # YOUR DOCUMENTATION
    ├── internal/       # Merges into /internal/ section
    │   └── 2.team/     # Alongside App Agent docs
    └── 2.company/      # Top-level section at /company/
```

## Customization

### Branding

Edit `app/app.config.ts` to customize:

```ts
export default defineAppConfig({
  seo: {
    siteName: 'My Company Docs'
  },
  header: {
    logo: {
      light: '/logo.png',
      dark: '/logo-dark.png'
    }
  },
  footer: {
    credits: 'Built by My Company',
    links: [
      { icon: 'i-simple-icons-github', to: 'https://github.com/mycompany' }
    ]
  }
})
```

### Logo

Place your logo in `public/`:
- `public/logo.png` - Main logo
- `public/logo-dark.png` - Dark mode variant (optional)

### Documentation

Add markdown files to `content/`:

| Location | URL |
|----------|-----|
| `content/internal/2.team/guide.md` | `/internal/team/guide` |
| `content/2.company/handbook.md` | `/company/handbook` |

## Layer Benefits

- **No merge conflicts**: Your customizations in `/docs/` never conflict with upstream updates
- **Auto-updates**: Pull upstream changes to `/core/docs/` and get new features/fixes
- **Full override**: Any file you add here takes precedence over the layer
