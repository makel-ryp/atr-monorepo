import bcrypt from 'bcryptjs'
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse)

  // Find user by email
  const user = await db.query.users.findFirst({
    where: () => eq(schema.users.email, email)
  })

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  // Find credentials auth method for this user
  const authMethod = await db.query.authMethods.findFirst({
    where: () => and(
      eq(schema.authMethods.userId, user.id),
      eq(schema.authMethods.provider, 'credentials')
    )
  })

  if (!authMethod || !authMethod.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, authMethod.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  // Update last used
  await db.update(schema.authMethods).set({ lastUsedAt: new Date() })
    .where(eq(schema.authMethods.id, authMethod.id))

  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      username: user.username,
      provider: 'credentials',
      providerId: email,
      role: user.role
    }
  })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  }
})
