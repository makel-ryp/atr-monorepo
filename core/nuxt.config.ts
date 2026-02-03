// Core Layer Configuration
// This is a Nuxt Layer that provides shared functionality to all apps
// https://nuxt.com/docs/guide/going-further/layers
import { fileURLToPath } from 'url'
import { dirname } from 'path'

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
    '@nuxt/eslint'
  ],

  // Alias for importing from core layer explicitly
  alias: {
    '#core': currentDir
  },

  // Base runtime configuration - apps can override
  runtimeConfig: {
    // Private keys (server-side only)
    apiSecret: '',
    // Public keys (exposed to client)
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api'
    }
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

  // Enable devtools for development
  devtools: { enabled: true }
})
