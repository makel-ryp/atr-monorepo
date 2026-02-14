---
slug: authentication
title: Authentication
status: active
created: 2026-02-12
---

## description

Core authentication system using `nuxt-auth-utils` with 3-role RBAC (public/registered/admin), config-driven OAuth providers, and an owned user store (`app_agent_users`) that avoids collision with client backend user tables.

## overview

Authentication lives in `core/` as shared infrastructure but is **opt-in at the app level**. Core provides the `nuxt-auth-utils` package as a dependency (for types + server utils), but each app must add it to their own `modules` array to activate session infrastructure. This avoids forcing session cookies on docs and static apps.

### Key files

| File | Purpose |
|------|---------|
| `core/shared/types/auth.d.ts` | Type augmentation — adds `role` to `#auth-utils` User |
| `core/server/utils/auth.ts` | `handleOAuthSuccess`, `requireAuth`, `requireRole`, `getAuthUser` |
| `core/server/utils/auth-schema.ts` | Drizzle schema for `app_agent_users` table |
| `core/server/middleware/03.auth.ts` | Populates `event.context.auth` on every request |
| `core/app/composables/useAuth.ts` | Client composable wrapping `useUserSession()` with role helpers |
| `core/app/components/CoreUserMenu.vue` | Shared user menu (login buttons + avatar dropdown) |
| `core/app/layouts/auth.vue` | Centered card layout for login/signup pages |

### 3-role model

- **public** — unauthenticated visitor (default)
- **registered** — logged-in user
- **admin** — elevated access

Roles are stored as a text field on the user record. No join tables, no permissions matrix.

## faq

**Q: Why isn't nuxt-auth-utils in core's modules array?**
A: Core server routes are inherited by ALL apps via layer cascade. If core had auth routes or session middleware active by default, docs and static apps would need `NUXT_SESSION_PASSWORD` configured. By keeping it as a dependency only, apps opt in explicitly.

**Q: Why `app_agent_users` instead of `users`?**
A: Clients may use Supabase, Strapi, or Directus which all have their own `users` tables. The `app_agent_` prefix prevents naming collisions.

**Q: How does the middleware work for apps without auth?**
A: The `03.auth.ts` middleware checks `useRuntimeConfig().session?.password` first. If no session password is configured (meaning `nuxt-auth-utils` module is not loaded), it sets `event.context.auth` to the public defaults and returns immediately — zero overhead.

**Q: Can I add more OAuth providers?**
A: Yes. Add a new handler in your app's `server/routes/auth/[provider].get.ts` handlers object. `nuxt-auth-utils` supports 40+ providers including a generic OIDC handler.

**Q: Session-only vs database-backed?**
A: `handleOAuthSuccess` supports both modes. Pass a `DbAdapter` object for database-backed (lookup-or-create), or omit it for cookie-only sessions. Landing demo uses session-only; dashboard and chat demos use database-backed.

## reasoning

- **nuxt-auth-utils chosen over Better Auth / Auth.js**: It's by the Nuxt creator, minimal, cookie-based (no DB opinion), and already used in the chat demo. Better Auth would be a framework-level dependency we don't control.
- **Role as text field, not RBAC tables**: 3 roles is trivial. No join tables, no permissions matrix, no `nuxt-authorization` module needed.
- **Dynamic `[provider].get.ts` per app**: Core can't define auth routes because they'd leak to all apps. Each app defines which providers it supports.
- **`event.context.auth` via numbered middleware**: Matches existing patterns (requestId `00`, rateLimit `01`, logging `02`). Every handler gets auth state for free.

## details

### Server utilities (auto-imported)

```typescript
// Require authentication — throws 401
const user = await requireAuth(event)

// Require admin role — throws 401/403
const admin = await requireRole(event, 'admin')

// Get user or null (non-throwing)
const user = await getAuthUser(event)

// Handle OAuth callback with DB adapter
await handleOAuthSuccess(event, 'github', ghUser.id, userData, dbAdapter)

// Handle OAuth callback without DB (session-only)
await handleOAuthSuccess(event, 'github', ghUser.id, userData)
```

### Client composable

```typescript
const { loggedIn, user, role, isAdmin, isRegistered, login, logout } = useAuth()

// Login via OAuth popup
login('github')

// Logout + redirect to /
await logout()
```

### OAuth route pattern

Each app defines a `server/routes/auth/[provider].get.ts` with a handlers map:

```typescript
const handlers = {
  github: defineOAuthGitHubEventHandler({ ... }),
  google: defineOAuthGoogleEventHandler({ ... })
}

export default defineEventHandler((event) => {
  const provider = getRouterParam(event, 'provider')
  if (!handlers[provider]) throw createError({ statusCode: 404 })
  return handlers[provider](event)
})
```

### Env vars

- `NUXT_SESSION_PASSWORD` — session encryption key (min 32 chars, auto-generated in dev)
- `NUXT_OAUTH_GITHUB_CLIENT_ID` / `NUXT_OAUTH_GITHUB_CLIENT_SECRET` — per-provider OAuth credentials
