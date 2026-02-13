// SEE: feature "authentication" at core/docs/knowledge/authentication.md

interface AuthReturn {
  loggedIn: ComputedRef<boolean>
  user: ComputedRef<any>
  role: ComputedRef<'public' | 'registered' | 'admin'>
  isAdmin: ComputedRef<boolean>
  isRegistered: ComputedRef<boolean>
  login: (provider: string) => void
  logout: () => Promise<void>
}

const defaults: AuthReturn = {
  loggedIn: computed(() => false),
  user: computed(() => null),
  role: computed(() => 'public' as const),
  isAdmin: computed(() => false),
  isRegistered: computed(() => false),
  login: (_provider: string) => {},
  logout: async () => {}
}

export const useAuth = defineFeatureComposable('authentication', (feat): AuthReturn => {
  // Check if useUserSession is available (only when nuxt-auth-utils module is loaded)
  if (typeof useUserSession !== 'function') {
    return defaults
  }

  try {
    const { loggedIn, user, clear, openInPopup } = useUserSession()

    const role = computed(() => user.value?.role || 'public')
    const isAdmin = computed(() => role.value === 'admin')
    const isRegistered = computed(() => role.value === 'registered' || role.value === 'admin')

    function login(provider: string) {
      openInPopup(`/auth/${provider}`)
    }

    async function logout() {
      await clear()
      navigateTo('/')
    }

    return {
      loggedIn,
      user,
      role,
      isAdmin,
      isRegistered,
      login,
      logout
    }
  } catch {
    feat.log('nuxt-auth-utils not available, returning defaults')
    return defaults
  }
})
