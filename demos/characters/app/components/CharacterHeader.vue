<script setup lang="ts">
const { panels, activePanel, togglePanel } = useCharacterPanels()
</script>

<template>
  <div class="flex items-start justify-between p-4">
    <div class="flex items-center gap-3">
      <UDashboardSidebarToggle />
      <span class="text-lg font-semibold text-highlighted">Characters</span>
    </div>

    <!-- Panel buttons: mobile only -->
    <div class="flex flex-col gap-2 md:hidden">
      <button
        v-for="panel in panels"
        :key="panel.id"
        class="size-12 rounded-full flex items-center justify-center transition-colors"
        :class="activePanel === panel.id ? 'bg-accented' : 'bg-muted hover:bg-accented'"
        :aria-label="panel.label"
        @click="togglePanel(panel.id)"
      >
        <UIcon :name="panel.icon" class="size-5" />
      </button>
    </div>
  </div>
</template>
