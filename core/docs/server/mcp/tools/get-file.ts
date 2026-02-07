import { readFile, stat } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { z } from 'zod'

const ALLOWED_EXTENSIONS = [
  '.vue', '.ts', '.js', '.tsx', '.jsx',
  '.json', '.md', '.yaml', '.yml',
  '.css', '.scss', '.html'
]

const BLOCKED_PATTERNS = [
  'node_modules',
  '.env',
  '.git',
  'credentials',
  'secret',
  '.nuxt',
  '.output'
]

function isPathSafe(filePath: string): boolean {
  const normalized = filePath.toLowerCase().replace(/\\/g, '/')
  return !BLOCKED_PATTERNS.some(pattern => normalized.includes(pattern))
}

export default defineMcpTool({
  description: `Reads the source code of a file in the monorepo.

WHEN TO USE: Use this tool to examine actual source code:
- "Show me the code for the dashboard's analytics page"
- "Read the useAuth composable"
- "What's in the nuxt.config.ts of my-app?"

INPUT: Provide the file path relative to the app, or a full path from root.

Examples:
- appName: "dashboard", filePath: "app/pages/index.vue"
- appName: "dashboard", filePath: "nuxt.config.ts"
- appName: "core", filePath: "composables/useApi.ts"

SECURITY: This tool only reads allowed file types (.vue, .ts, .js, .json, .md, etc.)
and blocks sensitive paths (node_modules, .env, credentials, etc.)`,
  parameters: z.object({
    appName: z.string().describe('The app name (e.g., "dashboard", "my-app", "core")'),
    filePath: z.string().describe('Path to the file within the app')
  }),
  handler: async ({ appName, filePath }) => {
    const rootDir = join(process.cwd(), '../..')

    // Determine app location
    let basePath: string

    if (appName === 'core') {
      basePath = join(rootDir, 'core')
    } else {
      // Try demos first, then apps
      basePath = join(rootDir, 'demos', appName)
      try {
        await stat(basePath)
      } catch {
        basePath = join(rootDir, 'apps', appName)
        try {
          await stat(basePath)
        } catch {
          return {
            content: [{ type: 'text', text: `App "${appName}" not found` }],
            isError: true
          }
        }
      }
    }

    const fullPath = join(basePath, filePath)

    // Security checks
    if (!isPathSafe(fullPath)) {
      return {
        content: [{ type: 'text', text: 'Access denied: This path is blocked for security reasons' }],
        isError: true
      }
    }

    const ext = extname(fullPath).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        content: [{ type: 'text', text: `File type "${ext}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }],
        isError: true
      }
    }

    try {
      const content = await readFile(fullPath, 'utf-8')
      const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/')

      // Determine language for syntax highlighting
      const langMap: Record<string, string> = {
        '.vue': 'vue',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.json': 'json',
        '.md': 'markdown',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.css': 'css',
        '.scss': 'scss',
        '.html': 'html'
      }
      const lang = langMap[ext] || 'text'

      return {
        content: [{
          type: 'text',
          text: `# ${relativePath}

\`\`\`${lang}
${content}
\`\`\``
        }]
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to read file: ${error}` }],
        isError: true
      }
    }
  }
})
