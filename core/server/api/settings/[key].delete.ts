// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
export default defineEventHandler(async (event) => {
  const store = getConfigStore()
  if (!store) {
    throw createError({ statusCode: 503, statusMessage: 'Config service not available' })
  }

  const key = getRouterParam(event, 'key')
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Missing setting key' })
  }

  const query = getQuery(event)
  const appId = query.appId as string
  const environment = query.environment as string
  if (!appId || !environment) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required query params: appId, environment' })
  }

  const layerName = (query.layerName as string) || 'core:app'
  const layerKey = (query.layerKey as string) || 'default'
  const changedBy = (query.changedBy as string) || 'api'

  const deleted = await store.deleteSetting(appId, environment, layerName, layerKey, key, changedBy)

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: `Setting "${key}" not found in ${layerName}/${layerKey}` })
  }

  return { ok: true, key, appId, environment, layerName, layerKey }
})
