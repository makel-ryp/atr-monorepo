// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
export default defineFeaturePlugin('runtime-config', async (feat, nitroApp) => {
  const provider = createConfigProvider()

  if (!provider) {
    feat.log('No datasource configured — using static config only')
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
    feat.log(`Loaded ${layers.length} config layer(s) for ${appId}/${environment} from ${process.env.CORE_DATASOURCE_PROVIDER || 'supabase'} datasource`)

    // Subscribe to realtime changes
    await store.subscribe((event) => {
      feat.log(`Config change: ${event.eventType} on ${event.table}`)
      store.invalidate()
    })

    feat.log('Runtime config service ready')

    // Cleanup on shutdown
    nitroApp.hooks.hook('close', async () => {
      await store.destroy()
      feat.log('Runtime config service shut down')
    })
  } catch (err: any) {
    feat.error('Failed to initialize config service', err.message)
    feat.warn('Runtime config service disabled — app will use static config only')
  }
})
