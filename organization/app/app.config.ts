/**
 * Organization Branding Configuration
 *
 * This is YOUR company's branding. Edit these values to customize
 * all your apps at once. Individual apps can override specific values.
 *
 * This file is YOURS - no merge conflicts with upstream updates.
 */
export default defineAppConfig({
  //
  // Company Identity
  //
  brand: {
    // Your company name
    name: 'My Company',

    // Optional tagline
    tagline: 'Building something great'
  },

  //
  // Design System
  //
  ui: {
    colors: {
      // Primary brand color (used for buttons, links, accents)
      // Options: red, orange, amber, yellow, lime, green, emerald,
      //          teal, cyan, sky, blue, indigo, violet, purple,
      //          fuchsia, pink, rose
      primary: 'sky',

      // Neutral color (used for text, backgrounds, borders)
      // Options: slate, gray, zinc, neutral, stone
      neutral: 'slate'
    }
  },

  //
  // SEO Defaults
  //
  seo: {
    siteName: 'My Company'
  },

  //
  // Header Configuration (used by docs and apps)
  //
  header: {
    title: 'My Company',
    logo: {
      light: '/logo.png',
      dark: '/logo.png',
      alt: 'My Company'
    },
    // Header links (top right corner)
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/your-org',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },

  //
  // Footer Configuration
  //
  footer: {
    credits: `Built with App Agent • © ${new Date().getFullYear()}`,
    // Footer social links
    links: [{
      'icon': 'i-simple-icons-discord',
      'to': 'https://discord.gg/your-server',
      'target': '_blank',
      'aria-label': 'Discord'
    }, {
      'icon': 'i-simple-icons-x',
      'to': 'https://x.com/your-handle',
      'target': '_blank',
      'aria-label': 'X (Twitter)'
    }, {
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/your-org',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  }
})
