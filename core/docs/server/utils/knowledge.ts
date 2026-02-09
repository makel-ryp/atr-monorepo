import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const VALID_ASPECTS = [
  'description',
  'overview',
  'faq',
  'reasoning',
  'details',
  'history',
] as const

export type Aspect = typeof VALID_ASPECTS[number]

export function getKnowledgeDir(): string {
  // cwd is the running app (docs/), knowledge lives in core/docs/knowledge/
  return join(process.cwd(), '..', 'core', 'docs', 'knowledge')
}

export async function slugExists(slug: string): Promise<boolean> {
  try {
    const s = await stat(join(getKnowledgeDir(), slug))
    return s.isDirectory()
  }
  catch {
    return false
  }
}

export async function listSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(getKnowledgeDir(), { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
  }
  catch {
    return []
  }
}

export async function listAspects(slug: string): Promise<string[]> {
  try {
    const entries = await readdir(join(getKnowledgeDir(), slug))
    return entries
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .sort()
  }
  catch {
    return []
  }
}

export async function readAspect(slug: string, aspect: string): Promise<string | null> {
  try {
    return await readFile(join(getKnowledgeDir(), slug, `${aspect}.md`), 'utf-8')
  }
  catch {
    return null
  }
}

export async function writeAspect(slug: string, aspect: string, content: string): Promise<void> {
  const dir = join(getKnowledgeDir(), slug)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${aspect}.md`), content, 'utf-8')
}
