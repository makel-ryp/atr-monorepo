export interface UserSettings {
  theme?: {
    primary?: string
    secondary?: string
    neutral?: string
    mode?: string
  }
  chat?: {
    notifications?: boolean
  }
}

export function useUserSettings() {
  const { loggedIn } = useAuth()

  const { data, refresh } = useFetch<{ settings: UserSettings }>('/api/users/me', {
    default: () => ({ settings: {} }),
    immediate: loggedIn.value
  })

  const settings = computed(() => data.value?.settings || {})

  async function updateSettings(patch: Partial<UserSettings>) {
    if (!loggedIn.value) return
    const result = await $fetch('/api/users/me/settings', {
      method: 'PUT',
      body: patch
    })
    await refresh()
    return result
  }

  return {
    settings,
    updateSettings,
    refresh
  }
}
