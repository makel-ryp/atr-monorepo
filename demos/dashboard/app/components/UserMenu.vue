<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <CoreUserMenu :collapsed="collapsed" />
</template>
