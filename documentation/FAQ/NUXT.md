# Nuxt 4 FAQ & Integration Guide

A comprehensive guide for Nuxt newcomers covering common questions, integrations, and deployment.

## Table of Contents
- [Health Checks & API Routes](#health-checks--api-routes)
- [Supabase Integration](#supabase-integration)
- [Deployment Options](#deployment-options)
- [GitHub Actions Security](#github-actions-security)
- [Nuxt UI Templates](#nuxt-ui-templates)
- [Common Nuxt Patterns](#common-nuxt-patterns)

---

## Health Checks & API Routes

### How Health Checks Work

Your app already has a health check endpoint at `server/api/health.get.ts`:

```typescript
// server/api/health.get.ts
export default defineEventHandler(() => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }
})
```

**Access it at:** `http://localhost:3000/api/health`

### API Route Naming Conventions

| File Name | HTTP Method | URL |
|-----------|-------------|-----|
| `health.get.ts` | GET | `/api/health` |
| `health.post.ts` | POST | `/api/health` |
| `users/[id].get.ts` | GET | `/api/users/:id` |
| `users/index.get.ts` | GET | `/api/users` |
| `users/index.post.ts` | POST | `/api/users` |

### Creating More API Routes

```typescript
// server/api/users/[id].get.ts
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return { userId: id }
})

// server/api/users/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return { created: body }
})
```

### Calling APIs from Pages

```vue
<script setup lang="ts">
// Auto-fetches on page load with SSR support
const { data, pending, error, refresh } = await useFetch('/api/health')

// Or use $fetch for manual calls
async function checkHealth() {
  const result = await $fetch('/api/health')
}
</script>
```

---

## Supabase Integration

### Installation

```bash
bun add @nuxtjs/supabase
```

### Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: undefined,
      exclude: ['/'], // Public pages
      cookieRedirect: false,
    }
  }
})
```

### Environment Variables

Create `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Using Supabase in Pages

```vue
<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Fetch data
const { data: posts } = await supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })

// Auth
async function signIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github'
  })
}

async function signOut() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>
```

### Using Supabase in Server Routes

```typescript
// server/api/posts.get.ts
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('posts')
    .select('*')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
```

### Protected Routes with Middleware

```typescript
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/login')
  }
})
```

```vue
<!-- app/pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})
</script>
```

**Resources:**
- [Nuxt Supabase Module](https://supabase.nuxtjs.org/)
- [Supabase Nuxt Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs)

---

## Deployment Options

### Cloudflare Pages (Recommended for Edge)

**Option 1: Git Integration (Easiest)**
1. Push your repo to GitHub/GitLab
2. Go to Cloudflare Dashboard → Pages → Create Project
3. Connect your repository
4. Nuxt auto-detects Cloudflare and sets the correct preset

**Option 2: CLI Deployment**

```bash
# Install wrangler
bun add -d wrangler

# Update nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare_pages'
  }
})

# Build and deploy
bun run build
bunx wrangler pages deploy dist/
```

### Cloudflare Workers

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare'
  }
})
```

### NuxtHub (One-Command Deploy)

```bash
# Deploy to Cloudflare with one command
bunx nuxthub deploy
```

NuxtHub provides:
- Zero-config deployment
- KV, D1, R2 storage bindings
- Remote development
- Analytics dashboard

### Google Cloud Platform (Cloud Run)

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudrun'
  }
})
```

**Dockerfile:**

```dockerfile
FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/.output .output
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
CMD ["bun", ".output/server/index.mjs"]
```

**Deploy:**

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/app-agent

# Deploy to Cloud Run
gcloud run deploy app-agent \
  --image gcr.io/PROJECT_ID/app-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Vercel

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'vercel'
  }
})
```

Then connect your GitHub repo in Vercel dashboard.

### Available Nitro Presets

| Preset | Platform |
|--------|----------|
| `cloudflare_pages` | Cloudflare Pages |
| `cloudflare` | Cloudflare Workers |
| `vercel` | Vercel |
| `netlify` | Netlify |
| `cloudrun` | Google Cloud Run |
| `aws_lambda` | AWS Lambda |
| `azure` | Azure Functions |
| `bun` | Bun server (self-hosted) |
| `node` | Node.js server (self-hosted) |

**Resources:**
- [Nuxt Cloudflare Deployment](https://nuxt.com/deploy/cloudflare)
- [Cloudflare Pages Nuxt Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nuxt-site/)
- [NuxtHub](https://hub.nuxt.com/)

---

## GitHub Actions Security

### The Problem with Forks

When someone forks your public repo and creates a PR:
- **Secrets are NOT exposed** by default (security feature)
- Workflows triggered by `pull_request` cannot access secrets
- This prevents malicious code from stealing your credentials

### Recommended Setup: Environment Protection

**Step 1: Create a Protected Environment**

1. Go to Repository Settings → Environments
2. Create environment named `production`
3. Enable "Required reviewers"
4. Add yourself as required reviewer
5. Add your secrets to this environment (not repo-level)

**Step 2: Workflow Configuration**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval for forks
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install
      - run: bun run build

      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: bunx wrangler pages deploy dist/
```

**Step 3: Separate CI from CD**

```yaml
# .github/workflows/ci.yml - Safe for forks (no secrets needed)
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      # No deployment, no secrets needed
```

```yaml
# .github/workflows/deploy.yml - Only on main branch
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      # ... deployment with secrets
```

### Security Best Practices

| Do | Don't |
|----|-------|
| Use environment-level secrets | Use repo-level secrets for sensitive data |
| Require reviewers for production | Auto-deploy from forks |
| Pin actions to commit SHA | Use `@latest` or `@v1` tags |
| Use `pull_request` for CI | Use `pull_request_target` without review |
| Separate CI (no secrets) from CD | Mix testing and deployment in one workflow |

### Pin Actions for Security

```yaml
# Good - pinned to specific commit
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# Risky - tag can be moved
- uses: actions/checkout@v4
```

**Resources:**
- [GitHub Actions Security Best Practices](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
- [Environment Protection Rules](https://dev.to/petrsvihlik/using-environment-protection-rules-to-secure-secrets-when-building-external-forks-with-pullrequesttarget-hci)

---

## Nuxt UI Templates

### Available Templates

| Template | Description | Install Command |
|----------|-------------|-----------------|
| **Starter** | Minimal Nuxt UI setup | `bun create nuxt -- -t github:nuxt-ui-templates/starter` |
| **Dashboard** | Admin dashboard with multi-column layout | `bun create nuxt -- -t github:nuxt-ui-templates/dashboard` |
| **SaaS** | Complete SaaS template with landing, pricing, blog | `bun create nuxt -- -t github:nuxt-ui-templates/saas` |
| **Landing** | Modern landing page with Nuxt Content | `bun create nuxt -- -t github:nuxt-ui-templates/landing` |
| **Docs** | Documentation site template | `bun create nuxt -- -t github:nuxt-ui-templates/docs` |
| **Portfolio** | Portfolio with blog | `bun create nuxt -- -t github:nuxt-ui-templates/portfolio` |
| **Chat** | AI chatbot with Vercel AI SDK | `bun create nuxt -- -t github:nuxt-ui-templates/chat` |

### Installing Nuxt UI in Existing Project

```bash
# Install Nuxt UI
bun add @nuxt/ui

# Update nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui']
})
```

### Basic Nuxt UI Usage

```vue
<template>
  <div class="p-4">
    <UButton>Click me</UButton>

    <UCard>
      <template #header>Card Title</template>
      <p>Card content</p>
    </UCard>

    <UForm :state="state" @submit="onSubmit">
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" />
      </UFormField>
      <UButton type="submit">Submit</UButton>
    </UForm>
  </div>
</template>

<script setup lang="ts">
const state = reactive({
  email: ''
})

function onSubmit() {
  console.log(state)
}
</script>
```

**Resources:**
- [Nuxt UI Documentation](https://ui.nuxt.com/)
- [Nuxt UI Templates](https://ui.nuxt.com/templates)
- [Nuxt Templates Gallery](https://nuxt.com/templates)

---

## Common Nuxt Patterns

### Page Metadata

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'admin',      // Use specific layout
  middleware: 'auth',   // Apply middleware
  title: 'Dashboard'    // Page title
})

// SEO metadata
useSeoMeta({
  title: 'My Page',
  description: 'Page description',
  ogImage: '/og-image.png'
})
</script>
```

### Layouts

```vue
<!-- app/layouts/admin.vue -->
<template>
  <div class="admin-layout">
    <aside>Sidebar</aside>
    <main>
      <slot />
    </main>
  </div>
</template>
```

### Composables (Auto-imported)

```typescript
// app/composables/useCounter.ts
export function useCounter(initial = 0) {
  const count = ref(initial)
  const increment = () => count.value++
  const decrement = () => count.value--
  return { count, increment, decrement }
}
```

```vue
<!-- Usage - auto-imported! -->
<script setup>
const { count, increment } = useCounter(10)
</script>
```

### Data Fetching

```vue
<script setup lang="ts">
// SSR-friendly fetch with caching
const { data, pending, error, refresh } = await useFetch('/api/posts')

// With options
const { data: user } = await useFetch('/api/user', {
  key: 'current-user',           // Cache key
  server: true,                  // Fetch on server
  lazy: false,                   // Block navigation until loaded
  default: () => ({}),           // Default value
  transform: (data) => data.user // Transform response
})

// Async data (more control)
const { data } = await useAsyncData('posts', () => {
  return $fetch('/api/posts')
})
</script>
```

### State Management

```typescript
// app/composables/useStore.ts
export const useUserStore = () => {
  return useState('user', () => ({
    name: '',
    email: '',
    isLoggedIn: false
  }))
}
```

### Runtime Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: '',  // Server-only (from NUXT_API_SECRET env var)
    public: {
      apiBase: ''   // Client + Server (from NUXT_PUBLIC_API_BASE)
    }
  }
})
```

```vue
<script setup>
const config = useRuntimeConfig()
// config.public.apiBase is available
// config.apiSecret is NOT available on client
</script>
```

```typescript
// server/api/example.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  // config.apiSecret IS available on server
})
```

---

## Quick Reference

### Directory Structure

```
app/
├── app.vue          # Root component
├── pages/           # File-based routing
├── components/      # Auto-imported components
├── composables/     # Auto-imported composables
├── layouts/         # Page layouts
├── middleware/      # Route middleware
└── plugins/         # Vue plugins

server/
├── api/             # API routes
├── middleware/      # Server middleware
└── utils/           # Server utilities

shared/              # Shared between app and server
public/              # Static assets
```

### Common Commands

```bash
bun run dev          # Start dev server
bun run build        # Build for production
bun run preview      # Preview production build
bun run typecheck    # Check TypeScript
bun run lint         # Run ESLint
bun run generate     # Generate static site
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_*` | Exposed to client |
| `NUXT_*` | Server-only |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
