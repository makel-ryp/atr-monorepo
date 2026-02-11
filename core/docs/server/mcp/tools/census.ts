// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export default defineMcpTool({
  description: `Returns a feature coverage report for the codebase.

WHEN TO USE: Use this to understand the health and completeness of the feature system:
- "How complete is the feature coverage?"
- "Which files are untagged?"
- "Which features are undocumented?"
- "Are there orphaned features?"

INPUT:
- scope: Filter the report (optional). Values:
  - "all" (default) — full coverage report
  - "untagged" — files with no // SEE: annotation
  - "undocumented" — features with no knowledge file
  - "orphaned" — knowledge files with no code references

OUTPUT: Coverage summary with per-feature scoring.`,
  inputSchema: {
    scope: z.enum(['all', 'untagged', 'undocumented', 'orphaned']).optional()
      .describe('Report scope: all, untagged, undocumented, orphaned. Defaults to all.'),
  },
  handler: async ({ scope = 'all' }) => {
    const registry = queryFeatureRegistry()
    const allEdges = queryFeatureEdges()
    const allMappings = queryFileMappings()
    const knowledgeSlugs = await listSlugs()

    const lines: string[] = []

    // Collect all known slugs from all sources
    const allSlugs = new Set<string>()
    for (const r of registry) allSlugs.add(r.slug)
    for (const m of allMappings) allSlugs.add(m.slug)
    for (const s of knowledgeSlugs) allSlugs.add(s)

    const slugList = Array.from(allSlugs).sort()

    if (scope === 'undocumented') {
      const undocumented = slugList.filter(s => !knowledgeSlugs.includes(s))
      lines.push(`## Undocumented Features`)
      lines.push(`Features with runtime or annotation references but no knowledge file.`)
      lines.push('')
      if (undocumented.length === 0) {
        lines.push('All known features have knowledge files.')
      }
      else {
        for (const s of undocumented) {
          lines.push(`- ${s}`)
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }

    if (scope === 'orphaned') {
      const orphaned = knowledgeSlugs.filter(s => {
        const hasMappings = allMappings.some(m => m.slug === s)
        const hasRegistry = registry.some(r => r.slug === s)
        return !hasMappings && !hasRegistry
      })
      lines.push(`## Orphaned Features`)
      lines.push(`Knowledge files with no code references or registry entries.`)
      lines.push('')
      if (orphaned.length === 0) {
        lines.push('No orphaned features found.')
      }
      else {
        for (const s of orphaned) {
          lines.push(`- ${s} (knowledge file exists, no code references)`)
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }

    if (scope === 'untagged') {
      // Find all .ts files that have mappings vs those that don't
      const taggedFiles = new Set(allMappings.map(m => m.file_path))
      lines.push(`## Untagged Files`)
      lines.push(`Files tracked in file_mappings: ${taggedFiles.size}`)
      lines.push('')
      lines.push(`To find specific untagged files, run the SEE scanner and compare against the full file list.`)
      lines.push(`Tagged files can be viewed with introspect(slug) for each feature.`)
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }

    // scope === 'all' — full report
    lines.push(`# Feature Census`)
    lines.push('')
    lines.push(`**Features:** ${slugList.length} total`)
    lines.push(`**File mappings:** ${allMappings.length} total`)
    lines.push(`**Edges:** ${allEdges.length} total`)
    lines.push('')

    const allAspects = ['description', 'overview', 'faq', 'reasoning', 'details', 'history']

    lines.push(`| Feature | Knowledge | Files | Wrappers | Deps | Score |`)
    lines.push(`|---------|-----------|-------|----------|------|-------|`)

    for (const slug of slugList) {
      const reg = registry.find(r => r.slug === slug)
      const mappings = allMappings.filter(m => m.slug === slug)
      const uses = allEdges.filter(e => e.from_slug === slug && e.edge_type === 'uses')
      const hasKnowledge = knowledgeSlugs.includes(slug)

      let knowledgeScore = 0
      if (hasKnowledge) {
        const aspects = await listAspects(slug)
        knowledgeScore = aspects.length
      }

      // Simple scoring: knowledge (max 6) + files (1 if any) + wrapper (1 if any) = max 8
      let score = 0
      score += knowledgeScore
      if (mappings.length > 0) score += 1
      if (reg) score += 1
      const pct = Math.round((score / 8) * 100)

      const knowledgeStr = hasKnowledge ? `${knowledgeScore}/${allAspects.length}` : '0/6'
      const filesStr = `${mappings.length} files`
      const wrapperStr = reg ? reg.wrapper_type : '-'
      const depsStr = `${uses.length} deps`

      lines.push(`| ${slug} | ${knowledgeStr} | ${filesStr} | ${wrapperStr} | ${depsStr} | ${pct}% |`)
    }

    // Orphaned features
    const orphaned = knowledgeSlugs.filter(s => {
      const hasMappings = allMappings.some(m => m.slug === s)
      const hasRegistry = registry.some(r => r.slug === s)
      return !hasMappings && !hasRegistry
    })

    if (orphaned.length > 0) {
      lines.push('')
      lines.push(`## Orphaned Features`)
      for (const s of orphaned) {
        lines.push(`- ${s}`)
      }
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    }
  },
})
