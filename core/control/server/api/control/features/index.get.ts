import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(() => {
  const registry = queryFeatureRegistry()
  const edges = queryFeatureEdges()
  const mappings = queryFileMappings()

  const knowledgeDir = join(getProjectRoot(), 'core/docs/knowledge')

  const features = registry.map((reg) => {
    const featureEdges = edges.filter(e => e.from_slug === reg.slug || e.to_slug === reg.slug)
    const featureFiles = mappings.filter(m => m.slug === reg.slug)
    const hasKnowledge = existsSync(join(knowledgeDir, `${reg.slug}.md`))

    return {
      slug: reg.slug,
      wrapper_type: reg.wrapper_type,
      first_seen: reg.first_seen,
      last_seen: reg.last_seen,
      invocation_count: reg.invocation_count,
      log_count: reg.log_count,
      edge_count: featureEdges.length,
      file_count: featureFiles.length,
      has_knowledge: hasKnowledge
    }
  })

  // Also include slugs from mappings not in registry
  const registrySlugs = new Set(registry.map(r => r.slug))
  const mappingSlugs = [...new Set(mappings.map(m => m.slug))].filter(s => !registrySlugs.has(s))

  for (const slug of mappingSlugs) {
    const featureEdges = edges.filter(e => e.from_slug === slug || e.to_slug === slug)
    const featureFiles = mappings.filter(m => m.slug === slug)
    const hasKnowledge = existsSync(join(knowledgeDir, `${slug}.md`))

    features.push({
      slug,
      wrapper_type: 'annotation-only',
      first_seen: '',
      last_seen: '',
      invocation_count: 0,
      log_count: 0,
      edge_count: featureEdges.length,
      file_count: featureFiles.length,
      has_knowledge: hasKnowledge
    })
  }

  features.sort((a, b) => a.slug.localeCompare(b.slug))

  return {
    total: features.length,
    totalEdges: edges.length,
    totalFiles: mappings.length,
    features
  }
})
