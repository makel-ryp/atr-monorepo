// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const SEE_PATTERN = /\/\/\s*SEE:\s*feature\s+"([^"]+)"/g

const IGNORED_DIRS = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  'dist',
  '.git',
  'coverage',
])

export interface SeeAnnotation {
  slug: string
  filePath: string
  lineNumber: number
}

export async function scanDirectory(dir: string, root: string): Promise<SeeAnnotation[]> {
  const results: SeeAnnotation[] = []

  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return results
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      const nested = await scanDirectory(fullPath, root)
      results.push(...nested)
    }
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.vue')) {
      try {
        const content = await readFile(fullPath, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          SEE_PATTERN.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = SEE_PATTERN.exec(lines[i])) !== null) {
            results.push({
              slug: match[1],
              filePath: relative(root, fullPath).replace(/\\/g, '/'),
              lineNumber: i + 1,
            })
          }
        }
      }
      catch {
        // Skip unreadable files
      }
    }
  }

  return results
}

export async function scanProject(root: string): Promise<SeeAnnotation[]> {
  return scanDirectory(root, root)
}
