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
    }],
    // Navigation items for landing/saas headers
    navigation: [
      { label: 'Docs', to: '/docs' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
      { label: 'Changelog', to: '/changelog' }
    ],
    // Call-to-action button
    cta: { label: 'Get Started', to: '/signup' }
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
    }],
    // Footer columns for landing/saas pages
    columns: [{
      label: 'Resources',
      children: [{
        label: 'Help center'
      }, {
        label: 'Docs'
      }, {
        label: 'Roadmap'
      }, {
        label: 'Changelog'
      }]
    }, {
      label: 'Features',
      children: [{
        label: 'Affiliates'
      }, {
        label: 'Portal'
      }, {
        label: 'Jobs'
      }, {
        label: 'Sponsors'
      }]
    }, {
      label: 'Company',
      children: [{
        label: 'About'
      }, {
        label: 'Pricing'
      }, {
        label: 'Careers'
      }, {
        label: 'Blog'
      }]
    }],
    // Newsletter form configuration
    newsletter: {
      label: 'Subscribe to our newsletter',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
      successTitle: 'Subscribed!',
      successMessage: "You've been subscribed to our newsletter."
    }
  },

  //
  // Centralized External Links
  //
  links: {
    github: 'https://github.com/your-org',
    discord: 'https://discord.gg/your-server',
    twitter: 'https://x.com/your-handle',
    docs: '/docs',
    terms: '/terms',
    privacy: '/privacy'
  },

  //
  // Auth Configuration (login/signup pages)
  //
  auth: {
    providers: [
      { label: 'Google', icon: 'i-simple-icons-google', id: 'google' },
      { label: 'GitHub', icon: 'i-simple-icons-github', id: 'github' }
    ],
    login: {
      title: 'Welcome back',
      icon: 'i-lucide-lock',
      description: "Don't have an account?",
      descriptionLink: { label: 'Sign up', to: '/signup' },
      forgotPasswordLink: { label: 'Forgot password?', to: '/' },
      termsText: 'By signing in, you agree to our',
      termsLink: { label: 'Terms of Service', to: '/' },
      submitLabel: 'Sign in',
      fields: [{
        name: 'email',
        type: 'text',
        label: 'Email',
        placeholder: 'Enter your email',
        required: true
      }, {
        name: 'password',
        label: 'Password',
        type: 'password',
        placeholder: 'Enter your password'
      }, {
        name: 'remember',
        label: 'Remember me',
        type: 'checkbox'
      }],
      seo: {
        title: 'Login',
        description: 'Login to your account to continue'
      }
    },
    signup: {
      title: 'Create an account',
      description: 'Already have an account?',
      descriptionLink: { label: 'Login', to: '/login' },
      termsText: 'By signing up, you agree to our',
      termsLink: { label: 'Terms of Service', to: '/' },
      submitLabel: 'Create account',
      fields: [{
        name: 'name',
        type: 'text',
        label: 'Name',
        placeholder: 'Enter your name'
      }, {
        name: 'email',
        type: 'text',
        label: 'Email',
        placeholder: 'Enter your email'
      }, {
        name: 'password',
        label: 'Password',
        type: 'password',
        placeholder: 'Enter your password'
      }],
      seo: {
        title: 'Sign up',
        description: 'Create an account to get started'
      }
    }
  },

  //
  // Dashboard-specific Configuration
  //
  dashboard: {
    sidebar: {
      primary: [{
        label: 'Home',
        icon: 'i-lucide-house',
        to: '/'
      }, {
        label: 'Inbox',
        icon: 'i-lucide-inbox',
        to: '/inbox',
        badge: '4'
      }, {
        label: 'Customers',
        icon: 'i-lucide-users',
        to: '/customers'
      }, {
        label: 'Settings',
        to: '/settings',
        icon: 'i-lucide-settings',
        defaultOpen: true,
        children: [{
          label: 'General',
          to: '/settings',
          exact: true
        }, {
          label: 'Members',
          to: '/settings/members'
        }, {
          label: 'Notifications',
          to: '/settings/notifications'
        }, {
          label: 'Security',
          to: '/settings/security'
        }]
      }],
      secondary: [{
        label: 'Feedback',
        icon: 'i-lucide-message-circle',
        to: 'https://github.com/nuxt-ui-templates/dashboard',
        target: '_blank'
      }, {
        label: 'Help & Support',
        icon: 'i-lucide-info',
        to: 'https://github.com/nuxt-ui-templates/dashboard',
        target: '_blank'
      }]
    },
    userMenu: {
      items: [{
        label: 'Profile',
        icon: 'i-lucide-user'
      }, {
        label: 'Billing',
        icon: 'i-lucide-credit-card'
      }, {
        label: 'Settings',
        icon: 'i-lucide-settings',
        to: '/settings'
      }],
      externalLinks: [{
        label: 'Documentation',
        icon: 'i-lucide-book-open',
        to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
        target: '_blank'
      }, {
        label: 'GitHub repository',
        icon: 'i-simple-icons-github',
        to: 'https://github.com/nuxt-ui-templates/dashboard',
        target: '_blank'
      }],
      logoutLabel: 'Log out'
    },
    teams: [{
      label: 'Acme Corp',
      avatar: {
        src: 'https://api.dicebear.com/7.x/identicon/svg?seed=acme',
        alt: 'Acme Corp'
      }
    }, {
      label: 'Acme Labs',
      avatar: {
        src: 'https://api.dicebear.com/7.x/identicon/svg?seed=labs',
        alt: 'Acme Labs'
      }
    }, {
      label: 'Acme Studio',
      avatar: {
        src: 'https://api.dicebear.com/7.x/identicon/svg?seed=studio',
        alt: 'Acme Studio'
      }
    }],
    shortcuts: {
      'g-h': { action: 'navigate', to: '/' },
      'g-i': { action: 'navigate', to: '/inbox' },
      'g-c': { action: 'navigate', to: '/customers' },
      'g-s': { action: 'navigate', to: '/settings' },
      'n': { action: 'toggle', target: 'notifications' }
    },
    cookieConsent: {
      message: 'We use first-party cookies to enhance your experience on our website.',
      acceptLabel: 'Accept',
      optOutLabel: 'Opt out'
    }
  }
})
