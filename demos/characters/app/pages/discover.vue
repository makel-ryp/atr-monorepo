<script setup lang="ts">
const { characters } = useCharacters()

const currentIndex = ref(0)
const transitioning = ref(false)
const direction = ref<'up' | 'down'>('up')

// Shuffle characters on mount
const shuffled = ref<typeof characters.value>([])
onMounted(() => {
  const arr = [...characters]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  shuffled.value = arr
})

const currentChar = computed(() => shuffled.value[currentIndex.value])
const hasNext = computed(() => currentIndex.value < shuffled.value.length - 1)
const hasPrev = computed(() => currentIndex.value > 0)

function goNext() {
  if (!hasNext.value || transitioning.value) return
  direction.value = 'up'
  transitioning.value = true
  currentIndex.value++
  setTimeout(() => { transitioning.value = false }, 400)
}

function goPrev() {
  if (!hasPrev.value || transitioning.value) return
  direction.value = 'down'
  transitioning.value = true
  currentIndex.value--
  setTimeout(() => { transitioning.value = false }, 400)
}

// Wheel handler — accumulate delta and only fire once threshold is reached
let wheelLocked = false
let accumulatedDelta = 0
const WHEEL_THRESHOLD = 150

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (wheelLocked) {
    // Discard inertia events while locked so they don't pile up
    accumulatedDelta = 0
    return
  }

  accumulatedDelta += e.deltaY
  if (Math.abs(accumulatedDelta) < WHEEL_THRESHOLD) return

  const dir = accumulatedDelta > 0 ? 'next' : 'prev'
  accumulatedDelta = 0
  wheelLocked = true

  if (dir === 'next') goNext()
  else goPrev()

  // Lock long enough to eat the full trackpad inertia tail
  setTimeout(() => { wheelLocked = false; accumulatedDelta = 0 }, 1200)
}

// Touch swipe support
let touchStartY = 0
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
}
function onTouchEnd(e: TouchEvent) {
  const deltaY = touchStartY - e.changedTouches[0].clientY
  if (Math.abs(deltaY) < 50) return
  if (deltaY > 0) goNext()
  else goPrev()
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'j') goNext()
  else if (e.key === 'ArrowUp' || e.key === 'k') goPrev()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <UDashboardPanel id="discover" :ui="{ body: 'p-0 sm:p-0' }">
    <template #body>
      <div
        class="relative h-full w-full overflow-hidden select-none flex items-center justify-center bg-black"
        @wheel.prevent="onWheel"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- Transition wraps the entire reel so the rounded frame slides as one unit -->
        <Transition :name="direction === 'up' ? 'slide-up' : 'slide-down'" mode="out-in">
          <div
            v-if="currentChar"
            :key="currentChar.id"
            class="discover-reel"
          >
            <!-- Full-bleed avatar -->
            <img
              :src="currentChar.avatar"
              :alt="currentChar.name"
              class="absolute inset-0 size-full object-cover"
            >

            <!-- Gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            <!-- Capability badges (top-right) -->
            <div class="absolute top-4 right-4 flex items-center gap-2 z-10">
              <div
                v-if="currentChar.isNew"
                class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/90 text-xs font-bold text-white"
              >
                <UIcon name="i-lucide-zap" class="size-3.5" />
                New
              </div>
              <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/80 text-xs font-medium text-white">
                <UIcon name="i-lucide-gamepad-2" class="size-3" />
                Play
              </div>
              <div
                v-if="currentChar.hasAudio"
                class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-500/80 text-xs font-medium text-white"
              >
                <UIcon name="i-lucide-headphones" class="size-3" />
                Audio
              </div>
            </div>

            <!-- Mobile: hamburger menu (top-left) -->
            <div class="absolute top-4 left-4 z-10 md:hidden">
              <UDashboardSidebarToggle class="text-white/70" />
            </div>

            <!-- Desktop: counter (top-left) -->
            <div class="absolute top-4 left-4 text-white/50 text-sm font-medium z-10 hidden md:block">
              {{ currentIndex + 1 }} / {{ shuffled.length }}
            </div>

            <!-- Bottom content -->
            <div class="absolute bottom-0 inset-x-0 p-5 z-10">
              <!-- Name, age & chat button -->
              <div class="flex items-center gap-3">
                <h1 class="text-2xl sm:text-3xl font-bold text-white">
                  {{ currentChar.name }}
                  <span class="text-xl sm:text-2xl font-normal text-white/70">{{ currentChar.age }}</span>
                </h1>
                <NuxtLink
                  :to="`/chat?character=${currentChar.id}`"
                  class="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white transition-colors active:scale-95 shrink-0"
                >
                  <UIcon name="i-lucide-message-circle" class="size-4" />
                  Chat
                </NuxtLink>
              </div>

              <!-- Description -->
              <p class="text-sm text-white/60 mt-2 leading-relaxed line-clamp-3">
                {{ currentChar.description }}
              </p>

              <!-- Tags -->
              <div class="flex flex-wrap gap-1.5 mt-3">
                <span
                  v-for="tag in currentChar.tags"
                  :key="tag"
                  class="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] text-white/70 capitalize"
                >
                  {{ tag }}
                </span>
              </div>

              <!-- Swipe hint -->
              <p class="text-white/30 text-xs mt-3">
                Scroll or swipe to browse
              </p>
            </div>
          </div>
        </Transition>

        <!-- Empty state -->
        <div v-if="shuffled.length === 0" class="discover-reel flex items-center justify-center">
          <div class="text-center">
            <UIcon name="i-lucide-compass" class="size-12 text-white/20 mx-auto mb-3" />
            <p class="text-muted">Loading characters...</p>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* Reels container: full-bleed on mobile, phone-shaped on desktop */
.discover-reel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

@media (min-width: 768px) {
  .discover-reel {
    width: 100%;
    max-width: 420px;
    aspect-ratio: 9 / 16;
    max-height: calc(100% - 4rem);
    border-radius: 1.25rem;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
}

/* Slide up transition (next card) */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(60px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-60px);
}

/* Slide down transition (previous card) */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-60px);
}
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(60px);
}
</style>
