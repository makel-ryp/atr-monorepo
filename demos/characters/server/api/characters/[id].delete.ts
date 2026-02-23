import { db, schema } from 'hub:db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const existing = await db.query.characters.findFirst({
    where: () => and(eq(schema.characters.id, id), eq(schema.characters.ownerId, user.id))
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Character not found or not owned by you' })
  }

  await db.delete(schema.characters).where(eq(schema.characters.id, id))

  return { ok: true }
})
