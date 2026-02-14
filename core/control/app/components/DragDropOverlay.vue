<script setup lang="ts">
defineProps<{
  show: boolean
}>()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-lg pointer-events-none"
    >
      <div class="text-center">
        <div class="flex items-center justify-center gap-2">
          <UIcon name="i-lucide-file-text" class="size-10" />
          <UIcon name="i-lucide-file" class="size-12" />
          <UIcon name="i-lucide-file-spreadsheet" class="size-10" />
        </div>
        <p class="text-lg font-medium mt-4">
          Drop your files here
        </p>
        <p class="text-sm text-muted">
          Images, PDFs, CSV files
        </p>
      </div>
    </div>
  </Transition>
</template>
