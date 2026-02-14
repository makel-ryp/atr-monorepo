// SEE: feature "integrations" at core/docs/knowledge/integrations.md
import { createOpenAI } from '@ai-sdk/openai'
import { defu } from 'defu'

const feat = createFeatureScope('integrations')

export interface IntegrationProfile {
  url: string
  key: string
  model: string
  settings?: Record<string, unknown>
}

interface ProfileConfig {
  profiles: Record<string, Partial<IntegrationProfile>>
  models: string[]
}

function getConfig(): ProfileConfig {
  const defaultProfile: Partial<IntegrationProfile> = {
    url: process.env.AI_PROVIDER_URL || '',
    key: process.env.AI_PROVIDER_KEY || '',
    model: process.env.AI_PROVIDER_MODEL || '',
  }

  const models = process.env.AI_PROVIDER_MODELS
    ? process.env.AI_PROVIDER_MODELS.split(',').map(m => m.trim())
    : []

  return {
    profiles: { default: defaultProfile },
    models,
  }
}

export function getProfile(name?: string): IntegrationProfile {
  const config = getConfig()
  const profileName = name || 'default'
  const named = config.profiles[profileName] || {}
  const defaults = config.profiles.default || {}

  const profile = defu(named, defaults) as IntegrationProfile

  if (!profile.url) {
    feat.warn('no AI_PROVIDER_URL configured for profile', profileName)
  }

  return profile
}

export function createModelForId(modelId: string, profileName?: string) {
  const profile = getProfile(profileName)
  feat.log('creating model', modelId, 'via', profileName || 'default', 'at', profile.url)

  const provider = createOpenAI({
    baseURL: profile.url,
    apiKey: profile.key,
  })

  // Use .chat() explicitly — provider() defaults to OpenAI Responses API in v3,
  // which OpenRouter and other OpenAI-compatible proxies don't support.
  return provider.chat(modelId)
}

export function createModel(profileName?: string) {
  const profile = getProfile(profileName)

  if (!profile.model) {
    feat.error('no model configured for profile', profileName || 'default')
    throw new Error(`No model configured for profile "${profileName || 'default'}". Set AI_PROVIDER_MODEL.`)
  }

  return createModelForId(profile.model, profileName)
}

export function listModels(): string[] {
  const config = getConfig()
  const profile = getProfile()

  const models = [...config.models]

  // Include the default model if not already in the list
  if (profile.model && !models.includes(profile.model)) {
    models.unshift(profile.model)
  }

  return models
}

export function listProfiles(): string[] {
  return Object.keys(getConfig().profiles)
}

export function validateIntegrations(): { ok: boolean, issues: string[] } {
  const issues: string[] = []
  const profile = getProfile()

  if (!profile.url) {
    issues.push('AI_PROVIDER_URL is not set')
  }
  if (!profile.key) {
    issues.push('AI_PROVIDER_KEY is not set')
  }
  if (!profile.model) {
    issues.push('AI_PROVIDER_MODEL is not set')
  }

  const models = listModels()
  if (models.length === 0) {
    issues.push('No models configured (set AI_PROVIDER_MODEL and/or AI_PROVIDER_MODELS)')
  }

  return { ok: issues.length === 0, issues }
}
