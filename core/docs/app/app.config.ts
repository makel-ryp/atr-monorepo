/**
 * Documentation Layer Configuration
 *
 * Docs-specific settings. Branding (logo, colors, social links) comes from
 * /organization/app/app.config.ts and flows through automatically.
 *
 * This layer adds docs-specific UI configuration.
 */
export default defineAppConfig({
  // Docs-specific UI settings
  ui: {
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },

  // Docs header configuration
  header: {
    to: '/',
    search: true,
    colorMode: true,
    showTemplateMenu: false
  },

  // Docs footer configuration
  footer: {
    colorMode: false
  },

  // Table of contents settings
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Resources',
      edit: null,
      links: [{
        icon: 'i-lucide-book-open',
        label: 'Documentation',
        to: '/internal/app-agent/getting-started',
        target: '_self'
      }]
    }
  }
})
