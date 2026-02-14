// SEE: feature "authentication" at core/docs/knowledge/authentication.md
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

const handlers: Record<string, ReturnType<typeof defineEventHandler>> = {
  github: defineOAuthGitHubEventHandler({
    async onSuccess(event, { user: ghUser }) {
      const session = await getUserSession(event)

      return handleOAuthSuccess(event, 'github', ghUser.id.toString(), {
        name: ghUser.name,
        email: ghUser.email,
        avatar: ghUser.avatar_url,
        username: ghUser.login
      }, {
        findByProvider: async (provider, providerId) => {
          return db.query.users.findFirst({
            where: () => and(
              eq(schema.users.provider, provider),
              eq(schema.users.providerId, providerId)
            )
          })
        },
        create: async (userData) => {
          const [user] = await db.insert(schema.users).values({
            id: session.id,
            ...userData
          }).returning()
          return user
        },
        onLogin: async (user) => {
          // Assign anonymous chats with session id to authenticated user
          await db.update(schema.chats).set({
            userId: user.id
          }).where(eq(schema.chats.userId, session.id))
        }
      })
    },
    onError(event, error) {
      console.error('GitHub OAuth error:', error)
      return sendRedirect(event, '/')
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
