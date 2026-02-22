<script setup lang="ts">
const open = ref(false)
const sidebarCollapsed = ref(false)
const { sidebarPanels, activePanel, selectPanel } = useCharacterPanels()
const { loggedIn } = useAuth()
const route = useRoute()

// Sync active panel with current route
watch(() => route.path, (path) => {
  const match = characterPanels.find(p => 'to' in p && p.to === path)
  if (match) selectPanel(match.id)
}, { immediate: true })

// Auto-collapse sidebar on chat page, expand on all others.
// Use post-flush to run after UDashboardSidebar reads its cookie.
function syncSidebarCollapse() {
  sidebarCollapsed.value = route.path === '/chat'
}

watch(() => route.path, syncSidebarCollapse)
onMounted(() => nextTick(syncSidebarCollapse))

function handlePanelClick(panel: typeof characterPanels[number]) {
  selectPanel(panel.id)
  if ('to' in panel && panel.to) {
    navigateTo(panel.to)
  }
}

// Redirect to login when session is cleared on protected pages
const publicPaths = ['/', '/discover', '/login', '/signup']
watch(loggedIn, async (isLoggedIn) => {
  if (!isLoggedIn && !publicPaths.includes(route.path)) {
    await nextTick()
    navigateTo('/login')
  }
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      v-model:collapsed="sidebarCollapsed"
      :min-size="12"
      collapsible
      resizable
      class="bg-elevated/80"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-3 min-w-0" :class="collapsed ? 'w-full justify-center' : 'px-3'">
          <Logo class="h-5 w-5 shrink-0 object-contain" />
          <span v-if="!collapsed" class="text-xl font-bold text-highlighted truncate">Characters</span>
        </NuxtLink>

        <UDashboardSidebarCollapse v-if="!collapsed" class="ms-auto shrink-0" />
      </template>

      <template #default="{ collapsed }">
        <nav class="flex flex-col gap-2">
          <!-- Expand button when collapsed -->
          <UTooltip
            v-if="collapsed"
            text="Expand sidebar"
            side="right"
          >
            <UDashboardSidebarCollapse class="w-full" />
          </UTooltip>

          <!-- Separator between expand button and menu items -->
          <div v-if="collapsed" class="border-b border-white/10 my-1" />

          <!-- Panel menu items -->
          <UTooltip
            v-for="panel in sidebarPanels"
            :key="panel.id"
            :text="panel.label"
            :disabled="!collapsed"
            side="right"
          >
            <button
              class="group flex items-center rounded-md text-sm font-medium transition-colors w-full"
              :class="[
                collapsed ? 'justify-center p-1.5' : 'gap-3 px-3 py-1.5 text-left',
                activePanel === panel.id
                  ? 'bg-elevated text-highlighted'
                  : 'text-muted hover:text-highlighted hover:bg-elevated'
              ]"
              @click="handlePanelClick(panel)"
            >
              <UIcon :name="panel.icon" class="size-5 shrink-0" />
              <template v-if="!collapsed">
                <span class="flex-1">{{ panel.label }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 opacity-50" />
              </template>
            </button>
          </UTooltip>
        </nav>
      </template>

      <template #footer="{ collapsed }">
        <UserMenu v-if="loggedIn" :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>

<style scoped>
/* Reduce header height when sidebar is collapsed so logo-to-menu gap matches menu item gap */
:deep(#dashboard-sidebar-default[data-collapsed="true"] [data-slot="header"]) {
  height: auto !important;
  padding-top: 16px;
  padding-bottom: 6px;
}

/* Add bottom padding to footer for better spacing */
:deep(#dashboard-sidebar-default [data-slot="footer"]) {
  padding-bottom: 10px;
}
</style>
