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
- Live log streaming — SSE endpoint + Live toggle with pulsing radio icon and "+N new" counter
- Config diff — side-by-side environment comparison at /settings/diff with diff-only toggle

## Medium-term

1. Agent multimodal support (file uploads)
2. i18n management page
3. User management (replace placeholder)
4. Iframe app previews
5. Feature scaffolding from agent/UI
