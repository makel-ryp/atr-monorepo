// SEE: feature "structured-logging" at core/docs/knowledge/structured-logging.md
export default defineFeatureHandler('structured-logging', (feat, event) => {
  event.context.log = {
    requestId: event.context.requestId,
    startTime: Date.now(),
  }
})
