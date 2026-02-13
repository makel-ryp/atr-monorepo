// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md
const buckets = new Map<string, { tokens: number, lastRefill: number }>()

export default defineFeatureHandler('rate-limiting', (feat, event) => {
  const config = useRuntimeConfig(event)
  if ((config as any).rateLimiter?.enabled === false) return

  const { tokensPerInterval, interval } = (config as any).rateLimiter
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const key = `rateLimit:${ip}`
  const now = Date.now()

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: tokensPerInterval, lastRefill: now }
    buckets.set(key, bucket)
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill
  if (elapsed >= interval) {
    bucket.tokens = tokensPerInterval
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    setResponseHeader(event, 'Retry-After', String(Math.ceil((interval - elapsed) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }

  bucket.tokens--
})
