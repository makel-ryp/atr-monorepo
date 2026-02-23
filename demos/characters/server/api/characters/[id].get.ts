import { db, schema } from 'hub:db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const character = await db.query.characters.findFirst({
    where: () => eq(schema.characters.id, id)
  })

  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Character not found' })
  }

  return character
})
