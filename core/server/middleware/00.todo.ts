// CONTEXT: layer-cascade — POC middleware proving cross-cutting cascade from core
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  if ((config as any).todo?.enabled === false) return

  event.context.todo = {
    items: [
      { id: 1, text: 'Implement i18n across all layers', done: true },
      { id: 2, text: 'Add server middleware cascade', done: true },
      { id: 3, text: 'Build health check endpoint', done: false },
      { id: 4, text: 'Set up runtime config service (ADR-005)', done: false },
    ],
    injectedBy: 'core',
    timestamp: new Date().toISOString(),
  }
})
