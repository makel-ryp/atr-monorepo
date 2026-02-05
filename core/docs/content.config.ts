import { resolve } from 'node:path'
import { defineContentConfig, defineCollection, z } from '@nuxt/content'

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
    landing: defineCollection({
      type: 'page',
      source: 'index.md'
    }),
    // Upstream docs (core/docs/content/**)
    docs: defineCollection({
      type: 'page',
      source: {
        include: '**',
        exclude: ['index.md']
      },
      schema: linksSchema
    }),
    // Customer internal docs (/docs/internal/** → merges into /internal/)
    customerInternal: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../../docs/internal'),
        include: '**/*.md',
        prefix: '/internal'
      },
      schema: linksSchema
    }),
    // Customer top-level docs (/docs/** except internal → top-level sections)
    customerDocs: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../../docs'),
        include: '**/*.md',
        exclude: ['internal/**', 'README.md']
      },
      schema: linksSchema
    })
  }
})
