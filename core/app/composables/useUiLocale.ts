// SEE: feature "i18n-layers" at core/docs/knowledge/i18n-layers.md
import * as uiLocales from '@nuxt/ui/locale'

export const useUiLocale = defineFeatureComposable('i18n-layers', (_feat) => {
  const i18n = useNuxtApp().$i18n as { locale: Ref<string> }
  return computed(() => (uiLocales as Record<string, any>)[i18n.locale.value] || uiLocales.en)
})
