// SEE: feature "integrations" at core/docs/knowledge/integrations.md
export default defineFeaturePlugin('integrations', (feat) => {
  const { ok, issues } = validateIntegrations()

  if (ok) {
    const models = listModels()
    feat.log('ready —', models.length, 'model(s):', models.join(', '))
  }
  else {
    for (const issue of issues) {
      feat.warn(issue)
    }
    feat.warn('AI integrations not fully configured — chat features will not work')
  }
})
