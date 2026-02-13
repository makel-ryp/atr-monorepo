// SEE: feature "authentication" at core/docs/knowledge/authentication.md
export default defineFeatureHandler('authentication', async (feat, event) => {
  // Guard: skip if nuxt-auth-utils is not configured (no session password)
  const config = useRuntimeConfig()
  if (!config.session?.password) {
    event.context.auth = { loggedIn: false, user: null, role: 'public' as const }
    return
  }

  const user = await getAuthUser(event)
  event.context.auth = {
    loggedIn: !!user,
    user,
    role: user?.role || 'public'
  } satisfies AuthContext
})
