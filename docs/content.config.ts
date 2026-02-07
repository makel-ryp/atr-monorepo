import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineContentConfig, defineCollection, z } from '@nuxt/content'

const __dirname = dirname(fileURLToPath(import.meta.url))

const linksSchema = z.object({
  links: z.array(z.object({
    label: z.string(),
    icon: z.string(),
    to: z.string(),
    target: z.string().optional()
  })).optional()
})

export default defineContentConfig({
  collections: {
    // Landing page from layer
    landing: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../core/docs/content'),
        include: 'index.md'
      }
    }),

    // Upstream docs from layer (App Agent reference)
    docs: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../core/docs/content'),
        include: '**',
        exclude: ['index.md']
      },
      schema: linksSchema
    }),

    // Customer internal docs (content/internal/** → merges into /internal/)
    customerInternal: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, 'content/internal'),
        include: '**/*.md',
        prefix: '/internal'
      },
      schema: linksSchema
    }),

    // Customer top-level docs (content/** except internal → top-level sections)
    customerDocs: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, 'content'),
        include: '**/*.md',
        exclude: ['internal/**', 'README.md']
      },
      schema: linksSchema
    })
  }
})
