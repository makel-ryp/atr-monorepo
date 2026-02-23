import bcrypt from 'bcryptjs'
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const { email, password, name } = await readValidatedBody(event, bodySchema.parse)
  const session = await getUserSession(event)

  // Check if a credentials auth method already exists for this email
  const existingMethod = await db.query.authMethods.findFirst({
    where: () => and(
      eq(schema.authMethods.provider, 'credentials'),
      eq(schema.authMethods.providerId, email)
    )
  })

  if (existingMethod) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Check if a user with this email already exists (e.g. signed up via OAuth)
  let user = await db.query.users.findFirst({
    where: () => eq(schema.users.email, email)
  })

  if (user) {
    // Link credentials to existing OAuth user
    await db.insert(schema.authMethods).values({
      userId: user.id,
      provider: 'credentials',
      providerId: email,
      providerEmail: email,
      passwordHash,
      lastUsedAt: new Date()
    })

    // Update name if the user didn't have one
    if (!user.name && name) {
      await db.update(schema.users).set({ name, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id))
      user = { ...user, name }
    }
  } else {
    // Create new user + credentials auth method
    const rows = await db.insert(schema.users).values({
      id: session.id,
      email,
      name,
      provider: 'credentials',
      providerId: email,
      passwordHash
    }).returning()
    user = rows[0]!

    await db.insert(schema.authMethods).values({
      userId: user.id,
      provider: 'credentials',
      providerId: email,
      providerEmail: email,
      passwordHash,
      lastUsedAt: new Date()
    })
  }

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
