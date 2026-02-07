/**
 * Documentation Branding Configuration
 *
 * This file overrides the defaults from the layer (@app-agent/docs-layer).
 * Only specify values you want to change - everything else uses layer defaults.
 *
 * Available options:
 *
 * seo: {
 *   siteName: 'Your Company'
 * }
 *
 * header: {
 *   title: 'Your Docs',
 *   logo: {
 *     alt: 'Logo',
 *     light: '/logo.png',
 *     dark: '/logo-dark.png'
 *   },
 *   links: [{ icon: 'i-simple-icons-github', to: 'https://github.com/you' }]
 * }
 *
 * footer: {
 *   credits: 'Built by Your Company',
 *   links: [
 *     { icon: 'i-simple-icons-discord', to: 'https://discord.gg/yours' },
 *     { icon: 'i-simple-icons-x', to: 'https://x.com/yours' },
 *     { icon: 'i-simple-icons-github', to: 'https://github.com/yours' }
 *   ]
 * }
 */
export default defineAppConfig({
  // Uncomment and customize:
  //
  // seo: {
  //   siteName: 'My Company Docs'
  // },
  //
  // header: {
  //   logo: {
  //     light: '/my-logo.png',
  //     dark: '/my-logo.png'
  //   }
  // },
  //
  // footer: {
  //   credits: `Built by My Company • © ${new Date().getFullYear()}`
  // }
})
