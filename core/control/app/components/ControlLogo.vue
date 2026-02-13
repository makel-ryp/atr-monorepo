<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <UIcon name="i-lucide-terminal" class="size-5 text-primary shrink-0" />
    <span v-if="!collapsed" class="font-semibold text-sm truncate">Control Plane</span>
  </div>
</template>
