// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md
//
// Each slug is a single markdown file: knowledge/{slug}.md
// Format: YAML frontmatter (title, description) + H2 sections (overview, faq, reasoning, details, history)
// Uses remark AST for reliable section extraction and splicing.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import type { Root, Heading, Content } from 'mdast'

export const VALID_ASPECTS = [
  'description',
  'overview',
  'faq',
  'reasoning',
  'details',
  'history',
] as const

export type Aspect = typeof VALID_ASPECTS[number]

// Mapping from aspect names to H2 heading text
const ASPECT_HEADINGS: Record<string, string> = {
  overview: 'Overview',
  faq: 'FAQ',
  reasoning: 'Reasoning',
  details: 'Details',
  history: 'History',
}

// Reverse mapping: heading text (lowercase) to aspect name
const HEADING_TO_ASPECT: Record<string, string> = Object.fromEntries(
  Object.entries(ASPECT_HEADINGS).map(([aspect, heading]) => [heading.toLowerCase(), aspect]),
)

export function getKnowledgeDir(): string {
  // cwd is the running app (docs/), knowledge lives in core/docs/knowledge/
  return join(process.cwd(), '..', 'core', 'docs', 'knowledge')
}

function getKnowledgePath(slug: string): string {
  return join(getKnowledgeDir(), `${slug}.md`)
}

// --- Frontmatter helpers ---

interface Frontmatter {
  title?: string
  description?: string
  [key: string]: string | undefined
}

function parseFrontmatter(raw: string): { data: Frontmatter, body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }

  const data: Frontmatter = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key) data[key] = value
  }
  return { data, body: match[2] }
}

function serializeFrontmatter(data: Frontmatter): string {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n`
}

// --- Remark helpers ---

const parser = unified().use(remarkParse)
const serializer = unified().use(remarkParse).use(remarkStringify, {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  listItemIndent: 'one',
  rule: '-',
})

function parseBody(body: string): Root {
  return parser.parse(body)
}

function stringifyAst(ast: Root): string {
  return serializer.stringify(ast)
}

function findSectionRange(ast: Root, headingText: string): { start: number, end: number } | null {
  const children = ast.children
  let start = -1

  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (node.type === 'heading' && (node as Heading).depth === 2) {
      const text = getHeadingText(node as Heading)
      if (text.toLowerCase() === headingText.toLowerCase()) {
        start = i
        continue
      }
      if (start !== -1) {
        // Found next H2 — section ends here
        return { start, end: i }
      }
    }
  }

  if (start !== -1) {
    // Section runs to end of file
    return { start, end: children.length }
  }

  return null
}

function getHeadingText(heading: Heading): string {
  return heading.children
    .map((child) => {
      if (child.type === 'text') return child.value
      if ('children' in child) return (child as any).children?.map((c: any) => c.value ?? '').join('') ?? ''
      return ''
    })
    .join('')
}

// --- Public API ---

export async function slugExists(slug: string): Promise<boolean> {
  try {
    await readFile(getKnowledgePath(slug), 'utf-8')
    return true
  }
  catch {
    return false
  }
}

export async function listSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(getKnowledgeDir())
    return entries
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .map(f => f.replace(/\.md$/, ''))
      .sort()
  }
  catch {
    return []
  }
}

export async function readKnowledgeFile(slug: string): Promise<string | null> {
  try {
    return await readFile(getKnowledgePath(slug), 'utf-8')
  }
  catch {
    return null
  }
}

export async function listAspects(slug: string): Promise<string[]> {
  const raw = await readKnowledgeFile(slug)
  if (!raw) return []

  const { data, body } = parseFrontmatter(raw)
  const aspects: string[] = []

  if (data.description) {
    aspects.push('description')
  }

  const ast = parseBody(body)
  for (const node of ast.children) {
    if (node.type === 'heading' && (node as Heading).depth === 2) {
      const text = getHeadingText(node as Heading)
      const aspect = HEADING_TO_ASPECT[text.toLowerCase()]
      if (aspect) {
        aspects.push(aspect)
      }
    }
  }

  return aspects
}

export async function readAspect(slug: string, aspect: string): Promise<string | null> {
  const raw = await readKnowledgeFile(slug)
  if (!raw) return null

  const { data, body } = parseFrontmatter(raw)

  // Description lives in frontmatter
  if (aspect === 'description') {
    return data.description ?? null
  }

  // Other aspects are H2 sections
  const headingText = ASPECT_HEADINGS[aspect]
  if (!headingText) return null

  const ast = parseBody(body)
  const range = findSectionRange(ast, headingText)
  if (!range) return null

  // Extract content nodes (everything after the heading, before next H2)
  const sectionAst: Root = {
    type: 'root',
    children: ast.children.slice(range.start + 1, range.end) as Content[],
  }

  return stringifyAst(sectionAst).trim()
}

export async function writeAspect(slug: string, aspect: string, content: string): Promise<void> {
  let raw = await readKnowledgeFile(slug)
  let data: Frontmatter
  let body: string

  if (raw) {
    ({ data, body } = parseFrontmatter(raw))
  }
  else {
    // New slug — create with title derived from slug
    const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    data = { title, description: '' }
    body = ''
  }

  // Description goes in frontmatter
  if (aspect === 'description') {
    data.description = content.trim()
    const output = serializeFrontmatter(data) + '\n' + body
    await writeFile(getKnowledgePath(slug), output, 'utf-8')
    return
  }

  // Other aspects are H2 sections — splice via remark AST
  const headingText = ASPECT_HEADINGS[aspect]
  if (!headingText) {
    throw new Error(`Unknown aspect: ${aspect}`)
  }

  const ast = parseBody(body)
  const newContentAst = parseBody(content.trim())
  const range = findSectionRange(ast, headingText)

  if (range) {
    // Replace existing section content (keep the heading)
    ast.children.splice(
      range.start + 1,
      range.end - range.start - 1,
      ...newContentAst.children,
    )
  }
  else {
    // Append new section at end
    const heading: Heading = {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: headingText }],
    }
    ast.children.push(heading, ...newContentAst.children)
  }

  const newBody = stringifyAst(ast)
  const output = serializeFrontmatter(data) + '\n' + newBody
  await writeFile(getKnowledgePath(slug), output, 'utf-8')
}
