// CONTEXT: layer-cascade — POC plugin proving cross-cutting plugin cascade from core
export default defineContextPlugin('layer-cascade', async (ctx, nitroApp) => {
  ctx.log('Core layer plugin loaded')

  nitroApp.hooks.hook('afterResponse', (event: any) => {
    if (import.meta.dev) {
      ctx.log(`${event.method} ${event.path} completed`)
    }
  })
})
