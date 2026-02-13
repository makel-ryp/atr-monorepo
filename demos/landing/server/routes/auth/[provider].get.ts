// SEE: feature "authentication" at core/docs/knowledge/authentication.md
// Session-only OAuth (no database) — user lives in encrypted cookie

const handlers: Record<string, ReturnType<typeof defineEventHandler>> = {
  github: defineOAuthGitHubEventHandler({
    async onSuccess(event, { user: ghUser }) {
      return handleOAuthSuccess(event, 'github', ghUser.id.toString(), {
        name: ghUser.name,
        email: ghUser.email,
        avatar: ghUser.avatar_url,
        username: ghUser.login
      })
    },
    onError(event, error) {
      console.error('GitHub OAuth error:', error)
      return sendRedirect(event, '/login?error=auth')
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
