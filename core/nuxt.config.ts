// Core Layer Configuration
// This is a Nuxt Layer that provides shared functionality to all apps
// https://nuxt.com/docs/guide/going-further/layers
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: true
  },

  // Shared modules - inherited by all apps
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    '@nuxtjs/i18n',
  ],

  // CONTEXT: i18n-layers — Core i18n config; layers inherit and add their own locale files
  i18n: {
    lazy: true,
    langDir: resolve(currentDir, 'i18n/locales'),
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
    },
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es-ES', name: 'Español', file: 'es.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
    ],
  },

  // Alias for importing from core layer explicitly
  alias: {
    '#core': currentDir
  },

  // Base runtime configuration - apps can override
  runtimeConfig: {
    // Private keys (server-side only)
    apiSecret: '',
    todo: { enabled: true },
    // Public keys (exposed to client)
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
      appVersion: '0.0.0',
      serviceId: 'app-agent',
    },
  },

  // Base app configuration
  app: {
    head: {
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  // Experimental features
  experimental: {
    typedPages: true
  },

  // Enable Nuxt devtools for development
  devtools: { enabled: true }
})
