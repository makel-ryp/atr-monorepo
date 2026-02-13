import { z } from 'zod'

export default defineMcpTool({
  description: `Retrieves context knowledge for a feature slug.

WHEN TO USE: Use this to understand a concept, feature, or architectural decision before working with related code:
- "Explain the layer cascade system"
- "What is the reasoning behind rate-limiting?"
- "Give me an overview of runtime-config"

INPUT:
- slug: The feature identifier (e.g., "layer-cascade", "rate-limiting")
- aspect: What kind of information you want (optional — omit to get the full knowledge file)

ASPECTS: description (one-liner from frontmatter), overview (5-15 line summary), faq (common questions), reasoning (why this decision), details (full deep-dive), history (how it evolved)

If you don't know what slugs exist, call with any slug and the error will list available ones.
Omit aspect to get the entire knowledge file at once (recommended for full context).`,
  inputSchema: {
    slug: z.string().describe('Feature slug (e.g., "layer-cascade", "runtime-config")'),
    aspect: z.string().optional().describe('Aspect to retrieve: description, overview, faq, reasoning, details, history. Omit for full file.'),
  },
  handler: async ({ slug, aspect }) => {
    if (aspect === 'analysis') {
      return {
        content: [{ type: 'text', text: 'The "analysis" aspect is not yet implemented. It will use MCP sampling to generate on-demand analysis.' }],
        isError: true,
      }
    }

    if (aspect && !VALID_ASPECTS.includes(aspect as any)) {
      return {
        content: [{ type: 'text', text: `Invalid aspect "${aspect}". Valid aspects: ${VALID_ASPECTS.join(', ')}` }],
        isError: true,
      }
    }

    const exists = await slugExists(slug)
    if (!exists) {
      const available = await listSlugs()
      const slugList = available.length > 0
        ? `Available slugs: ${available.join(', ')}`
        : 'No slugs exist yet. Use the record tool to create one.'
      return {
        content: [{ type: 'text', text: `Slug "${slug}" not found. ${slugList}` }],
        isError: true,
      }
    }

    // No aspect specified — return the full file
    if (!aspect) {
      const fullContent = await readKnowledgeFile(slug)
      if (!fullContent) {
        return {
          content: [{ type: 'text', text: `Slug "${slug}" exists but could not be read.` }],
          isError: true,
        }
      }
      logQuery(slug, 'full')
      return {
        content: [{ type: 'text', text: fullContent }],
      }
    }

    // Specific aspect requested
    const result = await readAspect(slug, aspect)
    if (result === null) {
      const available = await listAspects(slug)
      const aspectList = available.length > 0
        ? `Available aspects for "${slug}": ${available.join(', ')}`
        : `Slug "${slug}" exists but has no aspects yet.`
      return {
        content: [{ type: 'text', text: `Aspect "${aspect}" not found for slug "${slug}". ${aspectList}` }],
        isError: true,
      }
    }

    logQuery(slug, aspect)

    return {
      content: [{ type: 'text', text: result }],
    }
  },
})
