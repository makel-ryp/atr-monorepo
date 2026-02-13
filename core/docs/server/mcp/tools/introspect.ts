// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { z } from 'zod'

export default defineMcpTool({
  description: `Returns a complete profile for a feature slug by querying the runtime feature registry.

WHEN TO USE: Use this to understand what a feature actually does at runtime:
- "What files implement rate-limiting?"
- "What does rate-limiting depend on?"
- "Is rate-limiting documented?"

This queries the feature_registry, feature_edges, and file_mappings tables in knowledge.db,
plus checks for the existence of a knowledge file.

INPUT:
- slug: The feature identifier (e.g., "rate-limiting", "runtime-config")

OUTPUT: Registration info (wrapper type, invocation count, log count), dependency edges,
file mappings, and knowledge file status.`,
  inputSchema: {
    slug: z.string().describe('Feature slug to introspect (e.g., "rate-limiting")'),
  },
  handler: async ({ slug }) => {
    const registry = queryFeatureRegistry(slug)
    const edges = queryFeatureEdges(slug)
    const mappings = queryFileMappings(slug)

    const lines: string[] = []
    lines.push(`# Feature: ${slug}`)
    lines.push('')

    // Registration
    if (registry.length > 0) {
      const reg = registry[0]
      lines.push(`## Registration`)
      lines.push(`- Wrapper type: ${reg.wrapper_type}`)
      lines.push(`- Invocations: ${reg.invocation_count}`)
      lines.push(`- Log entries: ${reg.log_count}`)
      lines.push(`- First seen: ${reg.first_seen}`)
      lines.push(`- Last seen: ${reg.last_seen}`)
    }
    else {
      lines.push(`## Registration`)
      lines.push(`Not found in feature registry. The feature may not have been executed in dev mode yet.`)
    }
    lines.push('')

    // Dependencies
    const uses = edges.filter(e => e.from_slug === slug && e.edge_type === 'uses')
    const usedBy = edges.filter(e => e.to_slug === slug && e.edge_type === 'uses')
    const contains = edges.filter(e => e.from_slug === slug && e.edge_type === 'contains')
    const containedBy = edges.filter(e => e.to_slug === slug && e.edge_type === 'contains')

    lines.push(`## Dependencies`)
    if (uses.length > 0) {
      lines.push(`- Uses: ${uses.map(e => e.to_slug).join(', ')}`)
    }
    if (usedBy.length > 0) {
      lines.push(`- Used by: ${usedBy.map(e => e.from_slug).join(', ')}`)
    }
    if (contains.length > 0) {
      lines.push(`- Contains: ${contains.map(e => e.to_slug).join(', ')}`)
    }
    if (containedBy.length > 0) {
      lines.push(`- Contained by: ${containedBy.map(e => e.from_slug).join(', ')}`)
    }
    if (uses.length === 0 && usedBy.length === 0 && contains.length === 0 && containedBy.length === 0) {
      lines.push(`No dependency edges found.`)
    }
    lines.push('')

    // File mappings
    lines.push(`## File Mappings`)
    if (mappings.length > 0) {
      for (const m of mappings) {
        const loc = m.line_start ? `${m.file_path}:${m.line_start}` : m.file_path
        lines.push(`- ${loc}`)
      }
    }
    else {
      lines.push(`No file mappings found. Run the SEE scanner or add \`// SEE: feature "${slug}"\` annotations.`)
    }
    lines.push('')

    // Knowledge status
    const knowledgeExists = await slugExists(slug)
    lines.push(`## Knowledge`)
    if (knowledgeExists) {
      const aspects = await listAspects(slug)
      const allAspects = ['description', 'overview', 'faq', 'reasoning', 'details', 'history']
      const present = allAspects.filter(a => aspects.includes(a))
      const missing = allAspects.filter(a => !aspects.includes(a))
      lines.push(`- Status: ${present.length}/${allAspects.length} aspects present`)
      if (present.length > 0) lines.push(`- Present: ${present.join(', ')}`)
      if (missing.length > 0) lines.push(`- Missing: ${missing.join(', ')}`)
    }
    else {
      lines.push(`No knowledge file found at core/docs/knowledge/${slug}.md`)
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    }
  },
})
