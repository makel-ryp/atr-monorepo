// SEE: feature "authentication" at core/docs/knowledge/authentication.md
const handlers: Record<string, ReturnType<typeof defineEventHandler>> = {
  github: defineOAuthGitHubEventHandler({
    async onSuccess(event, { user: ghUser }) {
      // Session-only mode — no DB adapter needed for the control plane
      return handleOAuthSuccess(event, 'github', ghUser.id.toString(), {
        name: ghUser.name,
        email: ghUser.email,
        avatar: ghUser.avatar_url,
        username: ghUser.login
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
