import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, z.object({
    slug: z.string().optional(),
    level: z.enum(['log', 'warn', 'error']).optional(),
    since: z.string().optional(),
    limit: z.coerce.number().optional()
  }).parse)

  return queryRecentLogs({
    slug: query.slug,
    level: query.level,
    since: query.since,
    limit: query.limit
  })
})
