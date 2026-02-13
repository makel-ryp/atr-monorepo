<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

useControlPlane()

const open = ref(false)

const primaryItems: NavigationMenuItem[] = [{
  label: 'Health',
  icon: 'i-lucide-heart-pulse',
  to: '/',
  onSelect: () => { open.value = false }
}, {
  label: 'Features',
  icon: 'i-lucide-blocks',
  to: '/features',
  onSelect: () => { open.value = false }
}, {
  label: 'Logs',
  icon: 'i-lucide-scroll-text',
  to: '/logs',
  onSelect: () => { open.value = false }
}, {
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings',
  onSelect: () => { open.value = false }
}, {
  label: 'Agent',
  icon: 'i-lucide-bot',
  to: '/agent',
  onSelect: () => { open.value = false }
}]

const secondaryItems: NavigationMenuItem[] = [{
  label: 'Users',
  icon: 'i-lucide-users',
  to: '/users',
  onSelect: () => { open.value = false }
}]

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: [...primaryItems, ...secondaryItems]
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2 px-2 py-1.5">
          <ControlLogo :collapsed="collapsed" />
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="primaryItems"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="secondaryItems"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
