<script setup lang="ts">
const { characters } = useCharacters()
const route = useRoute()

// Active chat and character state
const activeChatId = ref<string | null>(null)
const activeCharacterId = ref<string | null>(null)

const character = computed(() =>
  activeCharacterId.value
    ? characters.value.find(c => c.id === activeCharacterId.value) || null
    : null
)

// Chat list — owned here, shared with sidebar via props
const { chats, refresh: refreshChats } = useChatList()

// Chat composable — streams AI responses
const { messages, isLoading, sendMessage, error } = useCharacterChat(activeChatId)

const input = ref('')
const chatContainer = ref<HTMLElement | null>(null)

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// Auto-scroll when messages change
watch(messages, () => scrollToBottom(), { deep: true })

// Select an existing chat from the sidebar
async function selectChat(chatId: string, characterId: string) {
  activeChatId.value = chatId
  activeCharacterId.value = characterId
  scrollToBottom()
}

// Start a new chat with a character (from ?character= param or direct)
async function startChat(characterId: string) {
  activeCharacterId.value = characterId
  try {
    const chat = await createOrGetChat(characterId)
    activeChatId.value = chat.id
    await refreshChats()
    scrollToBottom()
  }
  catch (err: any) {
    console.error('Failed to create chat:', err)
  }
}

// Reactive ?character= handler — works on initial load and in-page navigation
watch(
  () => route.query.character as string | undefined,
  async (characterId) => {
    if (!characterId) return
    // Wait for characters data to be available
    if (characters.value.length === 0) {
      await new Promise<void>((resolve) => {
        const stop = watch(characters, (chars) => {
          if (chars.length > 0) {
            stop()
            resolve()
          }
        }, { immediate: true })
      })
    }
    const found = characters.value.find(c => c.id === characterId)
    if (found) {
      await startChat(found.id)
    }
  },
  { immediate: true }
)

// Auto-select latest chat when entering bare /chat (no ?character= param)
watch(chats, (chatList) => {
  if (activeChatId.value || route.query.character) return
  if (chatList.length > 0) {
    selectChat(chatList[0].id, chatList[0].characterId)
  }
}, { immediate: true })

const quickActions = [
  'Tell me about yourself',
  'What are your hobbies?'
]

const hasUserMessage = computed(() => messages.value.some(m => m.role === 'user'))

async function handleSendMessage(text?: string) {
  const msg = text || input.value.trim()
  if (!msg) return
  input.value = ''
  await sendMessage(msg)
  scrollToBottom()
  // Refresh sidebar to update last message
  await refreshChats()
}

function handleSubmit(e: Event) {
  e.preventDefault()
  handleSendMessage()
}

const toast = useToast()

function comingSoon() {
  toast.add({ title: 'Feature coming soon', icon: 'i-lucide-construction' })
}

const profileOpen = ref(true)

function resetChat() {
  if (activeCharacterId.value) {
    startChat(activeCharacterId.value)
  }
}

const menuItems = [[
  { label: 'Reset chat', icon: 'i-lucide-rotate-ccw', click: resetChat },
  { label: 'Delete chat', icon: 'i-lucide-trash-2', click: comingSoon }
]]

// Mobile view state: 'list' | 'chat' | 'profile'
const mobileView = ref<'list' | 'chat' | 'profile'>('list')

// If navigated here with ?character=, jump straight to chat on mobile
if (route.query.character) {
  mobileView.value = 'chat'
}

function mobileSelectChat(chatId: string, characterId: string) {
  selectChat(chatId, characterId)
  mobileView.value = 'chat'
}

function mobileShowProfile() {
  mobileView.value = 'profile'
}

function mobileBackToChat() {
  mobileView.value = 'chat'
}

function mobileBackToList() {
  mobileView.value = 'list'
}

onMounted(scrollToBottom)

// Custom resize for profile panel
const profileWidth = ref(24)
const isResizingProfile = ref(false)
const profileResized = ref(false)
const minProfileWidth = 18
const maxProfileWidth = 30

let styleEl: HTMLStyleElement | null = null

function updateProfileStyleRule(width: number) {
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.setAttribute('data-profile-resize', '')
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `#dashboard-panel-chat-profile { --width: ${width}rem !important; }`
}

onUnmounted(() => {
  styleEl?.remove()
  styleEl = null
})

function getRemSize() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize)
}

function startProfileResize(e: MouseEvent) {
  e.preventDefault()
  isResizingProfile.value = true
  profileResized.value = true
  const startX = e.clientX
  const startWidth = profileWidth.value
  const remSize = getRemSize()

  function onMouseMove(ev: MouseEvent) {
    const deltaPx = startX - ev.clientX
    const deltaRem = deltaPx / remSize
    const newWidth = Math.min(maxProfileWidth, Math.max(minProfileWidth, startWidth + deltaRem))
    profileWidth.value = newWidth
    updateProfileStyleRule(newWidth)
  }

  function onMouseUp() {
    isResizingProfile.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <!-- ==================== DESKTOP LAYOUT (md+) ==================== -->
  <UDashboardPanel
    id="chat-list"
    :default-size="22.5"
    :min-size="15"
    :max-size="28"
    resizable
    :ui="{ body: 'p-0 sm:p-0' }"
    class="hidden md:flex"
  >
    <template #body>
      <ChatSidebar :chats="chats" :active-id="activeChatId || ''" @select="selectChat" />
    </template>
  </UDashboardPanel>

  <UDashboardPanel id="chat" :ui="{ body: 'p-0 sm:p-0' }" class="hidden md:flex">
    <template #body>
      <div class="chat-page">
        <!-- No active chat state -->
        <template v-if="!character">
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <UIcon name="i-lucide-message-circle" class="size-12 text-white/20 mx-auto mb-3" />
              <p class="text-white/50 text-sm">Select a character to start chatting</p>
            </div>
          </div>
        </template>

        <!-- Active chat -->
        <template v-else>
          <PageTopbar>
            <template #left>
              <img
                :src="character.avatar"
                :alt="character.name"
                class="chat-topbar__avatar"
              >
              <span class="chat-topbar__name">{{ character.name }}</span>
            </template>
            <template #right>
              <button class="chat-topbar__btn chat-topbar__btn--phone" @click="comingSoon">
                <UIcon name="i-lucide-phone" class="size-5" />
              </button>
              <UDropdownMenu :items="menuItems">
                <button class="chat-topbar__btn">
                  <UIcon name="i-lucide-ellipsis-vertical" class="size-5" />
                </button>
              </UDropdownMenu>
              <button class="chat-topbar__btn" @click="profileOpen = !profileOpen">
                <UIcon :name="profileOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'" class="size-5" />
              </button>
            </template>
          </PageTopbar>

          <div ref="chatContainer" class="chat-messages">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-msg"
              :class="msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--assistant'"
            >
              <div class="chat-bubble" :class="msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'">
                <span v-if="msg.text" v-html="renderInlineMarkdown(msg.text)" />
                <span v-else-if="msg.role === 'assistant' && isLoading" class="animate-pulse">Typing...</span>
              </div>
              <div v-if="msg.text || msg.role === 'user'" class="chat-msg__meta">
                <img v-if="msg.role === 'assistant'" :src="character.avatar" :alt="character.name" class="chat-msg__meta-avatar">
                <span class="chat-msg__time">{{ formatTime(msg.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Error display -->
          <div v-if="error" class="px-4 md:px-8 pb-2">
            <div class="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {{ error }}
            </div>
          </div>

          <div v-if="!hasUserMessage" class="chat-quick-actions">
            <button v-for="action in quickActions" :key="action" class="quick-action" @click="handleSendMessage(action)">
              {{ action }}
            </button>
          </div>

          <ChatInputBar v-model="input" :disabled="isLoading" @submit="handleSubmit" @coming-soon="comingSoon" />
        </template>
      </div>
    </template>
  </UDashboardPanel>

  <UDashboardPanel
    v-if="profileOpen && character"
    id="chat-profile"
    :default-size="24"
    :ui="{ body: 'p-0 sm:p-0' }"
    class="hidden md:flex"
  >
    <template #resize-handle>
      <div
        class="profile-resize-handle"
        :class="{ 'profile-resize-handle--active': isResizingProfile }"
        :style="{ right: profileWidth + 'rem' }"
        @mousedown="startProfileResize"
      />
    </template>
    <template #body>
      <ChatProfilePanel :character="character" @coming-soon="comingSoon" />
    </template>
  </UDashboardPanel>

  <!-- ==================== MOBILE LAYOUT (<md) ==================== -->
  <UDashboardPanel id="chat-mobile" :ui="{ body: 'p-0 sm:p-0' }" class="flex md:hidden">
    <template #body>
      <!-- Mobile: Chat list -->
      <div v-if="mobileView === 'list'" class="chat-page">
        <ChatSidebar :chats="chats" :active-id="activeChatId || ''" @select="mobileSelectChat" />
      </div>

      <!-- Mobile: Chat conversation -->
      <div v-else-if="mobileView === 'chat'" class="chat-page">
        <template v-if="character">
          <PageTopbar>
            <template #left>
              <button class="chat-topbar__btn" @click="mobileBackToList">
                <UIcon name="i-lucide-arrow-left" class="size-5" />
              </button>
              <button class="flex items-center gap-2 min-w-0" @click="mobileShowProfile">
                <img :src="character.avatar" :alt="character.name" class="chat-topbar__avatar !size-9">
                <span class="chat-topbar__name">{{ character.name }}</span>
              </button>
            </template>
            <template #right>
              <UDropdownMenu :items="menuItems">
                <button class="chat-topbar__btn">
                  <UIcon name="i-lucide-ellipsis-vertical" class="size-5" />
                </button>
              </UDropdownMenu>
            </template>
          </PageTopbar>

          <div ref="chatContainer" class="chat-messages">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-msg"
              :class="msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--assistant'"
            >
              <div class="chat-bubble" :class="msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'">
                <span v-if="msg.text" v-html="renderInlineMarkdown(msg.text)" />
                <span v-else-if="msg.role === 'assistant' && isLoading" class="animate-pulse">Typing...</span>
              </div>
              <div v-if="msg.text || msg.role === 'user'" class="chat-msg__meta">
                <img v-if="msg.role === 'assistant'" :src="character.avatar" :alt="character.name" class="chat-msg__meta-avatar">
                <span class="chat-msg__time">{{ formatTime(msg.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="error" class="px-4 pb-2">
            <div class="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {{ error }}
            </div>
          </div>

          <div v-if="!hasUserMessage" class="chat-quick-actions">
            <button v-for="action in quickActions" :key="action" class="quick-action" @click="handleSendMessage(action)">
              {{ action }}
            </button>
          </div>

          <ChatInputBar v-model="input" :disabled="isLoading" @submit="handleSubmit" @coming-soon="comingSoon" />
        </template>
        <template v-else>
          <div class="flex-1 flex items-center justify-center">
            <p class="text-white/50 text-sm">Select a character to start chatting</p>
          </div>
        </template>
      </div>

      <!-- Mobile: Profile overlay -->
      <div v-else-if="mobileView === 'profile'" class="chat-page">
        <PageTopbar>
          <template #left>
            <button class="chat-topbar__btn" @click="mobileBackToChat">
              <UIcon name="i-lucide-arrow-left" class="size-5" />
            </button>
            <span class="chat-topbar__name">{{ character?.name }}</span>
          </template>
        </PageTopbar>
        <div class="flex-1 overflow-y-auto">
          <ChatProfilePanel v-if="character" :character="character" @coming-soon="comingSoon" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* Page layout */
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Top bar child styles */
.chat-topbar__avatar {
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border-radius: 9999px !important;
  object-fit: cover;
  background: rgb(31, 41, 55);
}

.chat-topbar__name {
  font-weight: 700;
  font-size: 1.125rem;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-topbar__btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.15s;
}

.chat-topbar__btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.05);
}

.chat-topbar__btn--phone {
  color: rgb(34, 197, 94);
}

.chat-topbar__btn--phone:hover {
  color: rgb(74, 222, 128);
}

/* Messages area */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.chat-msg {
  display: flex;
  flex-direction: column;
  padding: 0 1rem;
}

@media (min-width: 768px) {
  .chat-msg {
    padding: 0 2rem;
  }
}

.chat-msg--user {
  align-items: flex-end;
}

.chat-msg--assistant {
  align-items: flex-start;
}

/* Chat bubbles */
.chat-bubble {
  max-width: 75%;
  padding: 0.75rem 1.125rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  border-radius: 1.25rem !important;
  white-space: pre-wrap;
}

.chat-bubble :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.chat-bubble :deep(del) {
  opacity: 0.6;
}

.chat-bubble--user {
  background: var(--color-primary-600) !important;
  color: white !important;
  border-bottom-right-radius: 0.375rem !important;
}

.chat-bubble--assistant {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-bottom-left-radius: 0.375rem !important;
}

/* Timestamp row */
.chat-msg__meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.375rem;
  padding: 0 0.25rem;
}

.chat-msg__meta-avatar {
  width: 1rem;
  height: 1rem;
  border-radius: 9999px !important;
  object-fit: cover;
  background: rgb(31, 41, 55);
}

.chat-msg__time {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.3);
}

/* Quick actions */
.chat-quick-actions {
  flex-shrink: 0;
  padding: 0 1rem 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

@media (min-width: 768px) {
  .chat-quick-actions {
    padding: 0 2rem 0.375rem;
    flex-direction: row;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .chat-quick-actions::-webkit-scrollbar {
    display: none;
  }
}

.quick-action {
  flex-shrink: 0;
  padding: 0.375rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-primary-300);
  border-radius: 9999px !important;
  border: 1px solid color-mix(in oklch, var(--color-primary-600) 50%, transparent);
  transition: all 0.15s;
  text-align: center;
}

.quick-action:hover {
  background: color-mix(in oklch, var(--color-primary-600) 10%, transparent);
}

/* Profile resize handle */
.profile-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
  z-index: 10;
}

.profile-resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  right: -3px;
  z-index: 10;
}

.profile-resize-handle:hover::before,
.profile-resize-handle--active::before {
  background: rgba(255, 255, 255, 0.08);
}
</style>

<!-- Unscoped: uniform resize handles for both panels -->
<style>
[aria-controls="dashboard-panel-chat-list"]::before {
  left: -3px !important;
  right: -3px !important;
}
[aria-controls="dashboard-panel-chat-list"]:hover::before {
  background: rgba(255, 255, 255, 0.08);
}
</style>
