<script setup lang="ts">
const { liveCharacters } = useCharacters()

const scrollContainer = ref<HTMLElement | null>(null)
const fadeLeft = ref(false)
const fadeRight = ref(true)

function scrollRight() {
  scrollContainer.value?.scrollBy({ left: 300, behavior: 'smooth' })
}

function scrollLeft() {
  scrollContainer.value?.scrollBy({ left: -300, behavior: 'smooth' })
}

function updateFades() {
  const el = scrollContainer.value
  if (!el) return
  fadeLeft.value = el.scrollLeft > 8
  fadeRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 8
}

onMounted(() => {
  nextTick(updateFades)
})

const maskClass = computed(() => {
  if (fadeLeft.value && fadeRight.value) return 'fade-both'
  if (fadeLeft.value) return 'fade-left'
  if (fadeRight.value) return 'fade-right'
  return ''
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <h2 class="text-xl sm:text-2xl font-bold">
        <span class="text-secondary-500">Jump into</span>
      </h2>
      <span class="px-3 py-0.5 rounded border border-white/20 text-sm font-bold text-white">LIVE</span>
      <span class="text-sm font-bold text-white/80">ACTION</span>
      <span class="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/60 uppercase tracking-wider">Beta</span>
    </div>

    <!-- Scrollable cards with arrows -->
    <div class="relative">
      <!-- Masked scroll area -->
      <div :class="maskClass">
        <div
          ref="scrollContainer"
          class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
          @scroll="updateFades"
        >
          <div
            v-for="char in liveCharacters"
            :key="char.id"
            class="relative shrink-0 w-40 sm:w-44 h-56 sm:h-64 rounded-xl overflow-hidden bg-gray-800 group cursor-pointer"
            @click="navigateTo(`/chat?character=${char.id}`)"
          >
            <!-- Avatar image -->
            <img
              :src="char.avatar"
              :alt="char.name"
              class="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
            >

            <!-- Gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <!-- LIVE badge -->
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
              <span class="size-2 rounded-full bg-green-500 animate-pulse" />
              <span class="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
            </div>

            <!-- Bottom info -->
            <div class="absolute bottom-0 inset-x-0 p-3">
              <p class="font-bold text-white text-sm">{{ char.name }} <span class="font-normal text-white/70">{{ char.age }}</span></p>
              <button class="mt-1.5 flex items-center gap-1 px-3 py-1 rounded-full bg-primary-600/80 hover:bg-primary-500 text-[11px] font-medium text-white transition-colors">
                <UIcon name="i-lucide-gamepad-2" class="size-3" />
                Play with me
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll arrows (desktop only, outside mask so they're not faded) -->
      <button
        v-if="fadeLeft"
        class="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center z-20 transition-colors"
        @click="scrollLeft"
      >
        <UIcon name="i-lucide-chevron-left" class="size-5" />
      </button>
      <button
        v-if="fadeRight"
        class="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center z-20 transition-colors"
        @click="scrollRight"
      >
        <UIcon name="i-lucide-chevron-right" class="size-5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

.fade-right {
  -webkit-mask-image: linear-gradient(to right, black 80%, transparent);
  mask-image: linear-gradient(to right, black 80%, transparent);
}

.fade-left {
  -webkit-mask-image: linear-gradient(to left, black 80%, transparent);
  mask-image: linear-gradient(to left, black 80%, transparent);
}

.fade-both {
  -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
}
</style>
