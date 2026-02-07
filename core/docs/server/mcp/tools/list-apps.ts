import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

interface AppInfo {
  name: string
  packageName: string
  type: 'app' | 'demo'
  path: string
  port?: number
  description?: string
}

async function scanAppsDirectory(dir: string, type: 'app' | 'demo'): Promise<AppInfo[]> {
  const apps: AppInfo[] = []

  try {
    const entries = await readdir(dir)

    for (const entry of entries) {
      if (entry.startsWith('.')) continue

      const appPath = join(dir, entry)
      const stats = await stat(appPath)

      if (!stats.isDirectory()) continue

      const pkgPath = join(appPath, 'package.json')
      try {
        const pkgContent = await readFile(pkgPath, 'utf-8')
        const pkg = JSON.parse(pkgContent)

        // Extract port from dev script
        const devScript = pkg.scripts?.dev || ''
        const portMatch = devScript.match(/--port\s+(\d+)/)
        const port = portMatch ? parseInt(portMatch[1], 10) : undefined

        apps.push({
          name: entry,
          packageName: pkg.name || entry,
          type,
          path: appPath.replace(/\\/g, '/'),
          port,
          description: pkg.description
        })
      } catch {
        // No package.json or invalid - skip
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return apps
}

export default defineMcpTool({
  description: `Lists all applications and demos in the App Agent monorepo.

WHEN TO USE: Use this tool to discover what apps exist in the project:
- "What apps are in this project?"
- "Show me the available demos"
- "What ports are the apps running on?"
- "Find the dashboard app"

OUTPUT: Returns a list of apps with:
- name: Directory name
- packageName: npm package name
- type: 'app' (customer apps) or 'demo' (reference implementations)
- path: File system path
- port: Dev server port (if configured)
- description: Package description (if available)`,
  cache: '5m',
  handler: async () => {
    // Navigate from docs to root
    const rootDir = join(process.cwd(), '../..')

    try {
      const apps = await scanAppsDirectory(join(rootDir, 'apps'), 'app')
      const demos = await scanAppsDirectory(join(rootDir, 'demos'), 'demo')

      const result = {
        apps,
        demos,
        summary: {
          totalApps: apps.length,
          totalDemos: demos.length
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to list apps: ${error}` }],
        isError: true
      }
    }
  }
})
