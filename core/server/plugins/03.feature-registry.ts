// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { scanProject } from '../utils/see-scanner'

export default defineFeaturePlugin('feature-registry', async (feat, nitroApp) => {
  if (!import.meta.dev) return

  feat.log('Feature registry persistence active (write-through)')

  // Run SEE scanner on startup
  try {
    const root = process.cwd()
    const annotations = await scanProject(root)
    if (annotations.length > 0) {
      syncFileMappings(annotations)
      const uniqueFiles = new Set(annotations.map(a => a.filePath))
      feat.log(`SEE scanner: found ${annotations.length} annotations across ${uniqueFiles.size} files`)
    }
    else {
      feat.log('SEE scanner: no annotations found')
    }
  }
  catch {
    feat.warn('SEE scanner failed — file mappings will not be populated')
  }

  // Features and edges write-through on registration (in feature-registry.ts).
  // Only invocation/log counts need a final flush — they update too frequently for per-call DB writes.
  nitroApp.hooks.hook('close', () => {
    try {
      const counts = getCounts()
      if (counts.length > 0) {
        syncCountsToDb(counts)
        feat.log(`Final count flush: ${counts.length} features`)
      }
    }
    catch {
      // Silent — persistence is optional
    }
  })
})
