// CONTEXT: health-checks — IETF draft-inadarei-api-health-check-06 health endpoint
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  const checks: Record<string, any[]> = {
    'uptime': [{
      componentType: 'system',
      observedValue: process.uptime(),
      observedUnit: 'seconds',
      status: 'pass',
      time: new Date().toISOString(),
    }],
    'memory:utilization': [{
      componentType: 'system',
      observedValue: Math.round(process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100),
      observedUnit: 'percent',
      status: 'pass',
      time: new Date().toISOString(),
    }],
  }

  // Derive overall status
  const statuses = Object.values(checks).flat().map(c => c.status)
  const overallStatus = statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : 'pass'

  setResponseStatus(event, overallStatus === 'fail' ? 503 : 200)
  setResponseHeader(event, 'Content-Type', 'application/health+json')
  setResponseHeader(event, 'Cache-Control', 'max-age=5')

  return {
    status: overallStatus,
    version: config.public.appVersion || '0.0.0',
    serviceId: config.public.serviceId || 'app-agent',
    description: `Health of ${config.public.serviceId || 'app-agent'}`,
    checks,
  }
})
