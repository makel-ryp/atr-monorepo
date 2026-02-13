export function formatModelName(modelId: string): string {
  const acronyms = ['gpt'] // words that should be uppercase
  const modelName = modelId.split('/')[1] || modelId

  return modelName
    .split('-')
    .map((word) => {
      const lowerWord = word.toLowerCase()
      return acronyms.includes(lowerWord)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function useModels() {
  const { data: models } = useFetch<string[]>('/api/integrations/models', {
    default: () => [],
  })

  const model = useCookie<string>('model', { default: () => '' })

  // Reset cookie if it's not in the available model list
  watch(models, (available) => {
    if (available.length && (!model.value || !available.includes(model.value))) {
      model.value = available[0]
    }
  }, { immediate: true })

  return {
    models,
    model,
    formatModelName,
  }
}
