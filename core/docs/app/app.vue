<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
const { seo } = useAppConfig()
const uiLocale = useUiLocale()

// Merge navigation from all collections (upstream docs + customer docs)
const { data: navigation } = await useAsyncData('navigation', async () => {
  const [docsNav, customerInternalNav, customerDocsNav] = await Promise.all([
    queryCollectionNavigation('docs'),
    queryCollectionNavigation('customerInternal').catch(() => []),
    queryCollectionNavigation('customerDocs').catch(() => [])
  ])

  // Merge customer internal docs into the internal section of docs nav
  const mergedNav = [...(docsNav || [])] as ContentNavigationItem[]

  // Find the internal section and merge customer internal docs into it
  if (customerInternalNav?.length) {
    const internalSection = mergedNav.find(item => item.path === '/internal')
    if (internalSection && internalSection.children) {
      internalSection.children = [...internalSection.children, ...customerInternalNav]
    }
  }

  // Add customer top-level docs as new sections
  if (customerDocsNav?.length) {
    mergedNav.push(...customerDocsNav)
  }

  return mergedNav
})

// Merge search sections from all collections
const { data: files } = useLazyAsyncData('search', async () => {
  const [docsFiles, customerInternalFiles, customerDocsFiles] = await Promise.all([
    queryCollectionSearchSections('docs'),
    queryCollectionSearchSections('customerInternal').catch(() => []),
    queryCollectionSearchSections('customerDocs').catch(() => [])
  ])
  return [...(docsFiles || []), ...(customerInternalFiles || []), ...(customerDocsFiles || [])]
}, {
  server: false
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ]
})

useSeoMeta({
  titleTemplate: `%s - ${seo?.siteName}`,
  ogSiteName: seo?.siteName,
  twitterCard: 'summary_large_image'
})

provide('navigation', navigation)
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator />

    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
      />
    </ClientOnly>
  </UApp>
</template>
