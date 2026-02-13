import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, smoothStream, tool, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const SYSTEM_PROMPT = `You are the App Agent Control Plane assistant — an AI developer agent with deep knowledge of this platform.

**Platform Architecture:**
- Nuxt 4 layered monorepo with three-layer cascade: core/ -> organization/ -> apps/*
- Config merging via defu: objects deep-merge, arrays concatenate, primitives override
- Runtime config service (ADR-005) with hot-reloadable settings and $meta.lock governance
- Feature knowledge system with slug-based annotations (// SEE: feature "slug")
- defineFeatureHandler/Composable/Plugin wrappers for tagged instrumentation

**Your Capabilities:**
- Use your tools to query the live system — features, logs, knowledge, and settings
- Explain architecture decisions and patterns
- Help debug runtime issues using feature logs and registry data
- Guide configuration changes through the settings API
- Advise on extending the platform with new features or apps

**Tool Usage:**
- When asked about features, use listFeatures or getFeatureDetail
- When asked about errors or debugging, use queryLogs or getLogSummary
- When asked about a feature's design or documentation, use readKnowledge
- Prefer tool results over your static knowledge — the system state is live

**Formatting:**
- Be concise and direct
- Use code blocks for examples
- Reference specific files and line numbers when relevant
- No markdown headings (use **bold** for section labels)`

const tools = {
  listFeatures: tool({
    description: 'List all registered features with their stats (invocation count, log count, wrapper type)',
    parameters: z.object({}),
    execute: async () => {
      const features = queryFeatureRegistry()
      const edges = queryFeatureEdges()
      const files = queryFileMappings()
      return {
        total: features.length,
        features: features.map(f => ({
          slug: f.slug,
          wrapper_type: f.wrapper_type,
          invocation_count: f.invocation_count,
          log_count: f.log_count,
          last_seen: f.last_seen,
          edge_count: edges.filter(e => e.from_slug === f.slug || e.to_slug === f.slug).length,
          file_count: files.filter(m => m.slug === f.slug).length
        }))
      }
    }
  }),

  getFeatureDetail: tool({
    description: 'Get detailed information about a specific feature including its files, dependencies, and recent logs',
    parameters: z.object({
      slug: z.string().describe('The feature slug to look up')
    }),
    execute: async ({ slug }) => {
      const registry = queryFeatureRegistry(slug)
      const edges = queryFeatureEdges(slug)
      const mappings = queryFileMappings(slug)
      const logs = queryRecentLogs({ slug, limit: 10 })

      const knowledgePath = join(getProjectRoot(), 'core/docs/knowledge', `${slug}.md`)
      const hasKnowledge = existsSync(knowledgePath)

      return {
        slug,
        registration: registry[0] || null,
        edges: {
          uses: edges.filter(e => e.from_slug === slug && e.edge_type === 'uses').map(e => e.to_slug),
          usedBy: edges.filter(e => e.to_slug === slug && e.edge_type === 'uses').map(e => e.from_slug),
          contains: edges.filter(e => e.from_slug === slug && e.edge_type === 'contains').map(e => e.to_slug),
          containedBy: edges.filter(e => e.to_slug === slug && e.edge_type === 'contains').map(e => e.from_slug)
        },
        files: mappings,
        recentLogs: logs,
        hasKnowledge
      }
    }
  }),

  queryLogs: tool({
    description: 'Query recent logs with optional filters by feature slug, level (log/warn/error), and time range',
    parameters: z.object({
      slug: z.string().optional().describe('Filter by feature slug'),
      level: z.enum(['log', 'warn', 'error']).optional().describe('Filter by log level'),
      since: z.string().optional().describe('Time range like "1 hour", "30 minutes", "24 hours"'),
      limit: z.number().optional().describe('Max results (default 20)')
    }),
    execute: async ({ slug, level, since, limit }) => {
      return queryRecentLogs({ slug, level, since, limit: limit ?? 20 })
    }
  }),

  getLogSummary: tool({
    description: 'Get a summary of logs: total count, breakdown by feature and level, recent errors',
    parameters: z.object({
      since: z.string().optional().describe('Time range like "1 hour", "24 hours"')
    }),
    execute: async ({ since }) => {
      return getLogSummary(since)
    }
  }),

  readKnowledge: tool({
    description: 'Read the knowledge documentation file for a feature slug. Returns the full markdown content.',
    parameters: z.object({
      slug: z.string().describe('The feature slug to read knowledge for')
    }),
    execute: async ({ slug }) => {
      const knowledgePath = join(getProjectRoot(), 'core/docs/knowledge', `${slug}.md`)
      if (!existsSync(knowledgePath)) {
        return { exists: false, content: null, availableSlugs: listKnowledgeSlugs() }
      }
      return { exists: true, content: readFileSync(knowledgePath, 'utf-8') }
    }
  })
}

function listKnowledgeSlugs(): string[] {
  const dir = join(getProjectRoot(), 'core/docs/knowledge')
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''))
  }
  catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const { messages, model } = await readValidatedBody(event, z.object({
    messages: z.array(z.custom<UIMessage>()),
    model: z.string()
  }).parse)

  const modelMessages = await convertToModelMessages(messages)

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: createModelForId(model),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
        experimental_transform: smoothStream({ chunking: 'word' })
      })

      writer.merge(result.toUIMessageStream({
        sendReasoning: true
      }))
    }
  })

  return createUIMessageStreamResponse({ stream })
})
