import { fileURLToPath } from 'node:url'

/**
 * Control Plane App
 *
 * This app extends the @app-agent/control-layer from /core/control/ and provides:
 * - Customer branding overrides (app/app.config.ts)
 * - Customer public assets (public/)
 *
 * The layer provides all the infrastructure — pages, API routes, components.
 * You only need to add your customizations here.
 */
export default defineNuxtConfig({
  extends: [fileURLToPath(new URL('../core/control', import.meta.url))],

  compatibilityDate: '2025-07-15',

  devServer: {
    port: 3001
  }
})
