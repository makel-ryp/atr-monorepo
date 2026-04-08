export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  // Allow login page and auth API through
  if (url.pathname === '/login' || url.pathname.startsWith('/api/auth/')) {
    return
  }

  const session = await getUserSession(event)
  if (!session?.user?.loggedIn) {
    // API routes get 401, page routes get redirect
    if (url.pathname.startsWith('/api/')) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    await sendRedirect(event, '/login')
  }
})
