import { db, schema } from 'hub:db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const dbUser = await db.query.users.findFirst({
    where: () => eq(schema.users.id, user.id)
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    avatar: dbUser.avatar,
    username: dbUser.username,
    role: dbUser.role,
    settings: dbUser.settings ? JSON.parse(dbUser.settings) : {}
  }
})
