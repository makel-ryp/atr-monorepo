import { createUIMessageStream, createUIMessageStreamResponse, streamText, smoothStream } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'

const SYSTEM_PROMPT = `You are the App Agent Control Plane assistant — an AI developer agent with deep knowledge of this platform.

**Platform Architecture:**
- Nuxt 4 layered monorepo with three-layer cascade: core/ -> organization/ -> apps/*
- Config merging via defu: objects deep-merge, arrays concatenate, primitives override
- Runtime config service (ADR-005) with hot-reloadable settings and $meta.lock governance
- Feature knowledge system with slug-based annotations (// SEE: feature "slug")
- defineFeatureHandler/Composable/Plugin wrappers for tagged instrumentation

**Your Capabilities:**
- Explain architecture decisions and patterns
- Help debug runtime issues using feature logs and registry data
- Guide configuration changes through the settings API
- Advise on extending the platform with new features or apps

**Formatting:**
- Be concise and direct
- Use code blocks for examples
- Reference specific files and line numbers when relevant
- No markdown headings (use **bold** for section labels)`

export default defineEventHandler(async (event) => {
  const { messages, model } = await readValidatedBody(event, z.object({
    messages: z.array(z.custom<UIMessage>()),
    model: z.string()
  }).parse)

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: createModelForId(model),
        system: SYSTEM_PROMPT,
        messages,
        experimental_transform: smoothStream({ chunking: 'word' })
      })

      writer.merge(result.toUIMessageStream({
        sendReasoning: true
      }))
    }
  })

  return createUIMessageStreamResponse({ stream })
})
