export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  vite: {
    server: {
      hmr: {
        overlay: false
      },
      allowedHosts: true,
    }
  },

  typescript: {
    typeCheck: false
  },

  nitro: {
    preset: 'bun',
    experimental: {
      tasks: true
    },
    scheduledTasks: {
      '0 7 * * *': ['pipeline']
    }
  },

  runtimeConfig: {
    anthropicApiKey: '',
    shopifyShopName: '',
    shopifyAccessToken: '',
    amazonClientId: '',
    amazonClientSecret: '',
    amazonRefreshToken: '',
    spAwsAccessKey: '',
    spAwsSecret: '',
    spAwsRoleArn: '',
    spMarketplaceId: 'ATVPDKIKX0DER',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: '',
    alertEmailTo: '',
    slackWebhookUrl: '',
    public: {}
  },

  app: {
    head: {
      title: 'Inventory Dashboard'
    }
  },

  compatibilityDate: '2025-07-15'
})
