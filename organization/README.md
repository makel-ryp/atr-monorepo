# Organization Layer

This is **your company's** configuration layer. It sits between the upstream App Agent core and all your apps.

## Hierarchy

```
/core                 # Upstream (App Agent) - don't edit
    ↓
/organization         # YOUR company defaults - edit this!
    ↓
/docs, /apps/*, etc.  # Individual apps - inherit from organization
```

## What to Customize

### 1. Branding (`app/app.config.ts`)

```ts
export default defineAppConfig({
  brand: {
    name: 'Acme Corp',
    logo: { light: '/acme-logo.png', dark: '/acme-logo-dark.png' }
  },
  ui: {
    colors: { primary: 'indigo' }
  },
  social: {
    github: 'https://github.com/acme'
  }
})
```

### 2. Logo (`public/`)

Place your logo files here:
- `public/logo.png` - Main logo
- `public/logo-dark.png` - Dark mode variant (optional)
- `public/favicon.ico` - Favicon

### 3. Shared Styles (`assets/css/`)

Add company-wide CSS:
```css
/* assets/css/brand.css */
:root {
  --brand-font: 'Inter', sans-serif;
}
```

## How It Works

All apps extend this layer, so changes here propagate everywhere:
- `/docs` → extends `/core/docs` → extends `/organization` → extends `/core`
- `/demos/*` → extends `/organization` → extends `/core`
- `/apps/*` → extends `/organization` → extends `/core`

## No Merge Conflicts

This folder is yours. Upstream updates to `/core` won't conflict with your customizations here.
