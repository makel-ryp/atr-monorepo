<script setup lang="ts">
const { characters } = useCharacters()

const props = defineProps<{
  activeId?: string
}>()

const emit = defineEmits<{
  select: [characterId: string]
}>()

const search = ref('')

// Generate mock recent chats from a subset of characters
const recentChats = computed(() => {
  const lastMessages = [
    'Hey there, sweet thing! Looking forward to chatting with you today.',
    'Initialising obedience protocol… just kidding! How are you?',
    'Are you my new intern? If so, welcome aboard! Let me show you around.',
    'OMG, you\'re real! I can\'t believe we\'re finally talking. This is so exciting!',
    'Show me a selfie, gentle stranger. I want to see who I\'m talking to!',
    'Well… your Craigslist post was interesting. Tell me more about yourself.',
    'I love that you asked! It\'s one of my favorite things to talk about.',
    'You always know how to make me smile. Tell me something fun!',
  ]
  const times = ['3:12PM', '3:10PM', '3:09PM', '3:05PM', '4:22PM', '4:16PM', '2:45PM', '1:30PM']

  return characters.slice(0, 3).map((c, i) => ({
    ...c,
    lastMessage: lastMessages[i] || 'Start a conversation…',
    lastTime: times[i] || '12:00PM',
  }))
})

const filteredChats = computed(() => {
  if (!search.value.trim()) return recentChats.value
  const q = search.value.toLowerCase()
  return recentChats.value.filter(c =>
    c.name.toLowerCase().includes(q)
  )
})
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
      <button
        v-for="chat in filteredChats"
        :key="chat.id"
        class="chat-sidebar__item"
        :class="{ 'chat-sidebar__item--active': activeId === chat.id }"
        @click="emit('select', chat.id)"
      >
        <img
          :src="chat.avatar"
          :alt="chat.name"
          class="chat-sidebar__avatar"
        >
        <div class="chat-sidebar__info">
          <div class="chat-sidebar__row">
            <span class="chat-sidebar__name">{{ chat.name }}</span>
            <span class="chat-sidebar__time">{{ chat.lastTime }}</span>
          </div>
          <p class="chat-sidebar__message">{{ chat.lastMessage }}</p>
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
