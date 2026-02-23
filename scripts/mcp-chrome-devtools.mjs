import { spawn, execSync } from 'node:child_process'
import { platform, homedir } from 'node:os'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const isWindows = platform() === 'win32'

// Ensure a Node >= 20 is on PATH for packages with #!/usr/bin/env node shebangs
function findModernNode() {
  const nvmDir = join(homedir(), '.nvm', 'versions', 'node')
  if (!existsSync(nvmDir)) return null

  const versions = readdirSync(nvmDir)
    .filter(v => v.startsWith('v'))
    .map(v => ({ dir: v, major: parseInt(v.slice(1)) }))
    .filter(v => v.major >= 20)
    .sort((a, b) => b.major - a.major)

  if (versions.length === 0) return null
  return join(nvmDir, versions[0].dir, 'bin')
}

const env = { ...process.env }
const modernNodeBin = findModernNode()
if (modernNodeBin) {
  // Prepend modern Node to PATH so #!/usr/bin/env node resolves correctly
  const sep = isWindows ? ';' : ':'
  env.PATH = modernNodeBin + sep + env.PATH
}

const command = isWindows ? 'cmd' : 'npx'
const args = isWindows
  ? ['/c', 'npx', 'chrome-devtools-mcp@latest']
  : ['chrome-devtools-mcp@latest']

const child = spawn(command, args, { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 1))
