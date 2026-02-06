// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend organization layer (which extends core)
  extends: ['../../organization'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@nuxthub/core',
    'nuxt-auth-utils',
    'nuxt-charts'
  ],

  devtools: {
    enabled: true
  },

  // Disable vite-plugin-checker TypeScript checking in dev (use nuxt typecheck instead)
  typescript: {
    typeCheck: false
  },

  css: ['~/assets/css/main.css'],

  mdc: {
    headings: {
      anchorLinks: false
    },
    highlight: {
      shikiEngine: 'javascript'
    }
  },

  experimental: {
    viewTransition: true
  },

  // App-specific head config
  app: {
    head: {
      title: 'Chat Demo - App Agent',
      meta: [
        { name: 'description', content: 'AI chatbot demo - conversational AI with persistent history' }
      ]
    }
  },

  // NuxtHub configuration for database and blob storage
  hub: {
    db: 'sqlite',
    blob: true
  },

  // Nitro server configuration
  nitro: {
    preset: 'bun',
    experimental: {
      openAPI: true
    }
  },

  compatibilityDate: '2024-07-11',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
