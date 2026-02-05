// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend organization layer (which extends core)
  extends: ['../../organization'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-og-image'
  ],

  devtools: {
    enabled: true
  },

  // Disable vite-plugin-checker TypeScript checking in dev (use nuxt typecheck instead)
  typescript: {
    typeCheck: false
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/docs': { redirect: '/docs/getting-started', prerender: false }
  },

  // Runtime config - point to dashboard API
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3010/api'
    }
  },

  // App-specific head config
  app: {
    head: {
      title: 'Landing Demo - App Agent',
      meta: [
        { name: 'description', content: 'Landing demo - marketing sites and documentation' }
      ]
    }
  },

  compatibilityDate: '2025-07-15',

  nitro: {
    preset: 'bun',
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
