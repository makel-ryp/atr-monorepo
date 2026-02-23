<script setup lang="ts">
const currentSlide = ref(0)
const slides = [
  { id: 1, title: 'Image Generator', subtitle: 'Create the perfect image in seconds', cta: 'Generate Now', accent: 'Choose your setting, poses, and actions', gradient: 'from-primary-900/80 via-secondary-900/60 to-transparent' },
  { id: 2, title: 'New Characters', subtitle: 'Discover fresh personalities weekly', cta: 'Explore', accent: 'Unique stories and conversations await', gradient: 'from-blue-900/80 via-indigo-900/60 to-transparent' },
  { id: 3, title: 'Audio Chat', subtitle: 'Hear your characters come to life', cta: 'Try Now', accent: 'Realistic voice conversations', gradient: 'from-emerald-900/80 via-teal-900/60 to-transparent' },
  { id: 4, title: 'Create Your Own', subtitle: 'Build a character from scratch', cta: 'Start Creating', accent: 'Full customization and personality design', gradient: 'from-amber-900/80 via-orange-900/60 to-transparent' }
]

let interval: ReturnType<typeof setInterval> | undefined

function startAutoplay() {
  interval = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % slides.length
  }, 5000)
}

function goTo(index: number) {
  currentSlide.value = index
  if (interval) clearInterval(interval)
  startAutoplay()
}

function prev() {
  goTo((currentSlide.value - 1 + slides.length) % slides.length)
}

function next() {
  goTo((currentSlide.value + 1) % slides.length)
}

onMounted(startAutoplay)
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<template>
  <div class="relative rounded-xl overflow-hidden h-48 sm:h-56 md:h-64 bg-gray-900 group">
    <!-- Slides -->
    <div
      v-for="(slide, i) in slides"
      :key="slide.id"
      class="absolute inset-0 transition-opacity duration-700"
      :class="i === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <!-- Gradient background -->
      <div class="absolute inset-0 bg-gradient-to-r" :class="slide.gradient" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      <!-- Content -->
      <div class="relative h-full flex items-center justify-end px-8 sm:px-12">
        <div class="text-right">
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white uppercase">{{ slide.title }}</h2>
          <p class="text-sm sm:text-base text-white/80 mt-1">{{ slide.subtitle }}</p>
          <p class="text-xs sm:text-sm text-secondary-400 mt-0.5">{{ slide.accent }}</p>
          <button class="mt-3 px-6 py-2 rounded-full bg-secondary-600 hover:bg-secondary-500 text-white text-sm font-bold uppercase tracking-wide transition-colors">
            {{ slide.cta }}
          </button>
        </div>
      </div>
    </div>

    <!-- Prev/Next arrows -->
    <button
      class="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
      @click="prev"
    >
      <UIcon name="i-lucide-chevron-left" class="size-5" />
    </button>
    <button
      class="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
      @click="next"
    >
      <UIcon name="i-lucide-chevron-right" class="size-5" />
    </button>

    <!-- Dots -->
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
      <button
        v-for="(slide, i) in slides"
        :key="slide.id"
        class="h-1 rounded-full transition-all"
        :class="i === currentSlide ? 'w-6 bg-white' : 'w-3 bg-white/40 hover:bg-white/60'"
        @click="goTo(i)"
      />
    </div>
  </div>
</template>
