import { fileURLToPath } from 'node:url'

/**
 * Documentation App
 *
 * This app extends the @app-agent/docs-layer from /core/docs/ and provides:
 * - Customer branding overrides (app/app.config.ts)
 * - Customer public assets (public/)
 * - Customer documentation content (content/)
 *
 * The layer provides all the infrastructure - components, layouts, pages, MCP server.
 * You only need to add your customizations here.
 */
export default defineNuxtConfig({
  // Extend the documentation layer from core (use absolute path for reliability)
  extends: [fileURLToPath(new URL('../core/docs', import.meta.url))],

  // Required compatibility date
  compatibilityDate: '2024-07-11',

  // App runs on port 3000
  devServer: {
    port: 3000
  },

  // Override layer config as needed
  mcp: {
    name: 'Documentation'
  }
})
