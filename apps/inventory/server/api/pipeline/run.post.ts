import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Resolve the inventory app root — works whether the dev server was started
// from apps/inventory/ directly or from the monorepo root via turborepo.
function getAppDir(): string {
  const candidates = [
    process.cwd(),
    join(process.cwd(), 'apps', 'inventory'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'pipeline', 'run_pipeline.py'))) return dir
  }
  throw new Error('Cannot find pipeline/run_pipeline.py — check working directory')
}

// Guard against concurrent pipeline runs — check status before spawning
async function isPipelineRunning(): Promise<boolean> {
  try {
    const db = useDb()
    const { rows: latest } = await db.sql`
      SELECT run_timestamp FROM run_log ORDER BY run_timestamp DESC LIMIT 1
    `
    if (!latest?.length) return false
    const ts = (latest[0] as Record<string, unknown>).run_timestamp as string
    const { rows: steps } = await db.sql`
      SELECT status FROM run_log WHERE run_timestamp = ${ts}
    `
    return (steps as Record<string, unknown>[]).some(s => s.status === 'running')
  } catch {
    return false
  }
}

// Resolve Python command — Windows uses 'py', Unix uses 'python3' or 'python'
function pythonCmd(): string {
  if (process.platform === 'win32') return 'py'
  return process.env.PYTHON_CMD ?? 'python3'
}

export default defineEventHandler(async () => {
  if (await isPipelineRunning()) {
    throw createError({ statusCode: 409, message: 'Pipeline is already running' })
  }

  const appDir = getAppDir()
  const child = spawn(pythonCmd(), ['pipeline/run_pipeline.py'], {
    detached: true,
    stdio: 'ignore',
    cwd: appDir,
    env: { ...process.env },
  })
  child.unref()
  return { started: true, pid: child.pid }
})
