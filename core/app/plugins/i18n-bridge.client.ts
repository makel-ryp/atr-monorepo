// CONTEXT: i18n-layers — Bridges @nuxtjs/i18n locale selection to Nuxt UI component translations
import * as uiLocales from '@nuxt/ui/locale'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as { locale: Ref<string> }
  const uiLocale = computed(() => (uiLocales as Record<string, any>)[i18n.locale.value] || uiLocales.en)

  useHead({
    htmlAttrs: {
      lang: computed(() => uiLocale.value.code),
      dir: computed(() => uiLocale.value.dir),
    },
  })
})
