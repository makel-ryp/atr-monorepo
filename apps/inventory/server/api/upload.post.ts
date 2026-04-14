import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const ALLOWED_TYPES = ['amazon', 'sps'] as const
const ALLOWED_EXTS  = ['.csv', '.tsv', '.txt']
const MAX_BYTES     = 50 * 1024 * 1024 // 50 MB

function pythonCmd(): string {
  if (process.platform === 'win32') return 'py'
  return process.env.PYTHON_CMD ?? 'python3'
}

function getAppDir(): string {
  const candidates = [
    process.cwd(),
    join(process.cwd(), 'apps', 'inventory'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'pipeline', 'run_pipeline.py'))) return dir
  }
  return process.cwd()
}

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

export default defineEventHandler(async (event) => {
  const form = await readFormData(event)

  const type = form.get('type') as string
  if (!ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
    throw createError({ statusCode: 400, message: `type must be one of: ${ALLOWED_TYPES.join(', ')}` })
  }

  const file = form.get('file') as File | null
  if (!file || typeof file === 'string') {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTS.includes(ext)) {
    throw createError({ statusCode: 400, message: `File must be one of: ${ALLOWED_EXTS.join(', ')}` })
  }

  if (file.size > MAX_BYTES) {
    throw createError({ statusCode: 400, message: 'File exceeds 50 MB limit' })
  }

  // Sanitise filename — strip any path separators
  const safeName = file.name.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_')

  const appDir = getAppDir()
  const inboxDir = join(appDir, `${type}_inbox`)
  await mkdir(inboxDir, { recursive: true })

  const dest = join(inboxDir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buffer)

  // Auto-trigger pipeline after upload — skip if already running
  let pipeline_started = false
  if (!await isPipelineRunning()) {
    const child = spawn(pythonCmd(), ['pipeline/run_pipeline.py'], {
      detached: true,
      stdio: 'ignore',
      cwd: appDir,
      env: { ...process.env },
    })
    child.unref()
    pipeline_started = true
  }

  return {
    ok:               true,
    type,
    filename:         safeName,
    size:             file.size,
    pipeline_started,
  }
})
