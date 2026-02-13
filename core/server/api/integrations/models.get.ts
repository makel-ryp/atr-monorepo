// SEE: feature "integrations" at core/docs/knowledge/integrations.md
export default defineFeatureHandler('integrations', (feat) => {
  const models = listModels()
  feat.log('listing', models.length, 'model(s)')
  return models
})
