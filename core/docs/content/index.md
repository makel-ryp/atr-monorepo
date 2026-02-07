---
seo:
  title: Documentation
  description: Welcome to your documentation hub.
---

::u-page-hero
---
orientation: horizontal
---

#title
Documentation

#description
Your team's knowledge hub. Write documentation in `/docs/` - it automatically appears here.

#links
  :::u-button
  ---
  to: /internal/app-agent/documentation
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  Start Writing Docs
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
Add documentation to the `/docs/` folder at your repository root. Changes appear instantly.

#features
  :::u-page-feature
  ---
  icon: i-lucide-folder
  ---
  #title
  Write in /docs/

  #description
  Create `.md` files in `/docs/` - they appear here automatically.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-git-merge
  ---
  #title
  No Merge Conflicts

  #description
  Your docs in `/docs/` stay separate from upstream updates.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-bot
  ---
  #title
  AI-Powered

  #description
  The [MCP server](/internal/app-agent/ai/mcp) gives AI assistants full documentation access.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-pen-line
  ---
  #title
  Easy to Write

  #description
  Use Markdown with [MDC components](/internal/app-agent/documentation).
  :::
::

::u-page-section
#title
Documentation Structure

#description
Two types of documentation, two locations:

#features
  :::u-page-feature
  ---
  icon: i-lucide-lock
  ---
  #title
  Internal Docs

  #description
  `/docs/internal/**` → merges into the [Internal](/internal) section alongside App Agent reference.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-globe
  ---
  #title
  Top-Level Docs

  #description
  `/docs/**` (except internal) → creates new top-level sections like `/company/` or `/guides/`.
  :::
::

::u-page-section
---
align: left
---
#title
Always Running

#description
The documentation server runs on `localhost:3000` during development. This is intentional - your team and AI assistants need access to documentation at all times.

```bash
bun run dev        # Docs + your apps
bun run dev:demos  # Docs + demo apps
bun run dev:docs   # Just docs
```
::
