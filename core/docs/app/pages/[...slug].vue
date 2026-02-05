<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageHeadline } from '@nuxt/content/utils'

definePageMeta({
  layout: 'docs'
})

const route = useRoute()
const { toc } = useAppConfig()
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

// Query all collections to find the page (upstream docs, customer internal, customer top-level)
const { data: page, data: pageCollection } = await useAsyncData(route.path, async () => {
  // Try upstream docs first
  let result = await queryCollection('docs').path(route.path).first()
  if (result) return { page: result, collection: 'docs' as const }

  // Try customer internal docs (merged into /internal/)
  result = await queryCollection('customerInternal').path(route.path).first()
  if (result) return { page: result, collection: 'customerInternal' as const }

  // Try customer top-level docs
  result = await queryCollection('customerDocs').path(route.path).first()
  if (result) return { page: result, collection: 'customerDocs' as const }

  return null
})

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const foundPage = computed(() => page.value?.page)
const foundCollection = computed(() => page.value?.collection || 'docs')

const { data: surround } = await useAsyncData(`${route.path}-surround`, async () => {
  return queryCollectionItemSurroundings(foundCollection.value, route.path, {
    fields: ['description']
  })
})

const title = foundPage.value?.seo?.title || foundPage.value?.title
const description = foundPage.value?.seo?.description || foundPage.value?.description

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description
})

const headline = computed(() => findPageHeadline(navigation?.value, foundPage.value?.path))

defineOgImageComponent('Docs', {
  headline: headline.value
})

const links = computed(() => {
  const links = []
  if (toc?.bottom?.edit) {
    links.push({
      icon: 'i-lucide-external-link',
      label: 'Edit this page',
      to: `${toc.bottom.edit}/${foundPage.value?.stem}.${foundPage.value?.extension}`,
      target: '_blank'
    })
  }

  return [...links, ...(toc?.bottom?.links || [])].filter(Boolean)
})
</script>

<template>
  <UPage v-if="foundPage">
    <UPageHeader
      :title="foundPage.title"
      :description="foundPage.description"
      :headline="headline"
    >
      <template #links>
        <UButton
          v-for="(link, index) in foundPage.links"
          :key="index"
          v-bind="link"
        />

        <PageHeaderLinks />
      </template>
    </UPageHeader>

    <UPageBody>
      <ContentRenderer
        v-if="foundPage"
        :value="foundPage"
      />

      <USeparator v-if="surround?.length" />

      <UContentSurround :surround="surround" />
    </UPageBody>

    <template
      v-if="foundPage?.body?.toc?.links?.length"
      #right
    >
      <UContentToc
        :title="toc?.title"
        :links="foundPage.body?.toc?.links"
      >
        <template
          v-if="toc?.bottom"
          #bottom
        >
          <div
            class="hidden lg:block space-y-6"
            :class="{ '!mt-6': foundPage.body?.toc?.links?.length }"
          >
            <USeparator
              v-if="foundPage.body?.toc?.links?.length"
              type="dashed"
            />

            <UPageLinks
              :title="toc.bottom.title"
              :links="links"
            />
          </div>
        </template>
      </UContentToc>
    </template>
  </UPage>
</template>
