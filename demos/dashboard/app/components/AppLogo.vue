<script setup lang="ts">
// Logo pulled from organization config
const { header } = useAppConfig()
</script>

<template>
  <img
    v-if="header?.logo?.light"
    :src="header.logo.light"
    :alt="header.logo.alt || header.title || 'Logo'"
    class="h-full w-auto"
  >
  <span v-else class="font-semibold">
    {{ header?.title || 'App' }}
  </span>
</template>
