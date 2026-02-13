import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, z.object({
    since: z.string().optional()
  }).parse)

  return getLogSummary(query.since)
})
