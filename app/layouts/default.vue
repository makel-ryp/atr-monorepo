<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { clear } = useUserSession()
const open = ref(false)

const links: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Forecast', icon: 'i-lucide-trending-up', to: '/forecast' },
  { label: 'Order Planner', icon: 'i-lucide-clipboard-list', to: '/order-planner' },
  { label: 'Stock Pipeline', icon: 'i-lucide-package', to: '/stock-pipeline' },
  { label: 'AI Advisor', icon: 'i-lucide-bot', to: '/ai-advisor' },
  { label: 'Admin', icon: 'i-lucide-settings', to: '/admin' },
  { label: 'Run History', icon: 'i-lucide-history', to: '/run-history' },
  { label: 'PO History', icon: 'i-lucide-file-text', to: '/po-history' },
  { label: 'EDI Orders', icon: 'i-lucide-building-2', to: '/edi-orders' }
]

async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-2 py-1.5">
          <UIcon name="i-lucide-boxes" class="h-5 w-5 shrink-0 text-primary" />
          <span v-if="!collapsed" class="font-semibold text-sm truncate">Inventory</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <UButton
          :icon="collapsed ? 'i-lucide-log-out' : undefined"
          :label="collapsed ? undefined : 'Logout'"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'w-full justify-start' }"
          @click="logout"
        >
          <template v-if="!collapsed">
            <UIcon name="i-lucide-log-out" class="mr-2" />
            Logout
          </template>
        </UButton>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
