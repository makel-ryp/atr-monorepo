// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend organization layer (which extends core)
  extends: ['../../organization'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxthub/core',
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

  experimental: {
    viewTransition: true
  },

  // App-specific head config
  app: {
    head: {
      title: 'Characters',
      meta: [
        { name: 'description', content: 'Characters - multi-character chat' }
      ]
    }
  },

  // NuxtHub configuration for database
  hub: {
    db: 'sqlite'
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
