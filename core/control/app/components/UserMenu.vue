<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const providers = [
  { label: 'GitHub', icon: 'i-simple-icons-github', id: 'github' }
]
</script>

<template>
  <CoreUserMenu :collapsed="collapsed" :providers="providers" />
</template>
