import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { scanDirectory, scanProject } from '../../server/utils/see-scanner'

const TMP_DIR = join(process.cwd(), 'core/tests/.tmp-scanner-test')

describe('see-scanner', () => {
  beforeAll(async () => {
    await mkdir(join(TMP_DIR, 'sub'), { recursive: true })
    await mkdir(join(TMP_DIR, 'node_modules'), { recursive: true })

    await writeFile(join(TMP_DIR, 'single.ts'), `// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md
import { something } from 'somewhere'
export default function rateLimit() {}
`)

    await writeFile(join(TMP_DIR, 'multi.ts'), `// SEE: feature "auth" at core/docs/knowledge/auth.md
// SEE: feature "session" at core/docs/knowledge/session.md
export function middleware() {}
`)

    await writeFile(join(TMP_DIR, 'none.ts'), `export function helper() {
  return 42
}
`)

    await writeFile(join(TMP_DIR, 'sub/nested.ts'), `// SEE: feature "nested-feat" at core/docs/knowledge/nested-feat.md
export const x = 1
`)

    await writeFile(join(TMP_DIR, 'node_modules/ignored.ts'), `// SEE: feature "should-not-appear" at core/docs/knowledge/nope.md
`)

    await writeFile(join(TMP_DIR, 'readme.md'), `This is not a ts file`)

    await writeFile(join(TMP_DIR, 'inline.ts'), `const x = 1 // SEE: feature "inline-feat" at some/path.md
`)
  })

  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
  })

  test('finds single annotation in a file', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const single = results.filter(r => r.slug === 'rate-limiting')
    expect(single).toHaveLength(1)
    expect(single[0].lineNumber).toBe(1)
    expect(single[0].filePath).toContain('single.ts')
  })

  test('finds multiple annotations in one file', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const auth = results.find(r => r.slug === 'auth')
    const session = results.find(r => r.slug === 'session')
    expect(auth).toBeDefined()
    expect(session).toBeDefined()
    expect(auth!.lineNumber).toBe(1)
    expect(session!.lineNumber).toBe(2)
  })

  test('skips files without annotations', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const noneFile = results.filter(r => r.filePath.includes('none.ts'))
    expect(noneFile).toHaveLength(0)
  })

  test('finds annotations in nested directories', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const nested = results.find(r => r.slug === 'nested-feat')
    expect(nested).toBeDefined()
    expect(nested!.filePath).toContain('sub/')
  })

  test('skips node_modules', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const ignored = results.find(r => r.slug === 'should-not-appear')
    expect(ignored).toBeUndefined()
  })

  test('skips non-.ts files', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const mdFiles = results.filter(r => r.filePath.endsWith('.md'))
    expect(mdFiles).toHaveLength(0)
  })

  test('finds inline annotations (not just first line)', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    const inline = results.find(r => r.slug === 'inline-feat')
    expect(inline).toBeDefined()
    expect(inline!.lineNumber).toBe(1)
  })

  test('file paths use forward slashes', async () => {
    const results = await scanDirectory(TMP_DIR, TMP_DIR)
    for (const r of results) {
      expect(r.filePath).not.toContain('\\')
    }
  })

  test('scanProject delegates to scanDirectory with root=root', async () => {
    const results = await scanProject(TMP_DIR)
    expect(results.length).toBeGreaterThan(0)
    const slugs = results.map(r => r.slug)
    expect(slugs).toContain('rate-limiting')
  })
})
