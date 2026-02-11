// CONTEXT: structured-logging — Attaches logging context for downstream use
export default defineContextHandler('structured-logging', (ctx, event) => {
  event.context.log = {
    requestId: event.context.requestId,
    startTime: Date.now(),
  }
})
