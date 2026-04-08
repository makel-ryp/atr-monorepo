import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ALLOWED_TYPES = ['amazon', 'sps'] as const
const ALLOWED_EXTS  = ['.csv', '.tsv', '.txt']
const MAX_BYTES     = 50 * 1024 * 1024 // 50 MB

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

  const inboxDir = join(process.cwd(), `${type}_inbox`)
  await mkdir(inboxDir, { recursive: true })

  const dest = join(inboxDir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buffer)

  return {
    ok:       true,
    type,
    filename: safeName,
    size:     file.size,
    dest,
  }
})
