import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'

interface FileNode {
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.nuxt',
  '.output',
  '.git',
  '.data',
  'dist'
]

async function buildFileTree(dir: string, depth: number = 0, maxDepth: number = 4): Promise<FileNode[]> {
  if (depth >= maxDepth) return []

  const nodes: FileNode[] = []

  try {
    const entries = await readdir(dir)

    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.env.example') continue
      if (IGNORE_PATTERNS.includes(entry)) continue

      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        const children = await buildFileTree(fullPath, depth + 1, maxDepth)
        nodes.push({
          name: entry,
          type: 'directory',
          children
        })
      } else {
        nodes.push({
          name: entry,
          type: 'file'
        })
      }
    }
  } catch {
    // Permission denied or other error
  }

  return nodes.sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function formatTree(nodes: FileNode[], indent: string = ''): string {
  let result = ''

  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1
    const prefix = isLast ? '└── ' : '├── '
    const childIndent = indent + (isLast ? '    ' : '│   ')

    result += `${indent}${prefix}${node.name}${node.type === 'directory' ? '/' : ''}\n`

    if (node.children && node.children.length > 0) {
      result += formatTree(node.children, childIndent)
    }
  })

  return result
}

export default defineMcpTool({
  description: `Gets the file structure of a specific app or demo.

WHEN TO USE: Use this tool to understand how an app is organized:
- "Show me the structure of the dashboard demo"
- "What files are in my-app?"
- "How is the saas demo organized?"

INPUT: Provide the app name (e.g., "dashboard", "saas", "my-app")
The tool will look in both /apps/ and /demos/ directories.

OUTPUT: Returns a tree view of the app's file structure, excluding:
- node_modules, .nuxt, .output, .git, .data, dist`,
  parameters: z.object({
    appName: z.string().describe('The name of the app or demo (e.g., "dashboard", "saas", "my-app")')
  }),
  handler: async ({ appName }) => {
    const rootDir = join(process.cwd(), '../..')

    // Try demos first, then apps
    let appPath = join(rootDir, 'demos', appName)
    let appType = 'demo'

    try {
      await stat(appPath)
    } catch {
      appPath = join(rootDir, 'apps', appName)
      appType = 'app'

      try {
        await stat(appPath)
      } catch {
        return {
          content: [{ type: 'text', text: `App "${appName}" not found in /apps/ or /demos/` }],
          isError: true
        }
      }
    }

    try {
      const tree = await buildFileTree(appPath)
      const treeStr = formatTree(tree)

      const result = `# ${appName} (${appType})

\`\`\`
${appName}/
${treeStr}\`\`\`
`

      return {
        content: [{ type: 'text', text: result }]
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to get structure: ${error}` }],
        isError: true
      }
    }
  }
})
