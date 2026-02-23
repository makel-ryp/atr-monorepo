export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: Date
}

/** Render inline markdown to HTML (safe for streaming — escapes HTML first). */
export function renderInlineMarkdown(text: string): string {
  // Escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // Code (backticks) — must come before bold/italic to avoid conflicts
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  return html
}

export interface ChatListItem {
  id: string
  characterId: string
  characterName: string
  characterAvatar: string
  lastMessage: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export function useChatList() {
  const { data: chats, status, refresh } = useFetch<ChatListItem[]>('/api/chats', {
    default: () => []
  })

  return { chats, status, refresh }
}

export function useCharacterChat(chatId: Ref<string | null>) {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const streamingText = ref('')
  const error = ref<string | null>(null)

  // Load messages when chatId changes
  watch(chatId, async (id) => {
    if (!id) {
      messages.value = []
      return
    }
    await loadMessages(id)
  }, { immediate: true })

  async function loadMessages(id: string) {
    try {
      const chat = await $fetch<any>(`/api/chats/${id}`)
      messages.value = (chat.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: new Date(m.createdAt)
      }))
    }
    catch (err: any) {
      error.value = err.message || 'Failed to load messages'
    }
  }

  async function sendMessage(text: string) {
    if (!chatId.value || !text.trim() || isLoading.value) return

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text.trim(),
      createdAt: new Date()
    }
    messages.value.push(userMsg)

    isLoading.value = true
    streamingText.value = ''
    error.value = null

    // Add placeholder for assistant response
    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      createdAt: new Date()
    }
    messages.value.push(assistantMsg)

    try {
      const response = await fetch(`/api/chats/${chatId.value}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Read the SSE stream (data: {json}\n\n format)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        // Keep the last partial line in the buffer
        buffer = parts.pop() || ''

        for (const line of parts) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6)
          let data: any
          try {
            data = JSON.parse(jsonStr)
          }
          catch {
            // JSON parse error, skip malformed line
            continue
          }

          if (data.type === 'error') {
            throw new Error(data.errorText || 'AI streaming error')
          }

          if (data.type === 'text-delta' && data.delta) {
            accumulated += data.delta
            const idx = messages.value.findIndex(m => m.id === assistantId)
            if (idx !== -1) {
              messages.value[idx] = { ...messages.value[idx], text: accumulated }
            }
          }
        }
      }
    }
    catch (err: any) {
      error.value = err.message || 'Failed to send message'
      // Remove the empty assistant message on error
      const idx = messages.value.findIndex(m => m.id === assistantId)
      if (idx !== -1 && !messages.value[idx].text) {
        messages.value.splice(idx, 1)
      }
    }
    finally {
      isLoading.value = false
      streamingText.value = ''
    }
  }

  return {
    messages,
    isLoading,
    streamingText,
    error,
    sendMessage,
    loadMessages
  }
}

export async function createOrGetChat(characterId: string): Promise<any> {
  return $fetch('/api/chats', {
    method: 'POST',
    body: { characterId }
  })
}
