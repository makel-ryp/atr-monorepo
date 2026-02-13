import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['../../organization'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@nuxtjs/mdc'
  ],

  alias: {
    '#control-layer': fileURLToPath(new URL('./', import.meta.url))
  },

  devtools: {
    enabled: true
  },

  typescript: {
    typeCheck: false
  },

  // CSS uses layer alias to resolve correctly when extended
  css: ['#control-layer/app/assets/css/main.css'],

  app: {
    head: {
      title: 'Control Plane - App Agent',
      meta: [
        { name: 'description', content: 'App Agent control plane — runtime management and developer tools' },
        { name: 'robots', content: 'noindex, nofollow' }
      ]
    }
  },

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
