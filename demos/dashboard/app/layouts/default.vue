<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()
const { dashboard } = useAppConfig()

const open = ref(false)

const sidebarConfig = computed(() => dashboard?.sidebar ?? {
  primary: [{
    label: 'Home',
    icon: 'i-lucide-house',
    to: '/'
  }, {
    label: 'Inbox',
    icon: 'i-lucide-inbox',
    to: '/inbox',
    badge: '4'
  }, {
    label: 'Customers',
    icon: 'i-lucide-users',
    to: '/customers'
  }, {
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings',
    defaultOpen: true,
    children: [{
      label: 'General',
      to: '/settings',
      exact: true
    }, {
      label: 'Members',
      to: '/settings/members'
    }, {
      label: 'Notifications',
      to: '/settings/notifications'
    }, {
      label: 'Security',
      to: '/settings/security'
    }]
  }],
  secondary: [{
    label: 'Feedback',
    icon: 'i-lucide-message-circle',
    to: 'https://github.com/nuxt-ui-templates/dashboard',
    target: '_blank'
  }, {
    label: 'Help & Support',
    icon: 'i-lucide-info',
    to: 'https://github.com/nuxt-ui-templates/dashboard',
    target: '_blank'
  }]
})

// Add onSelect handlers to close mobile drawer on navigation
function addSelectHandler(item: NavigationMenuItem): NavigationMenuItem {
  const result: NavigationMenuItem = { ...item, onSelect: () => { open.value = false } }
  if (item.children) {
    result.children = item.children.map(child => ({ ...child, onSelect: () => { open.value = false } }))
    result.type = 'trigger'
  }
  return result
}

const links = computed<NavigationMenuItem[][]>(() => [
  sidebarConfig.value.primary.map(addSelectHandler),
  sidebarConfig.value.secondary
])

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}, {
  id: 'code',
  label: 'Code',
  items: [{
    id: 'source',
    label: 'View page source',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

const cookieConfig = computed(() => dashboard?.cookieConsent ?? {
  message: 'We use first-party cookies to enhance your experience on our website.',
  acceptLabel: 'Accept',
  optOutLabel: 'Opt out'
})

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: cookieConfig.value.message,
    duration: 0,
    close: false,
    actions: [{
      label: cookieConfig.value.acceptLabel,
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: cookieConfig.value.optOutLabel,
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
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
          <AppLogo class="h-3 w-auto shrink-0" />
          <span v-if="!collapsed" class="font-semibold text-sm truncate">
            {{ useAppConfig().header?.title || 'Dashboard' }}
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
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

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
