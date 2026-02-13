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

## Short-term

1. **Render knowledge content inline** — Use `@nuxtjs/mdc` on feature detail pages to show the actual markdown
2. **Add agent tools** — Wire query functions (features, logs, settings) as AI SDK tool definitions
3. **Feature dependency graph** — Visual node graph using `@unovis/ts`
4. **Live log streaming** — SSE endpoint replacing polling
5. **Config diff view** — Side-by-side environment comparison

## Medium-term

6. Agent multimodal support (file uploads)
7. i18n management page
8. User management (replace placeholder)
9. Iframe app previews
10. Feature scaffolding from agent/UI
