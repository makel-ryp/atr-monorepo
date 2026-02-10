// CONTEXT: runtime-config — PUT /api/settings/:key — update a setting in a layer
export default defineEventHandler(async (event) => {
  const store = getConfigStore()
  if (!store) {
    throw createError({ statusCode: 503, statusMessage: 'Config service not available' })
  }

  const key = getRouterParam(event, 'key')
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Missing setting key' })
  }

  const body = await readBody(event)
  if (body === undefined || body === null || !('value' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must include "value"' })
  }

  const appId = body.appId as string
  const environment = body.environment as string
  if (!appId || !environment) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must include "appId" and "environment"' })
  }

  const layerName = body.layerName || 'core:app'
  const layerKey = body.layerKey || 'default'
  const changedBy = body.changedBy || 'api'
  const changeReason = body.changeReason

  await store.updateSetting(appId, environment, layerName, layerKey, key, body.value, changedBy, changeReason)

  return { ok: true, key, appId, environment, layerName, layerKey }
})
