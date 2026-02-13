<script setup lang="ts">
import { en } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const _uiLocale = useUiLocale()
const uiLocale = computed(() => _uiLocale.value || en)

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ]
})

useSeoMeta({
  title: 'Control Plane',
  description: 'App Agent runtime management and developer tools',
  ogTitle: 'Control Plane',
  ogDescription: 'App Agent runtime management and developer tools'
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
