---
seo:
  title: Documentation
  description: Welcome to the documentation.
---

::u-page-hero
---
orientation: horizontal
---

#title
Documentation

#description
Welcome to the documentation. Your docs live in the `/docs/` folder at the root of your project.

#links
  :::u-button
  ---
  to: /internal/app-agent
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  App Agent Reference
  :::

  :::u-button
  ---
  icon: i-lucide-bot
  color: neutral
  variant: outline
  size: xl
  to: /internal/app-agent/ai/mcp
  ---
  AI Integration
  :::
::

::u-page-section
#title
Getting Started

#description
Add your documentation to the `/docs/` folder. It will automatically appear in the navigation.

#features
  :::u-page-feature
  ---
  icon: i-lucide-folder
  ---
  #title
  Your Docs

  #description
  Create `.md` files in `/docs/` to add documentation pages.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-lock
  ---
  #title
  Internal Reference

  #description
  App Agent documentation is in [/internal/app-agent](/internal/app-agent).
  :::

  :::u-page-feature
  ---
  icon: i-lucide-bot
  ---
  #title
  AI-Powered

  #description
  The MCP server gives AI assistants full access to all documentation.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-pen-line
  ---
  #title
  Easy to Write

  #description
  Use Markdown with [MDC components](/internal/app-agent/essentials).
  :::
::
