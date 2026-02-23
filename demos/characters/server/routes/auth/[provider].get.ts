// SEE: feature "authentication" at core/docs/knowledge/authentication.md
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

interface OAuthProfile {
  provider: string
  providerId: string
  email: string
  name: string
  avatar: string
  username: string
}

async function handleOAuthLink(event: any, profile: OAuthProfile) {
  const session = await getUserSession(event)

  // 1. Check auth_methods for existing link
  const existingMethod = await db.query.authMethods.findFirst({
    where: () => and(
      eq(schema.authMethods.provider, profile.provider),
      eq(schema.authMethods.providerId, profile.providerId)
    )
  })

  if (existingMethod) {
    // Known auth method — load the user
    const user = await db.query.users.findFirst({
      where: () => eq(schema.users.id, existingMethod.userId)
    })
    if (!user) throw createError({ statusCode: 500, statusMessage: 'User not found for auth method' })

    // Update last used
    await db.update(schema.authMethods).set({ lastUsedAt: new Date() })
      .where(eq(schema.authMethods.id, existingMethod.id))

    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        username: user.username,
        provider: profile.provider,
        providerId: profile.providerId,
        role: user.role
      }
    })
    return sendRedirect(event, '/')
  }

  // 2. No existing auth method — check if a user with this email exists (account linking)
  let user: typeof schema.users.$inferSelect | undefined

  if (profile.email) {
    user = await db.query.users.findFirst({
      where: () => eq(schema.users.email, profile.email)
    }) ?? undefined
  }

  if (user) {
    // Link this OAuth provider to the existing user
    await db.insert(schema.authMethods).values({
      userId: user.id,
      provider: profile.provider,
      providerId: profile.providerId,
      providerEmail: profile.email,
      lastUsedAt: new Date()
    })

    // Update user profile with OAuth data if fields are empty
    const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() }
    if (!user.avatar && profile.avatar) updates.avatar = profile.avatar
    if (!user.username && profile.username) updates.username = profile.username
    if (!user.name && profile.name) updates.name = profile.name
    await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id))

    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.name || profile.name,
        email: user.email,
        avatar: user.avatar || profile.avatar,
        username: user.username || profile.username,
        provider: profile.provider,
        providerId: profile.providerId,
        role: user.role
      }
    })
    return sendRedirect(event, '/')
  }

  // 3. Brand new user — create user + auth method
  const rows = await db.insert(schema.users).values({
    id: session.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    username: profile.username,
    provider: profile.provider,
    providerId: profile.providerId
  } as typeof schema.users.$inferInsert).returning()
  const newUser = rows[0]!

  await db.insert(schema.authMethods).values({
    userId: newUser.id,
    provider: profile.provider,
    providerId: profile.providerId,
    providerEmail: profile.email,
    lastUsedAt: new Date()
  })

  await setUserSession(event, {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      username: newUser.username,
      provider: profile.provider,
      providerId: profile.providerId,
      role: newUser.role
    }
  })
  return sendRedirect(event, '/')
}

const handlers: Record<string, ReturnType<typeof defineEventHandler>> = {
  github: defineOAuthGitHubEventHandler({
    async onSuccess(event, { user: ghUser }) {
      return handleOAuthLink(event, {
        provider: 'github',
        providerId: ghUser.id.toString(),
        email: ghUser.email ?? '',
        name: ghUser.name ?? '',
        avatar: ghUser.avatar_url ?? '',
        username: ghUser.login ?? ''
      })
    },
    onError(event, error) {
      console.error('GitHub OAuth error:', error)
      return sendRedirect(event, '/login')
    }
  }),

  google: defineOAuthGoogleEventHandler({
    config: {
      scope: ['email', 'profile']
    },
    async onSuccess(event, { user: googleUser }) {
      return handleOAuthLink(event, {
        provider: 'google',
        providerId: googleUser.sub,
        email: googleUser.email ?? '',
        name: googleUser.name ?? '',
        avatar: googleUser.picture ?? '',
        username: ''
      })
    },
    onError(event, error) {
      console.error('Google OAuth error:', error)
      return sendRedirect(event, '/login')
    }
  })
}

export default defineEventHandler((event) => {
  const provider = getRouterParam(event, 'provider')
  if (!provider || !handlers[provider]) {
    throw createError({ statusCode: 404, statusMessage: `Auth provider "${provider}" not configured` })
  }
  return handlers[provider](event)
})
