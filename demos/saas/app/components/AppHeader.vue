<script setup lang="ts">
const nuxtApp = useNuxtApp()
const { header } = useAppConfig()
const { activeHeadings, updateHeadings } = useScrollspy()

const navigation = computed(() => header?.navigation ?? [
  { label: 'Features', to: '#features' },
  { label: 'Pricing', to: '#pricing' },
  { label: 'Testimonials', to: '#testimonials' }
])

const cta = computed(() => header?.cta ?? { label: 'Download App' })

const items = computed(() => navigation.value.map((item: { label: string, to: string }) => {
  const id = item.to?.replace('#', '')
  // Determine active state based on scrollspy for anchor links
  let active = false
  if (id && item.to?.startsWith('#')) {
    // Use scrollspy logic for anchor links
    const allIds = navigation.value.map((n: { to: string }) => n.to?.replace('#', '')).filter(Boolean)
    const currentIndex = allIds.indexOf(id)
    const nextId = allIds[currentIndex + 1]
    active = activeHeadings.value.includes(id) && (!nextId || !activeHeadings.value.includes(nextId))
  }
  return { ...item, active }
}))

nuxtApp.hooks.hookOnce('page:finish', () => {
  const anchors = navigation.value
    .filter((item: { to: string }) => item.to?.startsWith('#'))
    .map((item: { to: string }) => document.querySelector(item.to))
    .filter(Boolean) as Element[]
  updateHeadings(anchors)
})
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/">
        <AppLogo class="w-auto h-3 shrink-0" />
      </NuxtLink>
    </template>

    <template #right>
      <UNavigationMenu
        :items="items"
        variant="link"
        class="hidden lg:block"
      />

      <UButton
        :label="cta.label"
        :to="cta.to"
        variant="subtle"
        class="hidden lg:block"
      />

      <UColorModeButton />
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />
      <UButton
        class="mt-4"
        :label="cta.label"
        :to="cta.to"
        variant="subtle"
        block
      />
    </template>
  </UHeader>
</template>
