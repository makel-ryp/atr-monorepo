// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { scanProject } from '../utils/see-scanner'

export default defineFeaturePlugin('feature-registry', async (feat, nitroApp) => {
  if (!import.meta.dev) return

  feat.log('Feature registry persistence active')

  const FLUSH_INTERVAL_MS = 30_000

  function flush() {
    try {
      const { features, edges } = getRegistry()
      if (features.length === 0 && edges.length === 0) return
      syncRegistryToDb(features, edges)
      feat.log(`Flushed ${features.length} features, ${edges.length} edges to knowledge.db`)
    }
    catch {
      // Silent — persistence is optional
    }
  }

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

  const timer = setInterval(flush, FLUSH_INTERVAL_MS)

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
    flush()
    feat.log('Final registry flush complete')
  })
})
