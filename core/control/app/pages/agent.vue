<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { useClipboard } from '@vueuse/core'
import { getTextFromMessage } from '@nuxt/ui/utils/ai'

const toast = useToast()
const clipboard = useClipboard()
const { model, models } = useModels()
const hasProvider = computed(() => models.value.length > 0)

const input = ref('')

const {
  dropzoneRef,
  isDragging,
  files,
  isReading,
  readyFiles,
  addFiles,
  removeFile,
  clearFiles
} = useFileUploadLocal()

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: '/api/control/agent/chat',
    body: {
      model: model.value
    }
  }),
  onError(error) {
    const { message } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error
    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0
    })
  }
})

async function handleSubmit(e: Event) {
  e.preventDefault()
  if (input.value.trim() && !isReading.value) {
    chat.sendMessage({
      text: input.value,
      files: readyFiles.value.length > 0 ? readyFiles.value : undefined
    })
    input.value = ''
    clearFiles()
  }
}

const copied = ref(false)

function copy(_e: MouseEvent, message: UIMessage) {
  clipboard.copy(getTextFromMessage(message))
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function getFileName(url: string): string {
  try {
    if (url.startsWith('data:')) {
      const mimeType = url.split(';')[0]?.split(':')[1] || 'file'
      const ext = mimeType.split('/')[1] || 'bin'
      return `file.${ext}`
    }
    const urlObj = new URL(url)
    const filename = urlObj.pathname.split('/').pop() || 'file'
    return decodeURIComponent(filename)
  }
  catch {
    return 'file'
  }
}
</script>

<template>
  <UDashboardPanel id="agent" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar title="Agent" />
    </template>

    <template #body>
      <div class="agent-bg absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div v-if="!hasProvider" class="relative flex flex-col items-center justify-center h-64 text-center gap-3">
        <UIcon name="i-lucide-bot" class="size-12 text-muted opacity-30" />
        <p class="text-muted">AI provider not configured.</p>
        <p class="text-sm text-muted">
          Set <code>AI_PROVIDER_URL</code>, <code>AI_PROVIDER_KEY</code>, and <code>AI_PROVIDER_MODEL</code> env vars to enable the agent.
        </p>
      </div>
      <template v-else>
        <DragDropOverlay :show="isDragging" />
        <UContainer ref="dropzoneRef" class="flex-1 flex flex-col gap-4 sm:gap-6">
          <UChatMessages
            should-auto-scroll
            :messages="chat.messages"
            :status="chat.status"
            :assistant="chat.status !== 'streaming' ? { actions: [{ label: 'Copy', icon: copied ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy }] } : { actions: [] }"
            :spacing-offset="160"
            class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
          >
            <template #content="{ message }">
              <template v-for="(part, index) in message.parts" :key="`${message.id}-${part.type}-${index}${'state' in part ? `-${part.state}` : ''}`">
                <MDCCached
                  v-if="part.type === 'text' && message.role === 'assistant'"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}`"
                  :parser-options="{ highlight: false }"
                  class="*:first:mt-0 *:last:mb-0"
                />
                <p v-else-if="part.type === 'text' && message.role === 'user'" class="whitespace-pre-wrap">
                  {{ part.text }}
                </p>
                <div v-else-if="isToolUIPart(part)" class="my-2 rounded-lg border border-default bg-muted/50 overflow-hidden">
                  <div class="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted">
                    <UIcon
                      :name="part.state === 'output-available' ? 'i-lucide-check-circle' : part.state === 'output-error' ? 'i-lucide-alert-circle' : 'i-lucide-loader-circle'"
                      :class="[
                        'size-4',
                        part.state === 'output-available' && 'text-success',
                        part.state === 'output-error' && 'text-error',
                        (part.state === 'input-streaming' || part.state === 'input-available') && 'animate-spin'
                      ]"
                    />
                    <span>{{ part.type.replace('tool-', '') }}</span>
                    <span v-if="part.input && Object.keys(part.input).length" class="text-dimmed">
                      ({{ Object.entries(part.input).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(', ') }})
                    </span>
                  </div>
                  <pre v-if="part.state === 'output-available' && part.output" class="px-3 py-2 text-xs overflow-x-auto border-t border-default max-h-64 overflow-y-auto">{{ JSON.stringify(part.output, null, 2) }}</pre>
                  <p v-else-if="part.state === 'output-error'" class="px-3 py-2 text-xs text-error border-t border-default">
                    {{ part.errorText || 'Tool execution failed' }}
                  </p>
                </div>
                <FileAvatar
                  v-else-if="part.type === 'file'"
                  :name="getFileName(part.url)"
                  :type="part.mediaType"
                  :preview-url="part.url"
                />
              </template>
            </template>
          </UChatMessages>

          <UChatPrompt
            v-model="input"
            :error="chat.error"
            :disabled="isReading"
            variant="subtle"
            class="sticky bottom-0 [view-transition-name:chat-prompt] rounded-b-none z-10"
            :ui="{ base: 'px-1.5' }"
            @submit="handleSubmit"
          >
            <template v-if="files.length > 0" #header>
              <div class="flex flex-wrap gap-2">
                <FileAvatar
                  v-for="fileWithStatus in files"
                  :key="fileWithStatus.id"
                  :name="fileWithStatus.file.name"
                  :type="fileWithStatus.file.type"
                  :preview-url="fileWithStatus.previewUrl"
                  :status="fileWithStatus.status"
                  :error="fileWithStatus.error"
                  removable
                  @remove="removeFile(fileWithStatus.id)"
                />
              </div>
            </template>

            <template #footer>
              <div class="flex items-center gap-1">
                <FileUploadButton @files-selected="addFiles($event)" />
                <ModelSelect />
              </div>

              <UChatPromptSubmit
                :status="chat.status"
                :disabled="isReading"
                color="neutral"
                size="sm"
                @stop="chat.stop()"
                @reload="chat.regenerate()"
              />
            </template>
          </UChatPrompt>
        </UContainer>
      </template>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.agent-bg {
  background:
    radial-gradient(ellipse 80% 60% at 10% 90%, oklch(0.75 0.12 250 / 0.15), transparent),
    radial-gradient(ellipse 60% 50% at 85% 20%, oklch(0.72 0.10 290 / 0.12), transparent),
    radial-gradient(ellipse 50% 40% at 50% 50%, oklch(0.78 0.08 200 / 0.08), transparent);
}

:root.dark .agent-bg {
  background:
    radial-gradient(ellipse 80% 60% at 10% 90%, oklch(0.35 0.12 250 / 0.25), transparent),
    radial-gradient(ellipse 60% 50% at 85% 20%, oklch(0.30 0.10 290 / 0.20), transparent),
    radial-gradient(ellipse 50% 40% at 50% 50%, oklch(0.32 0.08 200 / 0.15), transparent);
}
</style>
