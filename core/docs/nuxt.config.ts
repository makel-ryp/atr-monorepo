// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 1
        }
      }
    }
    // TODO: Multi-source content from /docs/ folder
    // Requires investigation to work properly with Nuxt UI Docs template collections
    // For now, all content lives in core/docs/content/
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
