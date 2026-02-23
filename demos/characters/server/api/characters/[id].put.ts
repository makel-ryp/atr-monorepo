import { db, schema } from 'hub:db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const body = await readValidatedBody(event, z.object({
    name: z.string().min(1).optional(),
    age: z.number().int().positive().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    avatar: z.string().optional(),
    tags: z.array(z.string()).optional(),
    profile: z.record(z.string()).optional(),
    isNew: z.boolean().optional(),
    isLive: z.boolean().optional(),
    hasAudio: z.boolean().optional()
  }).parse)

  const existing = await db.query.characters.findFirst({
    where: () => and(eq(schema.characters.id, id), eq(schema.characters.ownerId, user.id))
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Character not found or not owned by you' })
  }

  const [updated] = await db.update(schema.characters)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.characters.id, id))
    .returning()

  return updated
})
