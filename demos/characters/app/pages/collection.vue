<script setup lang="ts">
const { characters } = useCharacters()

const selectedId = ref<string | null>(null)
const selectedCharacter = computed(() =>
  selectedId.value ? characters.find(c => c.id === selectedId.value) || null : null
)

// Generate deterministic mock photos per character using picsum.photos
function getPhotos(character: { id: string, name: string }) {
  // Seed-based count: 1–6 photos per character
  const count = 1 + (character.name.length % 6)
  return Array.from({ length: count }, (_, i) => ({
    id: `${character.id}-${i}`,
    url: `https://picsum.photos/seed/${encodeURIComponent(character.name)}-${i}/400/500`
  }))
}

// Show the same characters that appear in the chat sidebar
const chatCharacters = computed(() => characters.slice(0, 3))

const characterPhotos = computed(() =>
  chatCharacters.value.map(c => ({
    character: c,
    photos: getPhotos(c)
  }))
)

const activePhotos = computed(() =>
  selectedCharacter.value ? getPhotos(selectedCharacter.value) : []
)

function selectCharacter(id: string) {
  selectedId.value = id
}

function goBack() {
  selectedId.value = null
}
</script>

<template>
  <UDashboardPanel id="collection" :ui="{ body: 'p-0 sm:p-0' }">
    <template #body>
      <div class="flex flex-col h-full min-h-0">
        <!-- Top bar -->
        <PageTopbar>
          <template #left>
            <template v-if="selectedCharacter">
              <button class="text-xl sm:text-2xl font-bold text-white hover:text-white/80 transition-colors" @click="goBack">
                My Collection
              </button>
              <UIcon name="i-lucide-chevron-right" class="size-5 text-white/40 shrink-0" />
              <img
                :src="selectedCharacter.avatar"
                :alt="selectedCharacter.name"
                class="size-8 rounded-full object-cover bg-gray-800 shrink-0"
              >
              <span class="text-lg font-bold text-white truncate">{{ selectedCharacter.name }}</span>
            </template>
            <template v-else>
              <UDashboardSidebarToggle class="md:hidden" />
              <span class="text-xl sm:text-2xl font-bold text-white">My Collection</span>
            </template>
          </template>

          <template #right>
            <button class="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
              Sort by
              <UIcon name="i-lucide-arrow-up-down" class="size-4" />
            </button>
          </template>
        </PageTopbar>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6">
          <!-- Character detail: photo grid -->
          <div v-if="selectedCharacter" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div
              v-for="photo in activePhotos"
              :key="photo.id"
              class="aspect-[3/4] rounded-xl overflow-hidden bg-gray-800"
            >
              <img
                :src="photo.url"
                :alt="selectedCharacter.name"
                class="size-full object-cover"
                loading="lazy"
              >
            </div>
          </div>

          <!-- Character list: stacked photo cards -->
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <button
              v-for="entry in characterPhotos"
              :key="entry.character.id"
              class="text-left group"
              @click="selectCharacter(entry.character.id)"
            >
              <!-- Character info -->
              <div class="flex items-center gap-2.5 mb-2.5">
                <img
                  :src="entry.character.avatar"
                  :alt="entry.character.name"
                  class="size-9 rounded-full object-cover bg-gray-800 shrink-0"
                >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-white truncate">{{ entry.character.name }}</p>
                  <p class="flex items-center gap-1 text-xs text-white/40">
                    <UIcon name="i-lucide-image" class="size-3" />
                    {{ entry.photos.length }}
                  </p>
                </div>
              </div>

              <!-- Photo preview with stack shadow when multiple photos -->
              <div
                class="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-800 group-hover:scale-[1.02] transition-transform"
                :class="entry.photos.length > 1 ? 'photo-stack' : ''"
              >
                <img
                  :src="entry.photos[0].url"
                  :alt="entry.character.name"
                  class="size-full object-cover"
                  loading="lazy"
                >
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.photo-stack {
  box-shadow:
    4px 4px 0 0 rgb(55, 65, 81),
    8px 8px 0 0 rgb(45, 55, 72);
}
</style>
