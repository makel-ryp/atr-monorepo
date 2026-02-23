export const characterPanels = [
  { id: 'home', label: 'Home', icon: 'i-lucide-house', sidebar: true, to: '/' },
  { id: 'discover', label: 'Discover', icon: 'i-lucide-compass', sidebar: true, to: '/discover' },
  { id: 'chat', label: 'Chat', icon: 'i-lucide-messages-square', sidebar: true, to: '/chat' },
  { id: 'collection', label: 'Collection', icon: 'i-lucide-image', sidebar: true, to: '/collection' },
  { id: 'create-character', label: 'Create Character', icon: 'i-lucide-user-plus', sidebar: true },
  { id: 'settings', label: 'Settings', icon: 'i-lucide-settings', sidebar: false }
] as const

const activePanel = ref<string | null>('home')

export function useCharacterPanels() {
  function togglePanel(id: string) {
    activePanel.value = activePanel.value === id ? null : id
  }

  function selectPanel(id: string) {
    activePanel.value = id
  }

  function closePanel() {
    activePanel.value = null
  }

  const sidebarPanels = characterPanels.filter(p => p.sidebar)

  const activeSidePanel = computed(() => {
    return characterPanels.find(p => p.id === activePanel.value) || null
  })

  return {
    panels: characterPanels,
    sidebarPanels,
    activePanel: readonly(activePanel),
    activeSidePanel,
    togglePanel,
    selectPanel,
    closePanel
  }
}
