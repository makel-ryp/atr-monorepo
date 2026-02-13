---
title: i18n Layer Cascade
description: How internationalization cascades across Nuxt layers with locale merging and Nuxt UI bridge
---

## Overview

i18n is a core layer concern configured once in `core/nuxt.config.ts` and inherited by all apps via the layer cascade. `@nuxtjs/i18n` handles routing (prefix strategy), lazy-loaded locale files, and browser detection. A bridge composable (`useUiLocale`) maps the active locale to Nuxt UI's locale system for component-level localization.

Three locales ship by default: English, Spanish, French. Locale files are namespaced by layer (`core.*`, `org.*`, `app.*`) and deep-merged via the standard layer cascade.

## FAQ

**How do apps get i18n without configuring it?**
The `@nuxtjs/i18n` module is in core's modules array. Since modules are additive across layers, every app that extends organization (which extends core) inherits it automatically.

**How does locale switching work?**
Strategy is `prefix_except_default` — English URLs have no prefix (`/page`), other locales use prefixes (`/es/page`, `/fr/page`). Browser detection sets the initial locale via cookie (`i18n_locale`).

**What is `useUiLocale()`?**
A feature composable that maps `@nuxtjs/i18n`'s active locale to Nuxt UI's built-in locale data. Returns a reactive `ComputedRef` for the `<UApp :locale>` prop. Auto-imported by Nuxt.

**Why is there a separate bridge plugin?**
The plugin (`i18n-bridge.client.ts`) calls `useUiLocale()` and sets `<html lang>` and `<html dir>` reactively via `useHead`. This runs automatically so HTML attributes stay correct even if an app.vue forgets to call the composable.

**How do I add translations for my app?**
Create `apps/my-app/i18n/locales/{en,es,fr}.json` with keys under the `app.*` namespace. The layer cascade merges them with core and org translations.

## Reasoning

i18n belongs in core because locale routing, browser detection, and HTML attribute management are cross-cutting concerns. Putting it in individual apps would mean duplicating configuration and risking inconsistent behavior. The namespace convention (`core.*`, `org.*`, `app.*`) prevents key collisions while allowing each layer to own its strings.

The `useUiLocale` composable exists because Nuxt UI has its own locale system separate from `@nuxtjs/i18n`. Without the bridge, UI components (buttons, modals, date pickers) would always render in English regardless of the active i18n locale.

## Details

### Configuration

Core i18n config (`core/nuxt.config.ts`):
- `lazy: true` — locale files loaded on demand
- `langDir` — points to `core/i18n/locales/`
- `strategy: 'prefix_except_default'` — no prefix for default locale
- `detectBrowserLanguage` — cookie-based with `i18n_locale` key
- Three locales: `en` (English, default), `es` (Spanish), `fr` (French)

### File Locations

| Layer | Path | Namespace |
|-------|------|-----------|
| Core | `core/i18n/locales/{locale}.json` | `core.*` |
| Organization | `organization/i18n/locales/{locale}.json` | `org.*` |
| App | `apps/*/i18n/locales/{locale}.json` | `app.*` |

### Key Files

- `core/app/composables/useUiLocale.ts` — feature composable, maps i18n locale to Nuxt UI locale
- `core/app/plugins/i18n-bridge.client.ts` — auto-sets `<html lang>` and `<html dir>`
- `core/app/composables/defineFeatureComposable.ts` — wrapper factory used by `useUiLocale`

### Usage in app.vue

```vue
<script setup lang="ts">
const uiLocale = useUiLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <p>{{ $t('core.actions.save') }}</p>
  </UApp>
</template>
```
