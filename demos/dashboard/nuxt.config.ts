// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend organization layer (which extends core)
  extends: ['../../organization'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxthub/core',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  // Disable vite-plugin-checker TypeScript checking in dev (use nuxt typecheck instead)
  typescript: {
    typeCheck: false
  },

  css: ['~/assets/css/main.css'],

  // Admin app has the API - configure CORS for cross-subdomain access
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production'
          ? 'https://demo.app-agent.io,https://www.app-agent.io'
          : '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      }
    }
  },

  // Override runtime config for admin
  runtimeConfig: {
    public: {
      apiBase: '/api' // Admin serves its own API
    }
  },

  // App-specific head config
  app: {
    head: {
      title: 'Dashboard Demo - App Agent',
      meta: [
        { name: 'description', content: 'Dashboard demo - internal tools, admin panels, analytics' }
      ]
    }
  },

  // NuxtHub configuration for database
  hub: {
    db: 'sqlite'
  },

  // Nitro server configuration
  nitro: {
    preset: 'bun'
  },

  compatibilityDate: '2025-07-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
