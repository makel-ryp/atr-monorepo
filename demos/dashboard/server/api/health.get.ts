export default defineEventHandler(() => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    app: 'admin'
  }
})
