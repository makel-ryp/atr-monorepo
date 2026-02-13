import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

/**
 * App Agent Documentation Layer
 *
 * This is a Nuxt layer that provides the documentation infrastructure.
 * The actual docs app lives in /docs/ and extends this layer.
 *
 * Inheritance chain:
 *   /core → /organization → /core/docs → /docs
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
  // Extend organization layer (which extends core)
  extends: [fileURLToPath(new URL('../../organization', import.meta.url))],

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
    '@nuxtjs/mcp-toolkit',

    // Fix MCP transport memory leak + suppress false-positive MaxListenersExceeded warning.
    //
    // Two issues:
    // 1. LEAK (fixed): Default MCP transport uses @hono/node-server getRequestListener
    //    which adds close/error listeners that never get cleaned up. Our replacement uses
    //    WebStandardStreamableHTTPServerTransport (zero Node.js event listeners).
    // 2. WARNING (suppressed): In dev, each request passes through ~11 middleware/proxy
    //    layers (Vite plugins + httpxy proxy), each adding a close/error listener to
    //    ServerResponse. These ARE cleaned up on response finish — not a leak, just
    //    exceeds Node's default maxListeners of 10.
    defineNuxtModule({
      meta: { name: 'mcp-transport-fix' },
      setup(_options, nuxt) {
        // Override the MCP transport virtual module
        const transportPath = resolve(
          fileURLToPath(new URL('./', import.meta.url)),
          'server/utils/mcp-transport'
        ).replace(/\\/g, '/')
        nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
        nuxt.options.nitro.virtual['#nuxt-mcp/transport.mjs'] = () =>
          `export { default } from '${transportPath}'`

        // Raise default maxListeners in dev to suppress false-positive warnings.
        // Each request passes through ~11 middleware/proxy layers that add close/error
        // listeners to ServerResponse. These are cleaned up on response close — not a leak.
        if (nuxt.options.dev) {
          const { EventEmitter } = require('node:events')
          if (EventEmitter.defaultMaxListeners < 20) {
            EventEmitter.defaultMaxListeners = 20
          }
        }
      }
    }),
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
