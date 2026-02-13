# Control Plane — Next Steps

> Updated 2026-02-13

## Done

- B1: i18n locale fallback — added `en` import in app.vue
- B2: icon warning — guarded empty model provider prefix in ModelSelect
- B3: search palette — already wired (confirmed working)
- I1: timestamps — formatted with millisecond precision (HH:mm:ss.SSS)
- I3: port URLs — made clickable with `<a target="_blank">`
- I8: audit log — replaced raw JSON with UTable + new `/api/control/audit` endpoint
- Agent chat crash — added `convertToModelMessages()` before passing to `streamText()`
- Knowledge inline — feature detail pages render markdown via MDCCached
- Agent tools — 5 tools working end-to-end (3 fixes: `parameters`→`inputSchema`, all-required params for OpenRouter `isParsableJson` bug, tool invocation UI rendering)
- Dependency graph — SVG graph on features page with clickable nodes and edge arrows
- Live log streaming — SSE endpoint + Live toggle with pulsing radio icon and "+N new" counter
- Config diff — side-by-side environment comparison at /settings/diff with diff-only toggle
- Agent provider guard — 503 + friendly "not configured" UI when AI_PROVIDER_* env vars missing
- Env vars — added AI_PROVIDER_* to control/.env, added to .gitignore secrets, created .env.example

## Recommended Next

1. **Test the agent end-to-end** — restart dev server, verify agent chat works with OpenRouter, test tool calls (ask it "what features are registered?" and "show me recent errors")
2. **Run `bun run enc`** — encrypt the new control/.env into encrypted.json so it survives git clones

## Medium-term

3. Agent multimodal support (file uploads)
4. i18n management page
5. User management (replace placeholder with actual CRUD using nuxt-auth-utils DB adapter)
6. Iframe app previews (split-pane with live app alongside control plane)
7. Feature scaffolding from agent/UI (generate defineFeatureHandler boilerplate, knowledge stub, test file)
8. Loading/skeleton states for pages (lazy: true + UCard skeletons)
9. Settings JSON tree viewer (collapsible display for nested config objects)
