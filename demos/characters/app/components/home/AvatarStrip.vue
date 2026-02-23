<script setup lang="ts">
const { featuredCharacters } = useCharacters()

// First 6 get colored rings, rest get muted rings
const ringColors = [
  'ring-secondary-500',
  'ring-secondary-400',
  'ring-primary-500',
  'ring-secondary-400',
  'ring-primary-400',
  'ring-secondary-500'
]

// Scroll fade edges via CSS mask on wrapper
const scrollRef = ref<HTMLElement>()
const fadeLeft = ref(false)
const fadeRight = ref(true)

function updateFades() {
  const el = scrollRef.value
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
  <div :class="maskClass" class="avatar-strip-mask">
    <div
      ref="scrollRef"
      class="flex gap-4 sm:gap-5 overflow-x-auto pt-1 px-1 pb-2 scrollbar-hide"
      @scroll="updateFades"
    >
      <button
        v-for="(char, i) in featuredCharacters"
        :key="char.id"
        class="flex flex-col items-center gap-1.5 shrink-0 group"
        @click="navigateTo(`/chat?character=${char.id}`)"
      >
        <div
          class="size-16 sm:size-18 rounded-full ring-2 p-0.5 transition-transform group-hover:scale-105"
          :class="i < ringColors.length ? ringColors[i] : 'ring-gray-600'"
        >
          <img
            :src="char.avatar"
            :alt="char.name"
            class="size-full rounded-full object-cover bg-gray-800"
          >
        </div>
        <span class="text-xs text-muted truncate max-w-16 sm:max-w-18">{{ char.name }}</span>
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
