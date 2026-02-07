import { fileURLToPath } from 'node:url'

/**
 * Organization Layer
 *
 * This is YOUR company's configuration layer. It extends the upstream
 * App Agent core and provides your company-wide defaults:
 *
 * - Company name and logo
 * - Brand colors and design system
 * - Social media links
 * - Shared assets
 *
 * All your apps (/docs, /apps/*, /demos/*) extend this layer,
 * so changes here propagate everywhere.
 *
 * EDIT THIS FILE - it's yours, no merge conflicts with upstream.
 */
export default defineNuxtConfig({
  // Extend the upstream App Agent core
  extends: [fileURLToPath(new URL('../core', import.meta.url))]
})
