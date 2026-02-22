<script setup lang="ts">
const { characters } = useCharacters()
const route = useRoute()

// Support navigating here with ?character=<id> from the homepage
const initialId = (route.query.character as string) || characters[0].id
const activeCharacterId = ref(characters.some(c => c.id === initialId) ? initialId : characters[0].id)
const character = computed(() =>
  characters.find(c => c.id === activeCharacterId.value) || characters[0]
)

function selectChat(characterId: string) {
  activeCharacterId.value = characterId
  // Reset messages for the newly selected character
  const selected = characters.find(c => c.id === characterId) || characters[0]
  messages.value = [{
    id: crypto.randomUUID(),
    role: 'assistant' as const,
    text: `Hey there! I'm ${selected.name}. ${selected.description} What would you like to talk about?`,
    timestamp: new Date(Date.now() - 60000)
  }]
  scrollToBottom()
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  image?: string
  timestamp: Date
}

const initialCharacter = characters.find(c => c.id === activeCharacterId.value) || characters[0]
const messages = ref<ChatMessage[]>([
  {
    id: '1',
    role: 'assistant',
    text: `Hey there! I'm ${initialCharacter.name}. ${initialCharacter.description} What would you like to talk about?`,
    timestamp: new Date(Date.now() - 60000)
  }
])

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

const quickActions = [
  'Tell me about yourself',
  'What are your hobbies?',
  'Send me a photo'
]

function sendMessage(text?: string) {
  const msg = text || input.value.trim()
  if (!msg) return

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    text: msg,
    timestamp: new Date()
  })

  input.value = ''
  scrollToBottom()

  // Simulate assistant reply
  setTimeout(() => {
    const replies = [
      "That's really sweet of you to say! I'd love to hear more about what's on your mind.",
      "Hmm, interesting question! Let me think about that for a moment...",
      "I love that you asked! It's one of my favorite topics to talk about.",
      "You always know how to make me smile! Tell me more.",
      "Oh, I have so many thoughts on that! Where do I even start?"
    ]
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      text: replies[Math.floor(Math.random() * replies.length)],
      timestamp: new Date()
    })
    scrollToBottom()
  }, 800 + Math.random() * 1200)
}

function handleSubmit(e: Event) {
  e.preventDefault()
  sendMessage()
}

const toast = useToast()

function comingSoon() {
  toast.add({ title: 'Feature coming soon', icon: 'i-lucide-construction' })
}

const profileOpen = ref(true)

const menuItems = [[
  { label: 'Reset chat', icon: 'i-lucide-rotate-ccw', click: () => selectChat(activeCharacterId.value) },
  { label: 'Delete chat', icon: 'i-lucide-trash-2', click: comingSoon }
]]

// Mobile view state: 'list' | 'chat' | 'profile'
const mobileView = ref<'list' | 'chat' | 'profile'>('list')

// If navigated here with ?character=, jump straight to chat on mobile
if (route.query.character) {
  mobileView.value = 'chat'
}

function mobileSelectChat(characterId: string) {
  selectChat(characterId)
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

// Custom resize for profile panel (left-edge handle).
// We inject a <style> rule to override the panel's --width because Vue's
// reactive style binding replaces inline styles on re-render.
const profileWidth = ref(24) // rem
const isResizingProfile = ref(false)
const profileResized = ref(false) // true once user has dragged
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
    // Dragging left = increase width, dragging right = decrease width
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
      <ChatSidebar :active-id="activeCharacterId" @select="selectChat" />
    </template>
  </UDashboardPanel>

  <UDashboardPanel id="chat" :ui="{ body: 'p-0 sm:p-0' }" class="hidden md:flex">
    <template #body>
      <div class="chat-page">
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
            <div v-if="msg.image" class="chat-msg__image">
              <img :src="msg.image" :alt="'Image from ' + (msg.role === 'assistant' ? character.name : 'you')">
            </div>
            <div class="chat-bubble" :class="msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'">
              {{ msg.text }}
            </div>
            <div class="chat-msg__meta">
              <img v-if="msg.role === 'assistant'" :src="character.avatar" :alt="character.name" class="chat-msg__meta-avatar">
              <span class="chat-msg__time">{{ formatTime(msg.timestamp) }}</span>
            </div>
          </div>
        </div>

        <div class="chat-quick-actions">
          <button v-for="action in quickActions" :key="action" class="quick-action" @click="sendMessage(action)">
            {{ action }}
          </button>
        </div>

        <ChatInputBar v-model="input" @submit="handleSubmit" @coming-soon="comingSoon" />
      </div>
    </template>
  </UDashboardPanel>

  <UDashboardPanel
    v-if="profileOpen"
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
        <ChatSidebar :active-id="activeCharacterId" @select="mobileSelectChat" />
      </div>

      <!-- Mobile: Chat conversation -->
      <div v-else-if="mobileView === 'chat'" class="chat-page">
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
            <div v-if="msg.image" class="chat-msg__image">
              <img :src="msg.image" :alt="'Image from ' + (msg.role === 'assistant' ? character.name : 'you')">
            </div>
            <div class="chat-bubble" :class="msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'">
              {{ msg.text }}
            </div>
            <div class="chat-msg__meta">
              <img v-if="msg.role === 'assistant'" :src="character.avatar" :alt="character.name" class="chat-msg__meta-avatar">
              <span class="chat-msg__time">{{ formatTime(msg.timestamp) }}</span>
            </div>
          </div>
        </div>

        <div class="chat-quick-actions">
          <button v-for="action in quickActions" :key="action" class="quick-action" @click="sendMessage(action)">
            {{ action }}
          </button>
        </div>

        <ChatInputBar v-model="input" @submit="handleSubmit" @coming-soon="comingSoon" />
      </div>

      <!-- Mobile: Profile overlay -->
      <div v-else-if="mobileView === 'profile'" class="chat-page">
        <PageTopbar>
          <template #left>
            <button class="chat-topbar__btn" @click="mobileBackToChat">
              <UIcon name="i-lucide-arrow-left" class="size-5" />
            </button>
            <span class="chat-topbar__name">{{ character.name }}</span>
          </template>
        </PageTopbar>
        <div class="flex-1 overflow-y-auto">
          <ChatProfilePanel :character="character" @coming-soon="comingSoon" />
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

.chat-msg__image {
  overflow: hidden;
  margin-bottom: 0.5rem;
  max-width: 240px;
  border-radius: 0.75rem !important;
}

.chat-msg__image img {
  width: 100%;
  display: block;
}

/* Chat bubbles */
.chat-bubble {
  max-width: 75%;
  padding: 0.75rem 1.125rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  border-radius: 1.25rem !important;
}

.chat-bubble--user {
  background: rgb(147, 51, 234) !important;
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

/* Quick actions — stacked on mobile, horizontal on desktop */
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
  color: rgb(196, 181, 253);
  border-radius: 9999px !important;
  border: 1px solid rgba(147, 51, 234, 0.5);
  transition: all 0.15s;
  text-align: center;
}

.quick-action:hover {
  background: rgba(147, 51, 234, 0.1);
}

/* Profile panel uses defaultSize for proper flex/width classes.
   During drag, we set --width with !important to override useResizable's binding. */

/* Custom left-edge resize handle for profile panel.
   The slot renders as a sibling of the panel inside the fixed group container,
   so we use absolute positioning with a dynamic `right` value. */
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

/* Clickable area via pseudo-element — symmetric 3px each side (6px total) */
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
