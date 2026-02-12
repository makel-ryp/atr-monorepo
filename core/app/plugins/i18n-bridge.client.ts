// SEE: feature "i18n-layers" at core/docs/knowledge/i18n-layers.md

export default defineNuxtPlugin(() => {
  const uiLocale = useUiLocale()

  useHead({
    htmlAttrs: {
      lang: computed(() => uiLocale.value.code),
      dir: computed(() => uiLocale.value.dir),
    },
  })
})
