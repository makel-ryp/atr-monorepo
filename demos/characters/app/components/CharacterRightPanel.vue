<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const { activeSidePanel, closePanel } = useCharacterPanels()
</script>

<template>
  <div
    v-if="activeSidePanel"
    v-bind="$attrs"
    class="fixed inset-0 z-50 bg-elevated md:relative md:inset-auto md:z-auto md:w-1/3 md:shrink-0 md:bg-elevated/80 border-l border-default flex flex-col"
  >
    <!-- Header -->
    <div class="shrink-0 flex items-center gap-2 px-4 py-4 border-b border-default">
      <h3 class="flex-1 text-lg font-semibold text-highlighted truncate">{{ activeSidePanel.label }}</h3>
      <button
        class="size-8 shrink-0 rounded-full flex items-center justify-center text-muted hover:text-highlighted hover:bg-accented transition-colors md:hidden"
        aria-label="Close panel"
        @click="closePanel()"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <template v-if="activeSidePanel.id === 'home'">
        <p class="text-muted">Home feed will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'discover'">
        <p class="text-muted">Discover characters will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'collection'">
        <p class="text-muted">Your collection will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'generate-image'">
        <p class="text-muted">Image generation will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'create-character'">
        <p class="text-muted">Character creator will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'my-ai'">
        <p class="text-muted">Your AI characters will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'chat'">
        <p class="text-muted">Chat history will appear here.</p>
      </template>

      <template v-else-if="activeSidePanel.id === 'settings'">
        <p class="text-muted">Settings will appear here.</p>
      </template>

      <template v-else>
        <p class="text-muted">Coming soon...</p>
      </template>
    </div>
  </div>
</template>
