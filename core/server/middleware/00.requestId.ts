// SEE: feature "request-tracking" at core/docs/knowledge/request-tracking.md
export default defineFeatureHandler('request-tracking', (feat, event) => {
  const requestId = crypto.randomUUID()
  event.context.requestId = requestId
  setResponseHeader(event, 'X-Request-ID', requestId)
})
