import { readdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { z } from 'zod'

interface ComponentInfo {
  name: string
  path: string
  type: 'component' | 'composable' | 'page' | 'layout' | 'api'
}

async function scanDirectory(dir: string, type: ComponentInfo['type']): Promise<ComponentInfo[]> {
  const items: ComponentInfo[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subItems = await scanDirectory(fullPath, type)
        items.push(...subItems)
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (['.vue', '.ts', '.js'].includes(ext)) {
          items.push({
            name: basename(entry.name, ext),
            path: fullPath.replace(/\\/g, '/'),
            type
          })
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return items
}

export default defineMcpTool({
  description: `Lists components, composables, pages, layouts, and API routes in an app.

WHEN TO USE: Use this tool to discover what code exists in an app:
- "What components does the dashboard have?"
- "List all pages in my-app"
- "Show me the composables in the saas demo"
- "What API routes are in dashboard?"

INPUT: Provide the app name and optionally filter by type.

OUTPUT: Returns lists of:
- components: Vue components in app/components/
- composables: Composables in app/composables/
- pages: Pages in app/pages/
- layouts: Layouts in app/layouts/
- api: API routes in server/api/`,
  parameters: z.object({
    appName: z.string().describe('The name of the app or demo'),
    type: z.enum(['all', 'components', 'composables', 'pages', 'layouts', 'api'])
      .optional()
      .default('all')
      .describe('Filter by type (default: all)')
  }),
  handler: async ({ appName, type }) => {
    const rootDir = join(process.cwd(), '../..')

    // Find the app
    let appPath = join(rootDir, 'demos', appName)
    try {
      await stat(appPath)
    } catch {
      appPath = join(rootDir, 'apps', appName)
      try {
        await stat(appPath)
      } catch {
        return {
          content: [{ type: 'text', text: `App "${appName}" not found` }],
          isError: true
        }
      }
    }

    const result: Record<string, ComponentInfo[]> = {}

    const scanTypes: Array<{ key: string, dir: string, type: ComponentInfo['type'] }> = [
      { key: 'components', dir: 'app/components', type: 'component' },
      { key: 'composables', dir: 'app/composables', type: 'composable' },
      { key: 'pages', dir: 'app/pages', type: 'page' },
      { key: 'layouts', dir: 'app/layouts', type: 'layout' },
      { key: 'api', dir: 'server/api', type: 'api' }
    ]

    for (const scan of scanTypes) {
      if (type === 'all' || type === scan.key) {
        const items = await scanDirectory(join(appPath, scan.dir), scan.type)
        if (items.length > 0) {
          result[scan.key] = items
        }
      }
    }

    const summary = Object.entries(result)
      .map(([key, items]) => `${key}: ${items.length}`)
      .join(', ')

    return {
      content: [{
        type: 'text',
        text: `# ${appName} - ${type === 'all' ? 'All Code' : type}

Summary: ${summary || 'No items found'}

${JSON.stringify(result, null, 2)}`
      }]
    }
  }
})
