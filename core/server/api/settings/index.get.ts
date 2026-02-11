// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
export default defineEventHandler(async (event) => {
  const store = getConfigStore()
  if (!store) {
    throw createError({ statusCode: 503, statusMessage: 'Config service not available' })
  }

  const query = getQuery(event)
  const appId = query.appId as string
  const environment = query.environment as string
  if (!appId || !environment) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required query params: appId, environment' })
  }

  const flat = query.flat === 'true'

  // Build layer resolution context from remaining query params
  const context: Record<string, string | undefined> = {}
  if (query.userId) context.userId = query.userId as string
  for (const [key, val] of Object.entries(query)) {
    if (!['appId', 'environment', 'flat', 'userId'].includes(key) && typeof val === 'string') {
      context[key] = val
    }
  }

  const result = await store.getEffectiveConfig(appId, environment, Object.keys(context).length > 0 ? context : undefined)

  return {
    config: flat ? flattenConfig(result.config) : result.config,
    lockedPaths: [...result.lockedPaths],
  }
})
