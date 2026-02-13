<script setup lang="ts">
const { seo, brand } = useAppConfig()
const colorMode = useColorMode()
const uiLocale = useUiLocale()

const color = computed(() => colorMode.value === 'dark' ? '#171717' : 'white')

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ]
})

useSeoMeta({
  titleTemplate: `%s - ${seo?.siteName || brand?.name || 'App'}`,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp :locale="uiLocale" :toaster="{ expand: false }">
    <AppHeader />

    <UMain>
      <NuxtPage />
    </UMain>

    <AppFooter />
  </UApp>
</template>
