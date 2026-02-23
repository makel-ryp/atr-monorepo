<script setup lang="ts">
defineProps<{
  disabled?: boolean
}>()

const input = defineModel<string>({ default: '' })

const emit = defineEmits<{
  submit: [e: Event]
  comingSoon: []
}>()

function onSubmit(e: Event) {
  e.preventDefault()
  if (input.value.trim()) {
    emit('submit', e)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    onSubmit(e)
  }
}

const textareaRef = ref<HTMLTextAreaElement>()

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(input, () => nextTick(autoResize))
</script>

<template>
  <div class="chat-input-wrapper">
    <div class="chat-input-card">
      <form @submit.prevent="onSubmit">
        <textarea
          ref="textareaRef"
          v-model="input"
          rows="1"
          placeholder="Write a message..."
          :disabled="disabled"
          class="chat-textarea"
          @keydown="onKeydown"
        />
      </form>

      <div class="chat-input-actions">
        <div class="chat-input-actions__left">
          <button
            type="button"
            class="chat-input-icon-btn"
            aria-label="Send image"
            @click="emit('comingSoon')"
          >
            <UIcon name="i-lucide-image" class="size-5" />
          </button>
          <button
            type="button"
            class="chat-input-icon-btn"
            aria-label="Send video"
            @click="emit('comingSoon')"
          >
            <UIcon name="i-lucide-video" class="size-5" />
          </button>
        </div>

        <button
          type="button"
          class="chat-send-btn"
          aria-label="Send"
          @click="onSubmit($event)"
        >
          <UIcon name="i-lucide-send" class="size-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input-wrapper {
  flex-shrink: 0;
  padding: 0.375rem 1rem 1rem;
}

@media (min-width: 768px) {
  .chat-input-wrapper {
    padding: 0.375rem 2rem 1rem;
  }
}

.chat-input-card {
  background: rgba(255, 255, 255, 0.07);
  border-radius: 1.25rem !important;
  padding: 0.75rem 1rem 0.625rem;
}

.chat-textarea {
  display: block;
  width: 100%;
  background: transparent !important;
  padding: 0.25rem 0.25rem;
  color: white;
  border: none !important;
  outline: none !important;
  resize: none;
  overflow: hidden;
  line-height: 1.5;
  font-size: 0.9375rem;
  box-shadow: none !important;
}

.chat-textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.chat-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.375rem;
}

.chat-input-actions__left {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chat-input-icon-btn {
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}

.chat-input-icon-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

.chat-send-btn {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 9999px !important;
  background: var(--color-primary-600) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white !important;
  transition: all 0.15s;
}

.chat-send-btn:hover {
  background: var(--color-primary-700) !important;
}
</style>
