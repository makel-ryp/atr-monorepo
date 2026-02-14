export default defineEventHandler(async () => {
  const memory = process.memoryUsage()
  const uptime = process.uptime()

  // Feature registry stats
  const features = queryFeatureRegistry()

  // Log summary
  const logSummary = getLogSummary()

  // Integration status
  const integrations = validateIntegrations()

  // Config service stats (internal fetch)
  let configStats = null
  try {
    configStats = await $fetch('/api/settings/stats')
  }
  catch {
    // Config service may not be configured
  }

  return {
    uptime: Math.round(uptime),
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024)
    },
    environment: process.env.CORE_ENVIRONMENT || process.env.NODE_ENV || 'development',
    features: {
      count: features.length,
      slugs: features.map(f => f.slug)
    },
    logs: {
      total: logSummary.total,
      errors: logSummary.byLevel.find(l => l.level === 'error')?.count ?? 0,
      warnings: logSummary.byLevel.find(l => l.level === 'warn')?.count ?? 0
    },
    integrations: {
      ok: integrations.ok,
      issues: integrations.issues,
      provider: process.env.AI_PROVIDER_URL ? new URL(process.env.AI_PROVIDER_URL).host : null
    },
    configService: configStats,
    ports: {
      docs: 3000,
      control: 3001,
      dashboard: 3010,
      saas: 3011,
      landing: 3012,
      chat: 3013
    }
  }
})
