// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
export default defineEventHandler(async (event) => {
  const store = getConfigStore()
  if (!store) {
    throw createError({ statusCode: 503, statusMessage: 'Config service not available' })
  }

  const query = getQuery(event)
  const appId = query.appId as string
  const environment = query.environment as string
  const layerName = query.layerName as string
  const layerKey = query.layerKey as string
  if (!appId || !environment || !layerName || !layerKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required query params: appId, environment, layerName, layerKey' })
  }

  const limit = parseInt(query.limit as string) || 50

  const history = await store.getHistory(appId, environment, layerName, layerKey, limit)

  return { appId, environment, layerName, layerKey, history }
})
