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
- Agent tools — 5 tools: listFeatures, getFeatureDetail, queryLogs, getLogSummary, readKnowledge
- Dependency graph — SVG graph on features page with clickable nodes and edge arrows

## Short-term

1. **Live log streaming** — SSE endpoint replacing polling
2. **Config diff view** — Side-by-side environment comparison

## Medium-term

3. Agent multimodal support (file uploads)
4. i18n management page
5. User management (replace placeholder)
6. Iframe app previews
7. Feature scaffolding from agent/UI
