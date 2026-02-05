import { createSharedComposable } from '@vueuse/core'

interface ShortcutConfig {
  action: 'navigate' | 'toggle'
  to?: string
  target?: string
}

const _useDashboard = () => {
  const route = useRoute()
  const router = useRouter()
  const { dashboard } = useAppConfig()
  const isNotificationsSlideoverOpen = ref(false)

  const shortcutConfig = dashboard?.shortcuts ?? {
    'g-h': { action: 'navigate', to: '/' },
    'g-i': { action: 'navigate', to: '/inbox' },
    'g-c': { action: 'navigate', to: '/customers' },
    'g-s': { action: 'navigate', to: '/settings' },
    'n': { action: 'toggle', target: 'notifications' }
  }

  const shortcuts: Record<string, () => void> = {}
  for (const [key, config] of Object.entries(shortcutConfig) as [string, ShortcutConfig][]) {
    if (config.action === 'navigate' && config.to) {
      shortcuts[key] = () => router.push(config.to!)
    } else if (config.action === 'toggle' && config.target === 'notifications') {
      shortcuts[key] = () => isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value
    }
  }

  defineShortcuts(shortcuts)

  watch(() => route.fullPath, () => {
    isNotificationsSlideoverOpen.value = false
  })

  return {
    isNotificationsSlideoverOpen
  }
}

export const useDashboard = createSharedComposable(_useDashboard)
