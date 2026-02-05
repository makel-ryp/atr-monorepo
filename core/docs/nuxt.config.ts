import { fileURLToPath } from 'node:url'

/**
 * App Agent Documentation Layer
 *
 * This is a Nuxt layer that provides the documentation infrastructure.
 * The actual docs app lives in /docs/ and extends this layer.
 *
 * As a layer, this provides:
 * - Components (AppHeader, AppFooter, etc.)
 * - Layouts (docs layout)
 * - Pages ([...slug].vue, index.vue)
 * - Server routes (MCP tools, raw content)
 * - Default app.config (branding, links)
 * - Default public assets (logos)
 * - Upstream content (App Agent reference docs)
 */
export default defineNuxtConfig({
  // Alias for layer assets (required for CSS/assets to resolve correctly when extended)
  alias: {
    '#docs-layer': fileURLToPath(new URL('./', import.meta.url))
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms',
    '@nuxtjs/mcp-toolkit'
  ],

  devtools: {
    enabled: true
  },

  // Disable vite-plugin-checker TypeScript checking in dev (use nuxt typecheck instead)
  typescript: {
    typeCheck: false
  },

  // CSS uses layer alias to resolve correctly when extended
  css: ['#docs-layer/app/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 1
        }
      }
    }
  },

  experimental: {
    asyncContext: true
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true,
      autoSubfolderIndex: false
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    provider: 'iconify'
  },

  llms: {
    domain: 'http://localhost:3000',
    title: 'Documentation',
    description: 'Project documentation with AI-native development support.',
    full: {
      title: 'Full Documentation',
      description: 'Complete documentation including internal reference materials.'
    },
    sections: [
      {
        title: 'App Agent - Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/internal/app-agent/getting-started%' }
        ]
      },
      {
        title: 'App Agent - Demos',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/internal/app-agent/demos%' }
        ]
      },
      {
        title: 'App Agent - AI Integration',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/internal/app-agent/ai%' }
        ]
      }
    ]
  },

  mcp: {
    name: 'App Agent Docs'
  }
})
