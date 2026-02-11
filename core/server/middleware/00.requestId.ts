// CONTEXT: request-tracking — Injects a unique request ID into every request
export default defineContextHandler('request-tracking', (ctx, event) => {
  const requestId = crypto.randomUUID()
  event.context.requestId = requestId
  setResponseHeader(event, 'X-Request-ID', requestId)
})
