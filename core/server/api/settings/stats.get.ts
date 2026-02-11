// SEE: feature "runtime-config" at core/docs/knowledge/runtime-config.md
export default defineEventHandler(async () => {
  const store = getConfigStore()
  if (!store) {
    throw createError({ statusCode: 503, statusMessage: 'Config service not available' })
  }

  const stats = await store.getStats()
  const recentHistory = await store.getRecentHistory(10)

  return {
    ...stats,
    recentChanges: recentHistory.length,
    lastChange: recentHistory[0]?.changed_at || null,
  }
})
