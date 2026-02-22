export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useAuth()

  // Guest-only pages — redirect to home if already logged in
  const guestPaths = ['/login', '/signup']
  if (guestPaths.some(p => to.path === p || to.path.startsWith(p + '/'))) {
    if (loggedIn.value) {
      return navigateTo('/')
    }
    return
  }

  // Public pages — accessible to everyone, no redirects
  const publicPaths = ['/', '/discover']
  if (publicPaths.some(p => to.path === p || to.path.startsWith(p + '/'))) {
    return
  }

  // Protected page — redirect to login if not authenticated
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
