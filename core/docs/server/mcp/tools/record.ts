import { z } from 'zod'

export default defineMcpTool({
  description: `Records or updates knowledge for a feature slug.

WHEN TO USE: Use this to capture knowledge during work sessions:
- After making an architectural decision: record the reasoning
- After discovering how something works: record an overview
- When a concept needs documentation: record a description
- To mark knowledge as stale: record with aspect "stale"

INPUT:
- slug: Feature identifier in kebab-case (e.g., "layer-cascade")
- aspect: What kind of knowledge to write (description, overview, faq, reasoning, details, history)
- content: The full markdown content to write

The content REPLACES the existing aspect file entirely. If you need to merge with existing content, use the explain tool first to read the current content.

SPECIAL: Use aspect "stale" to mark a slug's knowledge as potentially outdated without modifying any files.`,
  inputSchema: {
    slug: z.string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, numbers, hyphens)')
      .describe('Feature slug in kebab-case (e.g., "layer-cascade", "runtime-config")'),
    aspect: z.string().describe('Aspect to write: description, overview, faq, reasoning, details, history, or "stale" to mark as outdated'),
    content: z.string().describe('Full markdown content for the aspect file (replaces existing content)'),
  },
  handler: async ({ slug, aspect, content }) => {
    if (aspect === 'stale') {
      logChange(slug, 'stale', 'stale')
      return {
        content: [{ type: 'text', text: `Marked "${slug}" as stale in context.db.` }],
      }
    }

    if (aspect === 'analysis') {
      return {
        content: [{ type: 'text', text: 'Cannot write the "analysis" aspect directly. It will be generated via MCP sampling.' }],
        isError: true,
      }
    }

    if (!VALID_ASPECTS.includes(aspect as any)) {
      return {
        content: [{ type: 'text', text: `Invalid aspect "${aspect}". Valid aspects: ${VALID_ASPECTS.join(', ')}` }],
        isError: true,
      }
    }

    const isNewSlug = !(await slugExists(slug))
    const existingContent = await readAspect(slug, aspect)
    const changeType = existingContent === null ? 'created' : 'updated'

    try {
      await writeAspect(slug, aspect, content)
    }
    catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to write ${slug}/${aspect}.md: ${error}` }],
        isError: true,
      }
    }

    logChange(slug, aspect, changeType)

    const label = isNewSlug ? '(new slug)' : changeType === 'created' ? '(new aspect)' : '(updated)'
    return {
      content: [{ type: 'text', text: `${changeType === 'created' ? 'Created' : 'Updated'} ${slug}/${aspect}.md ${label}` }],
    }
  },
})
