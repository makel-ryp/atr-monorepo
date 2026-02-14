export function formatModelName(modelId: string): string {
  const acronyms = ['gpt']
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
    default: () => []
  })

  const model = useCookie<string>('control-model', { default: () => '' })

  watch(models, (available) => {
    if (available.length && (!model.value || !available.includes(model.value))) {
      model.value = available[0]
    }
  }, { immediate: true })

  return {
    models,
    model,
    formatModelName
  }
}
