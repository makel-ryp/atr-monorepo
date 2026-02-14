// SEE: feature "authentication" at core/docs/knowledge/authentication.md
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

const handlers: Record<string, ReturnType<typeof defineEventHandler>> = {
  github: defineOAuthGitHubEventHandler({
    async onSuccess(event, { user: ghUser }) {
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
          const [user] = await db.insert(schema.users).values(userData).returning()
          return user
        }
      })
    },
    onError(event, error) {
      console.error('GitHub OAuth error:', error)
      return sendRedirect(event, '/?error=auth')
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
