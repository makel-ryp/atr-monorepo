---
title: AI Integrations
description: Core platform feature for managing OpenAI-compatible AI providers with profile-based configuration.
---

## Overview

The `integrations` feature provides a unified interface for AI model access across the platform. All providers that implement the OpenAI chat completions shape (OpenRouter, Cerebras, Ollama, etc.) work through a single `@ai-sdk/openai` instance with configurable `baseURL` and `apiKey`.

AI is a core platform capability — `ai` and `@ai-sdk/openai` live in `core/package.json` so any app extending core can use `streamText()`/`generateText()` + integrations out of the box.

## Details

> **Status**: Implemented
> **Created**: 2026-02-12
> **Purpose**: Unified AI provider management for the platform

---

### Architecture

- **Module**: `core/server/utils/integrations.ts` — auto-imported by Nitro
- **Startup plugin**: `core/server/plugins/04.integrations.ts` — validates config at boot
- **API**: `GET /api/integrations/models` — returns available model IDs (no secrets)

### Configuration

All config via environment variables (not `runtimeConfig` — these are read via `process.env`):

| Variable | Description | Example |
|----------|-------------|---------|
| `AI_PROVIDER_URL` | OpenAI-compatible base URL | `https://openrouter.ai/api/v1` |
| `AI_PROVIDER_KEY` | API key for the provider | `sk-or-...` |
| `AI_PROVIDER_MODEL` | Default model ID | `anthropic/claude-haiku-4.5` |
| `AI_PROVIDER_MODELS` | Comma-separated available models | `anthropic/claude-haiku-4.5,openai/gpt-4o-mini` |

### Profiles

The profile system supports named configurations (currently only `default` from env vars). Future: config service integration for runtime profile management.

- `getProfile(name?)` — resolve a named profile, merges onto default via `defu`
- `createModel(profileName?)` — returns AI SDK `LanguageModel` using profile's default model
- `createModelForId(modelId, profileName?)` — returns model for a specific ID using profile's url/key

### Usage in Server Routes

```typescript
import { createModelForId, createModel } from '#imports'

// Use default profile's model
const result = await generateText({ model: createModel() })

// Use a specific model ID with default profile's credentials
const result = await streamText({ model: createModelForId('openai/gpt-4o-mini') })
```

## FAQ

**Why not use `@ai-sdk/gateway`?**
Gateway requires a Vercel-specific API key and hosted infrastructure. OpenRouter (and similar aggregators) provide the same multi-provider access via standard OpenAI-compatible endpoints, giving us vendor independence.

**Why `process.env` instead of `runtimeConfig`?**
Same pattern as the config service datasource credentials (ADR-005). These are provisioning-level secrets — they don't change at runtime and shouldn't be in the Nuxt config object.

**Can I use Ollama for local development?**
Yes. Set `AI_PROVIDER_URL=http://localhost:11434/v1`, leave `AI_PROVIDER_KEY` empty, and set `AI_PROVIDER_MODEL` to your local model name.

## Reasoning

OpenRouter was chosen as the default aggregator because it exposes 200+ models through a single OpenAI-compatible endpoint. The profile abstraction exists for future multi-provider scenarios (e.g., fast model for title generation, powerful model for chat) without changing consumer code.
