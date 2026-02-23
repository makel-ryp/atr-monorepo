<script setup lang="ts">
import type { Character } from '~/composables/useCharacters'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  comingSoon: []
}>()

// Generate multiple avatar variations for the carousel
const photos = computed(() => {
  const name = props.character.name
  const styles = ['lorelei', 'notionists']
  return styles.map((style, i) => ({
    id: i,
    url: `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
  }))
})

const activePhoto = ref(0)

// Reset photo index when character changes
watch(() => props.character.id, () => {
  activePhoto.value = 0
})

function prevPhoto() {
  activePhoto.value = activePhoto.value <= 0 ? photos.value.length - 1 : activePhoto.value - 1
}

function nextPhoto() {
  activePhoto.value = activePhoto.value >= photos.value.length - 1 ? 0 : activePhoto.value + 1
}

const aboutFields = computed(() => [
  { icon: 'i-lucide-cake', label: 'AGE', value: String(props.character.age) },
  { icon: 'i-lucide-person-standing', label: 'BODY', value: props.character.profile.body },
  { icon: 'i-lucide-globe', label: 'ETHNICITY', value: props.character.profile.ethnicity },
  { icon: 'i-lucide-languages', label: 'LANGUAGE', value: props.character.profile.language },
  { icon: 'i-lucide-heart', label: 'RELATIONSHIP', value: props.character.profile.relationship },
  { icon: 'i-lucide-briefcase', label: 'OCCUPATION', value: props.character.profile.occupation },
  { icon: 'i-lucide-sparkles', label: 'HOBBIES', value: props.character.profile.hobbies },
  { icon: 'i-lucide-smile', label: 'PERSONALITY', value: props.character.profile.personality },
])
</script>

<template>
  <div class="profile-panel">
    <!-- Hero image carousel -->
    <div class="profile-hero">
      <img
        :key="activePhoto"
        :src="photos[activePhoto].url"
        :alt="character.name"
        class="profile-hero__img"
      >

      <!-- Carousel arrows -->
      <button class="profile-hero__arrow profile-hero__arrow--left" @click="prevPhoto">
        <UIcon name="i-lucide-chevron-left" class="size-6" />
      </button>
      <button class="profile-hero__arrow profile-hero__arrow--right" @click="nextPhoto">
        <UIcon name="i-lucide-chevron-right" class="size-6" />
      </button>

      <!-- Dots -->
      <div class="profile-hero__dots">
        <button
          v-for="(photo, i) in photos"
          :key="photo.id"
          class="profile-hero__dot"
          :class="{ 'profile-hero__dot--active': i === activePhoto }"
          @click="activePhoto = i"
        />
      </div>
    </div>

    <!-- Info section -->
    <div class="profile-info">
      <h2 class="profile-info__name">{{ character.name }}</h2>
      <p class="profile-info__desc">{{ character.description }}</p>

      <!-- Action buttons -->
      <div class="profile-actions">
        <button class="profile-actions__call" @click="emit('comingSoon')">
          <UIcon name="i-lucide-phone" class="size-4" />
          Call Me
        </button>
        <button class="profile-actions__generate" @click="emit('comingSoon')">
          <UIcon name="i-lucide-image-plus" class="size-4" />
          Generate Image
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="profile-divider" />

    <!-- About section -->
    <div class="profile-about">
      <h3 class="profile-about__title">About me:</h3>

      <div class="profile-about__grid">
        <div
          v-for="field in aboutFields"
          :key="field.label"
          class="profile-about__item"
        >
          <div class="profile-about__icon-wrap">
            <UIcon :name="field.icon" class="size-5" />
          </div>
          <div class="profile-about__text">
            <span class="profile-about__label">{{ field.label }}</span>
            <span class="profile-about__value">{{ field.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-panel {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
}

/* Hero image carousel */
.profile-hero {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: rgb(31, 41, 55);
}

.profile-hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-hero__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px !important;
  background: rgba(0, 0, 0, 0.5) !important;
  color: white !important;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.profile-hero:hover .profile-hero__arrow {
  opacity: 1;
}

.profile-hero__arrow:hover {
  background: rgba(0, 0, 0, 0.7) !important;
}

.profile-hero__arrow--left {
  left: 0.5rem;
}

.profile-hero__arrow--right {
  right: 0.5rem;
}

.profile-hero__dots {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.375rem;
}

.profile-hero__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.4) !important;
  transition: all 0.2s;
}

.profile-hero__dot--active {
  background: white !important;
  width: 1rem;
}

/* Info */
.profile-info {
  padding: 1.25rem 1rem;
}

.profile-info__name {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
  margin: 0;
}

.profile-info__desc {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
}

/* Action buttons */
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.profile-actions__call {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem;
  border-radius: 0.625rem !important;
  background: rgb(34, 197, 94) !important;
  color: white !important;
  font-weight: 600;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.profile-actions__call:hover {
  background: rgb(22, 163, 74) !important;
}

.profile-actions__generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem;
  border-radius: 0.625rem !important;
  background: transparent !important;
  border: 1px solid var(--color-secondary-500) !important;
  color: var(--color-secondary-400) !important;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.profile-actions__generate:hover {
  background: color-mix(in oklch, var(--color-secondary-500) 10%, transparent) !important;
}

/* Divider */
.profile-divider {
  height: 1px;
  margin: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
}

/* About section */
.profile-about {
  padding: 0.75rem 1rem 1.5rem;
}

.profile-about__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 1rem;
}

.profile-about__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem 1rem;
}

.profile-about__item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.profile-about__icon-wrap {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.profile-about__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-about__label {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.profile-about__value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: white;
  margin-top: 0.125rem;
}
</style>
