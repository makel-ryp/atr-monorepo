export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'neutral'
    }
  },
  // SaaS uses anchor navigation with scrollspy
  header: {
    navigation: [
      { label: 'Features', to: '#features' },
      { label: 'Pricing', to: '#pricing' },
      { label: 'Testimonials', to: '#testimonials' }
    ],
    cta: { label: 'Download App' }
  }
})
