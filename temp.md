# Configurable Items in Demo Apps

A comprehensive analysis of all items that should be configurable by customers across the landing, saas, and dashboard demo applications.

---

## 1. Branding/Identity

### Company Name & Tagline
- **Current Location**: `/organization/app/app.config.ts`
  - `brand.name`: "My Company"
  - `brand.tagline`: "Building something great"
- **Status**: Already centralized in organization config

### Logo Images
- **Current Location**: `/organization/app/app.config.ts`
  - `header.logo.light`: "/logo.png"
  - `header.logo.dark`: "/logo.png"
  - `header.logo.alt`: "My Company"
  - `header.title`: "My Company" (fallback text)
- **Status**: Already centralized in organization config

### Favicon
- **Current Location**: Hardcoded in all `app.vue` files as `/favicon.ico`
- **Suggested Config**: Move path to `app.config.ts` under `brand.favicon`

---

## 2. Colors/Theming

### Primary Color
- **Current Location**: Per-app `app.config.ts`
  - Landing: `ui.colors.primary: 'blue'`
  - SaaS: `ui.colors.primary: 'orange'`
  - Dashboard: `ui.colors.primary: 'green'`
- **Options**: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose
- **Status**: Already per-app customizable

### Neutral Color
- **Current Location**: Per-app `app.config.ts`
  - Landing: `ui.colors.neutral: 'slate'`
  - SaaS: `ui.colors.neutral: 'neutral'`
  - Dashboard: `ui.colors.neutral: 'zinc'`
- **Options**: slate, gray, zinc, neutral, stone
- **Status**: Already per-app customizable

### Theme Color Meta Tag
- **Current Location**: Hardcoded in `app.vue` files
  - Landing: `#020618` (dark) / `white` (light)
  - SaaS: `#171717` (dark) / `white` (light)
  - Dashboard: `#1b1718` (dark) / `white` (light)
- **Suggested Config**: Move to `app.config.ts` under `brand.themeColors`

---

## 3. Navigation

### Header Navigation Menu (Landing)
- **Current Location**: `/demos/landing/app/components/AppHeader.vue` (hardcoded)
  - Items: Docs, Pricing, Blog, Changelog
- **Suggested Config**: Move to `app.config.ts` under `navigation.header`

### Header Navigation Menu (SaaS)
- **Current Location**: `/demos/saas/app/components/AppHeader.vue` (hardcoded)
  - Items: Features, Pricing, Testimonials (scroll anchors)
  - Plus "Download App" button
- **Suggested Config**: Move to `app.config.ts` or content YAML

### Dashboard Sidebar Navigation
- **Current Location**: `/demos/dashboard/app/layouts/default.vue` (hardcoded)
  - Primary: Home, Inbox (badge: "4"), Customers, Settings (with sub-items)
  - Secondary: Feedback, Help & Support (external links)
  - Settings sub-items: General, Members, Notifications, Security
- **Suggested Config**: Move to `app.config.ts` under `navigation.sidebar`

### Search/Command Palette Navigation (Landing)
- **Current Location**: `/demos/landing/app/app.vue` (hardcoded)
  - Links: Docs, Pricing, Blog, Changelog
- **Suggested Config**: Move to `app.config.ts` under `navigation.search`

---

## 4. Header/Footer

### Footer Credits Text
- **Current Location**: `/organization/app/app.config.ts`
  - `footer.credits`: `Built with App Agent • © ${new Date().getFullYear()}`
- **Status**: Already configurable

### Footer Social Links
- **Current Location**: `/organization/app/app.config.ts`
  - `footer.links`: Array with Discord, X (Twitter), GitHub
- **Status**: Already configurable

### Footer Columns/Links (Landing & SaaS)
- **Current Location**: `/demos/landing/app/components/AppFooter.vue` (hardcoded)
  - Columns: Resources, Features, Company
  - Each column has hardcoded children labels (no actual links)
- **Suggested Config**: Move to `app.config.ts` under `footer.columns`

### Newsletter Subscription Form
- **Current Location**: `/demos/landing/app/components/AppFooter.vue` (hardcoded)
  - Label: "Subscribe to our newsletter"
  - Placeholder: "Enter your email"
  - Button: "Subscribe"
  - Success toast: "You've been subscribed to our newsletter."
- **Suggested Config**: Move to `app.config.ts` under `footer.newsletter`

---

## 5. Content

### Landing Page Hero Section
- **Current Location**: `/demos/landing/content/0.index.yml`
  - Title, description, hero links (CTAs)
- **Status**: Already in content YAML

### Landing Page Feature Sections
- **Current Location**: `/demos/landing/content/0.index.yml`
  - Multiple sections with titles, descriptions, feature lists
  - 6 features with name, description, icon
- **Status**: Already in content YAML

### Testimonials
- **Current Location**: `/demos/landing/content/0.index.yml`
  - 10 testimonials with quote, user name, description, avatar URL
- **Status**: Already in content YAML

### CTA Section
- **Current Location**: `/demos/landing/content/0.index.yml`
  - Title, description, links/buttons
- **Status**: Already in content YAML

### SaaS Page Content
- **Current Location**: `/demos/saas/content/index.yml`
  - SEO title/description
  - Hero text and links
  - Section with images (mobile/desktop mockups)
  - Features (6 items)
  - Steps (3-step onboarding)
  - Pricing plans
  - Testimonials
  - CTA
- **Status**: Already in content YAML

### Pricing Page (Landing)
- **Current Location**: `/demos/landing/content/2.pricing.yml`
  - 3 pricing plans with title, description, price (month/year), features, button
  - Logos section (icon list)
  - FAQ section
- **Status**: Already in content YAML

---

## 6. SEO & Meta Tags

### Page Title Template
- **Current Location**: `app.vue` files
  - Uses `${seo?.siteName || brand?.name || 'App'}`
- **Status**: Already uses organization config

### Site Name
- **Current Location**: `/organization/app/app.config.ts`
  - `seo.siteName`: "My Company"
- **Status**: Already configurable

### Individual Page Titles
- **Current Location**: Content YAML front matter (pages) or hardcoded (auth pages)
  - Auth pages: "Login", "Sign up" (hardcoded)
- **Suggested Config**: Auth page titles should move to `app.config.ts`

### Meta Descriptions
- **Current Location**: Content YAML or hardcoded in components
  - Login: "Login to your account to continue"
  - Signup: "Create an account to get started"
- **Suggested Config**: Centralize auth descriptions in `app.config.ts`

### Twitter Card Type
- **Current Location**: Hardcoded in `app.vue` files
  - `twitterCard: 'summary_large_image'`
- **Suggested Config**: Move to `app.config.ts` under `seo.twitterCard`

### OG Image
- **Current State**: Uses default or `defineOgImageComponent('Saas')`
- **Suggested Config**: Define proper OG image paths in `app.config.ts`

---

## 7. Authentication

### Login Form
- **Current Location**: `/demos/landing/app/pages/login.vue` (hardcoded)
  - Title: "Welcome back"
  - Fields: email, password, remember me
  - Auth providers: Google, GitHub buttons
  - Links: Sign up, forgot password
  - Footer: Terms of Service link
- **Suggested Config**: Move to `app.config.ts` under `auth.login`

### Signup Form
- **Current Location**: `/demos/landing/app/pages/signup.vue` (hardcoded)
  - Title: "Create an account"
  - Fields: name, email, password
  - Auth providers: Google, GitHub buttons
  - Links: Login link
  - Footer: Terms link
- **Suggested Config**: Move to `app.config.ts` under `auth.signup`

### Auth Provider Configuration
- **Current Location**: Hardcoded in login/signup pages
  - Icons: `i-simple-icons-google`, `i-simple-icons-github`
  - Actions: Toast messages (no real OAuth)
- **Suggested Config**: Move to `app.config.ts` under `auth.providers`

---

## 8. Dashboard-Specific

### User Menu
- **Current Location**: `/demos/dashboard/app/components/UserMenu.vue` (hardcoded)
  - User info: "Benjamin Canac" with avatar
  - Sections:
    1. Profile, Billing, Settings
    2. Theme color selector (16 colors)
    3. Appearance (Light/Dark)
    4. Templates (8 template links)
    5. Documentation, GitHub, Logout
- **Suggested Config**:
  - User data: API or `app.config.ts`
  - Menu structure: `app.config.ts` under `dashboard.userMenu`

### Teams Menu
- **Current Location**: `/demos/dashboard/app/components/TeamsMenu.vue` (hardcoded)
  - Teams: Acme Corp, Acme Labs, Acme Studio
  - Actions: Create team, Manage teams
- **Suggested Config**: Move to `app.config.ts` or fetch from API

### Notifications
- **Current Location**: Fetches from `/api/notifications`
- **Status**: Already API-driven

### Dashboard Keyboard Shortcuts
- **Current Location**: `/demos/dashboard/app/composables/useDashboard.ts` (hardcoded)
  - `g-h`: Go Home
  - `g-i`: Go Inbox
  - `g-c`: Go Customers
  - `g-s`: Go Settings
  - `n`: Toggle Notifications
- **Suggested Config**: Move to `app.config.ts` under `dashboard.shortcuts`

### Cookie Consent Banner
- **Current Location**: `/demos/dashboard/app/layouts/default.vue` (hardcoded)
  - Message: "We use first-party cookies to enhance your experience on our website."
  - Actions: Accept, Opt out
- **Suggested Config**: Move to `app.config.ts` under `dashboard.cookieConsent`

### Home Page Stats/Charts
- **Current Location**: Fetches from `/api/` endpoints
- **Status**: Already API-driven

---

## 9. External Links

### GitHub Repository
- **Current Locations**: Scattered throughout
  - Organization config: `header.links`, `footer.links`
  - Dashboard UserMenu: hardcoded to `nuxt-ui-templates/dashboard`
  - Dashboard Layout: dynamic "View page source" link
  - Landing/SaaS: Hero buttons
- **Suggested Config**: Centralize in `app.config.ts` under `externalLinks.github`

### Discord Server
- **Current Location**: Organization config `footer.links`
- **Status**: Already configurable (but URL is placeholder)

### X/Twitter Profile
- **Current Location**: Organization config `footer.links`
- **Status**: Already configurable (but URL is placeholder)

### Documentation Link
- **Current Locations**: Hardcoded in various places
  - Dashboard UserMenu: `https://ui.nuxt.com/docs/...`
  - Dashboard Settings page
- **Suggested Config**: Move to `app.config.ts` under `externalLinks.docs`

### Template Links (Dashboard)
- **Current Location**: UserMenu (hardcoded)
  - 8 template links to `https://[template]-template.nuxt.dev/`
- **Suggested Config**: Move to `app.config.ts` under `dashboard.templateLinks`

---

## 10. Assets & Media

### Hero Background Animation
- **Current Location**: `/demos/landing/app/components/HeroBackground.vue`
  - Decorative animated SVG/CSS background
- **Suggested Config**: Keep as component, make animation toggleable

### SaaS Images
- **Current Location**: `/demos/saas/public/images/`
  - Macbook mockups (mobile & desktop, light & dark)
  - Decorative lines (7 variants)
  - Connect, optimize, track SVGs
- **Status**: Already referenced via content YAML

### Company Logos
- **Current Location**: `/demos/saas/public/logos/`
  - 17 company logo SVGs for "trusted by" section
- **Status**: Already configurable via content YAML

### Template Screenshots
- **Current Location**: `/demos/saas/public/templates/`
  - 4 PNG images for template showcase
- **Suggested Config**: Make URLs configurable

### Avatar/Profile Images
- **Current Location**: Various API services
  - Pravatar.cc, dicebear API, GitHub avatars
- **Status**: Already URL-based

---

## 11. Forms

### Newsletter Signup
- **Current Location**: `AppFooter.vue` in landing/saas (hardcoded)
  - All text hardcoded
- **Suggested Config**: Move to `app.config.ts` under `forms.newsletter`

### Profile Update Form (Dashboard)
- **Current Location**: `/demos/dashboard/app/pages/settings/index.vue` (hardcoded)
  - Fields: name, email, username, avatar, bio
  - Avatar accepts: .jpg, .jpeg, .png, .gif (1MB max)
- **Suggested Config**: Form schema in `app.config.ts`

### Contact Form
- **Current State**: Not implemented
- **Suggested Config**: Add when implementing

---

## 12. Legal

### Terms of Service
- **Current Location**: Hardcoded links in login/signup pages
  - Links to "/" (not a real ToS page)
- **Suggested Config**: Add to `app.config.ts` under `legal.termsOfService`

### Privacy Policy
- **Current State**: Not implemented
- **Suggested Config**: Add to `app.config.ts` under `legal.privacyPolicy`

### Copyright Text
- **Current Location**: Organization footer config
  - Dynamically includes year
- **Status**: Already configurable

---

## Summary: Configuration Priority

### Already Configurable (No Changes Needed)
- Brand name, tagline, logo
- Primary and neutral colors (per-app)
- Footer credits and social links
- All content (landing, pricing, testimonials, features, CTA)
- Dashboard data (via API endpoints)

### High Priority (Should Centralize)
| Item | Current | Suggested Location |
|------|---------|-------------------|
| Header navigation | Hardcoded components | `app.config.ts` |
| Footer columns | Hardcoded components | `app.config.ts` |
| Auth form text | Hardcoded pages | `app.config.ts` |
| Auth providers | Hardcoded pages | `app.config.ts` |
| Dashboard sidebar nav | Hardcoded layout | `app.config.ts` |
| Legal links | Hardcoded | `app.config.ts` |
| External links | Scattered | `app.config.ts` |

### Medium Priority
| Item | Current | Suggested Location |
|------|---------|-------------------|
| Newsletter form text | Hardcoded | `app.config.ts` |
| User menu structure | Hardcoded | `app.config.ts` |
| Teams list | Hardcoded | `app.config.ts` or API |
| Cookie consent text | Hardcoded | `app.config.ts` |
| Dashboard shortcuts | Hardcoded | `app.config.ts` |

### Low Priority
| Item | Current | Suggested Location |
|------|---------|-------------------|
| Theme color meta tag | Hardcoded | `app.config.ts` |
| Twitter card type | Hardcoded | `app.config.ts` |
| Hero background toggle | Component | `app.config.ts` |
| Profile form schema | Hardcoded | `app.config.ts` |

---

## Recommended app.config.ts Structure

```typescript
export default defineAppConfig({
  // Already implemented
  brand: {
    name: 'My Company',
    tagline: 'Building something great',
    favicon: '/favicon.ico'
  },

  ui: {
    colors: {
      primary: 'sky',
      neutral: 'slate'
    }
  },

  seo: {
    siteName: 'My Company',
    twitterCard: 'summary_large_image'
  },

  header: {
    title: 'My Company',
    logo: { light: '/logo.png', dark: '/logo.png', alt: 'My Company' },
    links: [/* social links */]
  },

  footer: {
    credits: '© 2024 My Company',
    links: [/* social links */],
    // NEW
    columns: [
      { label: 'Resources', children: [/* links */] },
      { label: 'Company', children: [/* links */] }
    ],
    newsletter: {
      label: 'Subscribe to our newsletter',
      placeholder: 'Enter your email',
      button: 'Subscribe',
      successMessage: 'Subscribed!'
    }
  },

  // NEW sections
  navigation: {
    header: [/* nav items */],
    sidebar: [/* dashboard nav */],
    search: [/* command palette items */]
  },

  auth: {
    login: {
      title: 'Welcome back',
      description: 'Login to your account'
    },
    signup: {
      title: 'Create an account',
      description: 'Get started today'
    },
    providers: [
      { name: 'google', icon: 'i-simple-icons-google', label: 'Google' },
      { name: 'github', icon: 'i-simple-icons-github', label: 'GitHub' }
    ]
  },

  dashboard: {
    userMenu: {/* structure */},
    shortcuts: {/* keybindings */},
    cookieConsent: {
      message: 'We use cookies...',
      acceptLabel: 'Accept',
      rejectLabel: 'Opt out'
    }
  },

  externalLinks: {
    github: 'https://github.com/your-org',
    discord: 'https://discord.gg/your-server',
    twitter: 'https://x.com/your-handle',
    docs: '/docs'
  },

  legal: {
    termsOfService: '/terms',
    privacyPolicy: '/privacy'
  }
})
```
