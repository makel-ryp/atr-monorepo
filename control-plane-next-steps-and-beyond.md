# Control Plane — Inspection Report & Next Steps

> Generated 2026-02-13 after full page-by-page Chrome DevTools inspection of `http://localhost:3001`
> Commit: `73dd42d` — "Add /control core app with health, features, logs, settings, and agent pages"

---

## Executive Summary

The control plane is functional across all 7 pages with real data flowing from `knowledge.db` and `logs.db`. The core architecture — shared DB utilities in `core/server/utils/`, layer bootstrap at `core/control/`, extension point at `/control/` — follows the proven docs pattern and works correctly. All 222 existing tests pass with zero regressions.

This is a strong v0.1. The bones are right. What follows is everything needed to take it from "works" to "ships."

---

## Bugs

### B1. Unresolved i18n keys (cosmetic, visible)

Three raw i18n keys render as literal text in the UI:

| Key | Location | Component |
|-----|----------|-----------|
| `chatPrompt.placeholder` | `/agent` page | `UChatPrompt` |
| `chatPromptSubmit.label` | `/agent` page | `UChatPromptSubmit` |
| `dashboardSearchButton.label` | Sidebar (all pages) | `UDashboardSearch` |

**Root cause:** These components use `$t()` internally, but the control layer doesn't define these keys in its i18n locale files. The docs layer has them because `@nuxt/ui` ships default English translations that get loaded through its i18n integration, but the control layer's i18n setup doesn't include them.

**Fix:** Add a `core/control/i18n/locales/en.json` with the missing keys, or configure `@nuxt/ui` to provide its default translations. Low effort, high visibility.

### B2. Icon warning for empty model prefix

```
[Icon] failed to load icon 'simple-icons:'
```

**Root cause:** When no AI provider is configured (no `AI_PROVIDER_*` env vars), the model list returns entries where the provider prefix is empty, producing `simple-icons:` (no icon name after the colon).

**Fix:** In `ModelSelect.vue`, guard against empty/undefined provider prefixes:
```typescript
const icon = model.provider ? `simple-icons:${model.provider}` : 'i-lucide-bot'
```

### B3. Search command palette shows but has no searchable content

`Cmd+K` / `Ctrl+K` opens the `UDashboardSearch` modal, but it has no groups or items configured. It's an empty search box.

**Fix:** Either remove the search trigger from the layout, or wire it up with navigation items (pages, features, settings keys) as searchable groups.

---

## Issues (Non-Bug, Needs Attention)

### I1. Timestamps lack millisecond precision

Log timestamps display as `2026-02-13 08:42:15` (seconds). For debugging concurrent operations or tracing request flows, millisecond precision would be valuable. The underlying `logs.db` stores ISO timestamps — the display just truncates.

### I2. Settings values display as flat strings

The settings page shows config values as raw strings. Nested objects appear as `{"nested":{"key":"value"}}` in a single table cell. A collapsible JSON tree viewer (or at minimum, formatted `<pre>` blocks) would make complex configs readable.

### I3. Port allocation URLs are plain text

The health page's port allocation table shows URLs like `http://localhost:3010` as text, not as clickable links. Should be `<a>` tags or `<NuxtLink>` for external navigation.

### I4. Knowledge section is status-only

Feature detail pages show a badge ("Documented" / "Missing") and a file path, but don't display the actual knowledge content. You can see *that* documentation exists but not *what* it says. The knowledge markdown files are right there — rendering them inline (via `@nuxtjs/mdc`) would make this page genuinely useful for onboarding.

### I5. Agent has no tools

The agent chat endpoint (`/api/control/agent/chat`) uses `streamText()` with no tools array. It can answer questions about the platform (via its system prompt) but cannot query the feature registry, read logs, check settings, or take any action. It's a conversational parrot of its system prompt, not an agent.

### I6. Agent is not multimodal

Unlike `demos/chat/`, the control plane agent doesn't support file uploads (images, documents). The `UChatPrompt` component supports this via slots, but no file handling is wired up.

### I7. No loading states for initial page renders

Pages use `await useFetch()` at the top level, which blocks SSR rendering until data arrives. If the DB is slow or the API errors, the page appears to hang. Consider skeleton loaders or `lazy: true` with client-side loading indicators.

### I8. Audit log renders as raw JSON

The settings page dumps the audit log as `JSON.stringify(audit, null, 2)` in a `<pre>` block. This works but is hard to scan. A proper table with columns (timestamp, user, action, key, old value, new value) would be far more useful.

---

## Persona Analysis

### Developer creating apps

**What works:** Health dashboard gives a quick system pulse. Feature registry shows what's registered and where files are mapped. Logs page is genuinely useful for debugging `feat.log()` output with filters.

**What's missing:**
- No way to see the layer cascade in action (which layer provides which config value)
- No HMR status indicator (are all apps connected? any stale modules?)
- No way to trigger a knowledge.db rebuild from the UI
- Can't see which `defineFeature*` wrappers are active vs. which slugs only have knowledge files
- No code navigation — file paths are listed but not linked to an editor (`vscode://file/...` links would be powerful)

### Administrator

**What works:** Settings page with edit capability. Stats overview. Audit log exists.

**What's missing:**
- No user management (placeholder page only)
- No role-based visibility (admin vs. developer views)
- No config diff view (what changed between environments?)
- No deployment status or build info
- No way to lock/unlock config paths from the UI (only visible, not editable)
- No notification system for config changes or error spikes

### i18n copywriter

**What works:** Nothing specifically. The control plane itself doesn't expose i18n management.

**What's needed:**
- A page showing all i18n keys across all layers with their translations
- Ability to see which keys are missing for which locales
- Inline editing of translation values (writing to the appropriate `i18n/locales/*.json`)
- Preview of how translated strings appear in context
- This could be a Phase 2 feature — "i18n Manager" page in the sidebar

### Feature implementer (building new features within the framework)

**What works:** Feature registry shows existing features as examples. Knowledge status tells you what's documented.

**What's missing:**
- No scaffolding — can't create a new feature from the UI (generate `defineFeatureHandler` boilerplate, knowledge stub, test file)
- No feature health dashboard (invocations/min, error rate, p95 latency per feature)
- No way to see the feature dependency graph visually (edges exist in DB but only shown as flat lists)
- The agent should be the primary interface here — "create a new feature called 'rate-limiting' with a handler and knowledge stub" should be a single agent interaction

### HMR developer (live development workflow)

**What works:** Pages auto-refresh on save (standard Nuxt HMR). The control plane itself benefits from HMR during its own development.

**What's missing:**
- No HMR status panel showing connected clients, module graph, rebuild times
- No way to see which layers are loaded and in what order
- No iframe embedding of other running apps (see Ideas section)
- No live reload of knowledge.db content (need manual page refresh)
- Consider WebSocket-based live log tailing instead of polling

---

## Ideas & Nice-to-Haves

### Iframe Integration

> "Could we iframe in the other page?"

Yes, and this could be powerful. Options:

1. **App Preview Panel** — An iframe that loads any running demo/app alongside the control plane. Split view: control plane on left, app preview on right. The port allocation data already knows all URLs.

2. **Feature-in-Context Viewer** — When viewing a feature detail page, iframe the docs page for that feature's knowledge (`http://localhost:3000/knowledge/{slug}`).

3. **Multi-App Dashboard** — Small iframe thumbnails of all running apps on the health page, like a security camera grid. Clicking expands to full view.

**Caveats:** Same-origin policy won't block these (all localhost), but X-Frame-Options headers from Nuxt might. Need to add `frameguard: false` for local dev.

### Feature Dependency Graph (D3/Vis)

The edges data is already in the DB. A visual node graph (`@unovis/ts` is already a dep via `nuxt-charts`) showing feature relationships would be the killer feature of this page. Nodes = features, edges = uses/contains relationships, color = has-knowledge status.

### Agent with MCP Tools

The biggest unlock. Wire the control plane agent to the docs MCP server's tools:
- `explain(slug, aspect)` — agent can read feature knowledge
- `record(slug, aspect, content)` — agent can write knowledge
- `census` / `introspect` — agent can query the feature registry
- `recent-logs` / `log-summary` — agent can analyze logs

This turns the agent from a chatbot into an actual developer assistant that understands the running system.

### Live Log Streaming

Replace polling with SSE (Server-Sent Events) for the logs page. `logs.db` writes are synchronous in dev mode — a Nitro SSE endpoint could use SQLite's `update_hook` or simple interval + last-seen-id to push new entries in real-time.

### Config Diff View

Side-by-side comparison of effective config across environments (`development` vs `production`) or across apps. The settings API already supports `appId` and `environment` params — just need a UI that calls it twice and diffs.

### Breadcrumb Navigation

Feature detail pages should show `Features > authentication` breadcrumb. The `UDashboardNavbar` supports this pattern.

### Dark Mode Toggle

The control plane inherits the theme system but doesn't expose a toggle. A simple color-mode switcher in the sidebar footer would be nice.

### Export/Import Settings

Ability to export effective config as JSON and import it into another environment. Useful for staging → production promotion.

---

## Next Steps (Prioritized)

### Immediate (before merge to main)

1. **Fix i18n keys (B1)** — Add missing translation keys so no raw keys appear in UI
2. **Fix icon warning (B2)** — Guard against empty model provider prefix
3. **Wire search palette (B3)** — Add navigation items to the search or remove the trigger
4. **Make port URLs clickable (I3)** — Simple `<a target="_blank">` tags
5. **Format audit log as table (I8)** — Replace raw JSON with structured columns

### Short-term (next sprint)

6. **Render knowledge content (I4)** — Use `@nuxtjs/mdc` to render the markdown knowledge file inline on feature detail pages
7. **Add agent tools (I5)** — Wire MCP tools into the agent's `streamText()` call, or use Vercel AI SDK tool definitions wrapping the same query functions
8. **Add loading/skeleton states (I7)** — `lazy: true` + `UCard` skeleton patterns
9. **Improve settings value display (I2)** — JSON tree viewer or formatted display for nested objects
10. **Add millisecond timestamps (I1)** — Format with `toISOString()` or dayjs

### Medium-term (next milestone)

11. **Feature dependency graph** — Visual node graph using `@unovis/ts`
12. **Live log streaming** — SSE endpoint replacing polling
13. **Agent multimodal support (I6)** — File uploads for the agent chat
14. **Config diff view** — Side-by-side environment comparison
15. **i18n management page** — Key browser, missing translation finder, inline editing
16. **User management** — Replace placeholder with actual user CRUD (requires DB adapter for `nuxt-auth-utils`)

### Long-term (product vision)

17. **Iframe app previews** — Split-pane with live app preview alongside control plane
18. **Feature scaffolding** — Create new features from the agent or UI (handler, knowledge, test)
19. **Deployment integration** — Build status, deployment history, environment promotion
20. **Alerting** — Error spike notifications, config change webhooks
21. **Plugin marketplace** — Browse and install community features from the control plane
22. **Multi-tenant** — Per-customer control plane views with RBAC

---

## Architecture Notes

### What went right

- **Shared utilities pattern** — Moving query functions from `core/docs/` to `core/server/utils/` was clean. Both layers auto-import the same functions. Zero duplication.
- **Layer alias pattern** — `#control-layer` for CSS resolution works correctly and follows the `#docs-layer` precedent.
- **Extension point** — `/control/` extending `core/control/` mirrors `/docs/` extending `core/docs/`. Customers can override any page, layout, or component.
- **API design** — All control plane APIs live under `/api/control/` namespace, avoiding collision with the existing `/api/settings/` and `/api/integrations/` routes that the control plane also consumes.

### Watch out for

- **DB file paths** — `knowledge.db` and `logs.db` are resolved via `getProjectRoot()` which returns the monorepo root. If the control plane is deployed separately (not as a monorepo child), these paths will break. Consider making DB paths configurable via env vars.
- **Settings API dependency** — The settings page calls `/api/settings/*` which requires `CORE_DATASOURCE_*` env vars. The page gracefully shows "Config service not available" when these aren't set, but the health dashboard's config stats section will show null. Consider a more unified "not configured" state.
- **Agent system prompt staleness** — The agent's system prompt is a static string in `chat.post.ts`. As the platform evolves, this will drift from reality. Consider generating it dynamically from `AGENTS.md` or feature knowledge.

---

## Test Coverage

The control plane has **zero dedicated tests**. The 222 passing tests are all from prior work (config service, feature wrappers, etc.). The relocated utility functions (`queryFeatureRegistry`, `queryRecentLogs`, etc.) are tested indirectly through the MCP tool tests, but the new API routes and page logic are untested.

**Recommended test additions:**
- Unit tests for each API route handler (mock DB, verify response shape)
- Component tests for key pages (features list, feature detail, log viewer)
- Integration test: start control plane, verify health endpoint returns valid data
- E2E test: navigate all pages, verify no console errors (could use the Chrome DevTools MCP)

---

## Summary

The control plane delivers a working developer dashboard in a single implementation pass. Health monitoring, feature introspection, log viewing, and settings management all function with real data. The agent page provides a foundation for AI-assisted development workflows.

The highest-impact next steps are: fix the cosmetic i18n issues (10 minutes), render knowledge content inline (30 minutes), and wire tools into the agent (2 hours). Those three changes transform this from "admin dashboard" to "AI-powered developer platform" — which is the whole point.
