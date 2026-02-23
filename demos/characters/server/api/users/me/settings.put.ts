import { db, schema } from 'hub:db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { defu } from 'defu'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const patch = await readValidatedBody(event, z.record(z.unknown()).parse)

  // Get current settings
  const dbUser = await db.query.users.findFirst({
    where: () => eq(schema.users.id, user.id)
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const current = dbUser.settings ? JSON.parse(dbUser.settings) : {}
  const merged = defu(patch, current)

  await db.update(schema.users)
    .set({ settings: JSON.stringify(merged), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))

  return merged
})
