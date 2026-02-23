import { db, schema } from 'hub:db'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readValidatedBody(event, z.object({
    name: z.string().min(1),
    age: z.number().int().positive().optional(),
    description: z.string().default(''),
    instructions: z.string().default(''),
    avatar: z.string().default(''),
    tags: z.array(z.string()).default([]),
    profile: z.record(z.string()).default({}),
    isNew: z.boolean().default(false),
    isLive: z.boolean().default(false),
    hasAudio: z.boolean().default(false)
  }).parse)

  const [character] = await db.insert(schema.characters).values({
    ownerId: user.id,
    ...body
  }).returning()

  setResponseStatus(event, 201)
  return character
})
