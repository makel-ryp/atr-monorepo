/**
 * App Agent Documentation Configuration
 *
 * This file controls branding, navigation, and links for the documentation site.
 * Customers can customize these values - minor merge conflicts on upstream updates
 * are expected and easy to resolve.
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sky',
      neutral: 'slate'
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'App Agent'
  },
  header: {
    title: 'App Agent',
    to: '/',
    logo: {
      alt: 'App Agent',
      light: '/logo-quarter.png',
      dark: '/logo-quarter.png'
    },
    search: true,
    colorMode: true,
    // Set to false to hide the template switcher dropdown
    showTemplateMenu: false,
    // Header links (top right)
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/your-org/app-agent',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },
  footer: {
    // Footer credits text
    credits: `Built with App Agent • © ${new Date().getFullYear()}`,
    colorMode: false,
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
      'to': 'https://github.com/your-org/app-agent',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Resources',
      // Set to null to hide the "Edit this page" link
      edit: null,
      links: [{
        icon: 'i-lucide-book-open',
        label: 'App Agent Docs',
        to: '/internal/app-agent/getting-started',
        target: '_self'
      }]
    }
  }
})
