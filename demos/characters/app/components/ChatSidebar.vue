<script setup lang="ts">
const { characters } = useCharacters()

const props = defineProps<{
  chats: ChatListItem[]
  activeId?: string
}>()

const emit = defineEmits<{
  select: [chatId: string, characterId: string]
  newChat: [characterId: string]
}>()

const search = ref('')

// Merge chat list with character data, adding avatar fallback
const chatItems = computed(() => {
  return props.chats.map(chat => {
    const character = characters.value.find(c => c.id === chat.characterId)
    return {
      ...chat,
      characterAvatar: chat.characterAvatar || (character?.avatar ?? ''),
      characterName: chat.characterName || (character?.name ?? 'Unknown')
    }
  })
})

const filteredChats = computed(() => {
  if (!search.value.trim()) return chatItems.value
  const q = search.value.toLowerCase()
  return chatItems.value.filter(c =>
    c.characterName.toLowerCase().includes(q)
  )
})

function formatTime(dateStr: string | Date): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

</script>

<template>
  <div class="chat-sidebar">
    <!-- Sticky header: hamburger + search -->
    <div class="chat-sidebar__header">
      <UDashboardSidebarToggle class="chat-sidebar__hamburger md:hidden" />
      <div class="chat-sidebar__search">
        <UIcon name="i-lucide-search" class="chat-sidebar__search-icon" />
        <input
          v-model="search"
          type="text"
          placeholder="Search for a profile..."
          class="chat-sidebar__search-input"
        >
      </div>
    </div>

    <!-- Chat list -->
    <div class="chat-sidebar__list">
      <div v-if="filteredChats.length === 0" class="px-4 py-8 text-center">
        <p class="text-sm text-white/40">No conversations yet</p>
        <p class="text-xs text-white/30 mt-1">Select a character to start chatting</p>
      </div>
      <button
        v-for="chat in filteredChats"
        :key="chat.id"
        class="chat-sidebar__item"
        :class="{ 'chat-sidebar__item--active': activeId === chat.id }"
        @click="emit('select', chat.id, chat.characterId)"
      >
        <img
          :src="chat.characterAvatar"
          :alt="chat.characterName"
          class="chat-sidebar__avatar"
        >
        <div class="chat-sidebar__info">
          <div class="chat-sidebar__row">
            <span class="chat-sidebar__name">{{ chat.characterName }}</span>
            <span class="chat-sidebar__time">{{ formatTime(chat.lastMessageAt) }}</span>
          </div>
          <p class="chat-sidebar__message">{{ chat.lastMessage || 'Start a conversation…' }}</p>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.chat-sidebar__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  position: sticky;
  top: 0;
  z-index: 5;
}

.chat-sidebar__hamburger {
  flex-shrink: 0;
}

.chat-sidebar__search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 0.75rem !important;
}

.chat-sidebar__search-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.4);
}

.chat-sidebar__search-input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  color: white;
  font-size: 0.9375rem;
  padding: 0;
}

.chat-sidebar__search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.chat-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chat-sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.875rem 0.75rem;
  border-radius: 0.75rem !important;
  transition: background 0.15s;
  text-align: left;
}

.chat-sidebar__item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.chat-sidebar__item--active {
  background: rgba(255, 255, 255, 0.08) !important;
}

.chat-sidebar__avatar {
  width: 3.25rem;
  height: 3.25rem;
  flex-shrink: 0;
  border-radius: 9999px !important;
  object-fit: cover;
  background: rgb(31, 41, 55);
}

.chat-sidebar__info {
  flex: 1;
  min-width: 0;
}

.chat-sidebar__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.chat-sidebar__name {
  font-weight: 700;
  font-size: 0.9375rem;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-sidebar__time {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.chat-sidebar__message {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
