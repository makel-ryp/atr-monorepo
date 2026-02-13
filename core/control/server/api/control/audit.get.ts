export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 20

  const store = getConfigStore()
  if (!store) {
    return []
  }

  return store.getRecentHistory(limit)
})
