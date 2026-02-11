// CONTEXT: structured-logging — Emits structured JSON log after each response
export default defineContextPlugin('structured-logging', (ctx, nitroApp) => {
  nitroApp.hooks.hook('afterResponse', (event) => {
    const log = event.context?.log
    if (!log) return

    const entry = {
      requestId: log.requestId,
      method: event.method,
      path: event.path,
      status: getResponseStatus(event),
      duration: Date.now() - log.startTime,
      timestamp: new Date().toISOString(),
    }

    console.log(JSON.stringify(entry))
  })
})
