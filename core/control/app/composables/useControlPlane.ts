import { createSharedComposable } from '@vueuse/core'

const _useControlPlane = () => {
  const router = useRouter()

  defineShortcuts({
    'g-h': () => router.push('/'),
    'g-f': () => router.push('/features'),
    'g-l': () => router.push('/logs'),
    'g-s': () => router.push('/settings'),
    'g-i': () => router.push('/i18n'),
    'g-a': () => router.push('/agent')
  })

  return {}
}

export const useControlPlane = createSharedComposable(_useControlPlane)
