// CONTEXT: runtime-config — Nitro plugin: initializes config service + realtime subscription (ADR-005)
export default defineContextPlugin('runtime-config', async (ctx, nitroApp) => {
  const provider = createConfigProvider()

  if (!provider) {
    ctx.warn('Core datasource not configured — runtime config service disabled')
    ctx.warn('Set CORE_DATASOURCE_URL, CORE_DATASOURCE_KEY, and CORE_DATASOURCE_PROVIDER in .env')
    return
  }

  // Resolve app identity and environment for subscription filtering
  const appId = useRuntimeConfig().public.serviceId || 'app-agent'
  const environment = process.env.CORE_ENVIRONMENT || process.env.NODE_ENV || 'development'

  try {
    await provider.initialize()
    const store = initConfigStore(provider)

    // Pre-load layers for this app into cache
    const layers = await store.getLayersForApp(appId, environment)
    ctx.log(`Loaded ${layers.length} config layer(s) for ${appId}/${environment} from ${process.env.CORE_DATASOURCE_PROVIDER || 'supabase'} datasource`)

    // Subscribe to realtime changes
    await store.subscribe((event) => {
      ctx.log(`Config change: ${event.eventType} on ${event.table}`)
      store.invalidate()
    })

    ctx.log('Runtime config service ready')

    // Cleanup on shutdown
    nitroApp.hooks.hook('close', async () => {
      await store.destroy()
      ctx.log('Runtime config service shut down')
    })
  } catch (err: any) {
    ctx.error('Failed to initialize config service', err.message)
    ctx.warn('Runtime config service disabled — app will use static config only')
  }
})
