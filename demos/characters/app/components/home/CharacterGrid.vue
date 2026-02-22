<script setup lang="ts">
const { characters } = useCharacters()

const search = ref('')
const activeTag = ref('All')

const tags = ['All', 'Brunette', 'Blonde', 'Redhead', 'Asian', 'Latina', 'Creative', 'Athletic', 'Alternative']

const filtered = computed(() => {
  let result = [...characters]

  const q = search.value.trim().toLowerCase()
  if (q) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(q)
      || c.description.toLowerCase().includes(q)
      || c.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  if (activeTag.value !== 'All') {
    const tag = activeTag.value.toLowerCase()
    result = result.filter(c => c.tags.some(t => t.toLowerCase() === tag))
  }

  return result
})
</script>

<template>
  <div>
    <!-- Header -->
    <h2 class="text-xl sm:text-2xl font-bold mb-4">
      <span class="text-pink-500">AI</span> Characters
    </h2>

    <!-- Search + filter tags -->
    <div class="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
      <div class="relative shrink-0">
        <UIcon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/40 pointer-events-none" />
        <input
          v-model="search"
          type="text"
          placeholder="Search"
          class="w-32 sm:w-40 pl-8 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        >
      </div>
      <button
        v-for="tag in tags"
        :key="tag"
        class="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
        :class="activeTag === tag
          ? 'bg-purple-600 text-white'
          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'"
        @click="activeTag = tag"
      >
        {{ tag }}
      </button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div
        v-for="char in filtered"
        :key="char.id"
        class="relative rounded-xl overflow-hidden bg-gray-800 group cursor-pointer aspect-[3/4]"
        @click="navigateTo(`/chat?character=${char.id}`)"
      >
        <!-- Avatar image -->
        <img
          :src="char.avatar"
          :alt="char.name"
          class="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
        >

        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        <!-- New badge -->
        <div
          v-if="char.isNew"
          class="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-[10px] font-bold text-white"
        >
          <UIcon name="i-lucide-zap" class="size-2.5" />
          New
        </div>

        <!-- Bottom info -->
        <div class="absolute bottom-0 inset-x-0 p-3">
          <p class="font-bold text-white text-sm">{{ char.name }} <span class="font-normal text-white/70">{{ char.age }}</span></p>
          <p class="text-[11px] text-white/50 line-clamp-2 mt-0.5 leading-relaxed">{{ char.description }}</p>

          <!-- Action buttons -->
          <div class="flex items-center gap-1.5 mt-2">
            <button class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-600/80 hover:bg-purple-500 text-[10px] font-medium text-white transition-colors">
              <UIcon name="i-lucide-gamepad-2" class="size-3" />
              Play
            </button>
            <button
              v-if="char.hasAudio"
              class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-600/80 hover:bg-pink-500 text-[10px] font-medium text-white transition-colors"
            >
              <UIcon name="i-lucide-headphones" class="size-3" />
              Audio
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-search-x" class="size-8 text-white/30 mx-auto mb-2" />
      <p class="text-muted text-sm">No characters match your search</p>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
