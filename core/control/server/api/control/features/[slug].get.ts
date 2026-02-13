import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { slug } = await getValidatedRouterParams(event, z.object({
    slug: z.string()
  }).parse)

  const registry = queryFeatureRegistry(slug)
  const edges = queryFeatureEdges(slug)
  const mappings = queryFileMappings(slug)
  const logs = queryRecentLogs({ slug, limit: 20 })

  const knowledgePath = join(getProjectRoot(), 'core/docs/knowledge', `${slug}.md`)
  const hasKnowledge = existsSync(knowledgePath)

  const reg = registry[0] || null

  const uses = edges.filter(e => e.from_slug === slug && e.edge_type === 'uses')
  const usedBy = edges.filter(e => e.to_slug === slug && e.edge_type === 'uses')
  const contains = edges.filter(e => e.from_slug === slug && e.edge_type === 'contains')
  const containedBy = edges.filter(e => e.to_slug === slug && e.edge_type === 'contains')

  return {
    slug,
    registration: reg ? {
      wrapper_type: reg.wrapper_type,
      invocation_count: reg.invocation_count,
      log_count: reg.log_count,
      first_seen: reg.first_seen,
      last_seen: reg.last_seen
    } : null,
    edges: {
      uses: uses.map(e => e.to_slug),
      usedBy: usedBy.map(e => e.from_slug),
      contains: contains.map(e => e.to_slug),
      containedBy: containedBy.map(e => e.from_slug)
    },
    files: mappings.map(m => ({
      file_path: m.file_path,
      line_start: m.line_start
    })),
    logs,
    knowledge: {
      exists: hasKnowledge,
      path: hasKnowledge ? `core/docs/knowledge/${slug}.md` : null,
      content: hasKnowledge ? readFileSync(knowledgePath, 'utf-8') : null
    }
  }
})
