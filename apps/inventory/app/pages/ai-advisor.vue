<script setup lang="ts">
interface InventoryRow {
  sku: string
  product_title: string | null
  order_status: string | null
  days_until_order_deadline: number | null
  reorder_qty_9mo_adj: number | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const { data: inventory } = await useFetch<InventoryRow[]>('/api/inventory')

const alerts = computed(() =>
  (inventory.value ?? []).filter(r =>
    r.order_status?.toLowerCase() === 'critical' || r.order_status?.toLowerCase() === 'warning'
  ).sort((a, b) => (a.days_until_order_deadline ?? 9999) - (b.days_until_order_deadline ?? 9999))
)

const SUGGESTED = [
  'What should we order this month?',
  'Which SKUs are most at risk?',
  'Show me the reorder math for SKU 2',
  'How does current stock compare to last quarter?',
]

const messages = ref<Message[]>([])
const input = ref('')
const loading = ref(false)
const scrollRef = ref<HTMLDivElement | null>(null)

function alertColor(status: string | null) {
  return status?.toLowerCase() === 'critical' ? 'error' : 'warning'
}

async function scrollToBottom() {
  await nextTick()
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return
  input.value = ''
  messages.value.push({ role: 'user', content })
  loading.value = true

  const assistantMsg: Message = { role: 'assistant', content: '' }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              assistantMsg.content += parsed.text
              await scrollToBottom()
            }
            if (parsed.error) {
              assistantMsg.content += `\n\n[Error: ${parsed.error}]`
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    assistantMsg.content = `Failed to reach AI advisor: ${err}`
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <UDashboardPanel class="min-w-0">
    <template #header>
      <UDashboardNavbar title="AI Advisor" />
    </template>

    <template #body>
    <div class="flex flex-col gap-4 h-full">

      <!-- Reorder alerts -->
      <div v-if="alerts.length" class="space-y-2">
        <UAlert
          v-for="row in alerts"
          :key="row.sku"
          :color="alertColor(row.order_status)"
          variant="soft"
          :title="`SKU ${row.sku} — ${row.product_title ?? ''}`"
          :description="`${row.order_status?.toUpperCase()} · ${row.days_until_order_deadline ?? '?'} days to deadline · Reorder qty: ${(row.reorder_qty_9mo_adj ?? 0).toLocaleString()} units`"
          :icon="row.order_status?.toLowerCase() === 'critical' ? 'i-lucide-alert-triangle' : 'i-lucide-alert-circle'"
        />
      </div>

      <!-- Chat area -->
      <div class="flex-1 flex flex-col min-h-0 bg-muted/30 rounded-lg overflow-hidden border">

        <!-- Message list -->
        <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-4">

          <!-- Suggested questions when empty -->
          <div v-if="messages.length === 0" class="space-y-3">
            <p class="text-sm text-muted text-center">Ask me anything about inventory, reorder quantities, or SKU performance.</p>
            <div class="flex flex-wrap gap-2 justify-center">
              <UButton
                v-for="q in SUGGESTED"
                :key="q"
                color="neutral"
                variant="outline"
                size="xs"
                @click="send(q)"
              >
                {{ q }}
              </UButton>
            </div>
          </div>

          <!-- Messages -->
          <div
            v-for="(msg, i) in messages"
            :key="i"
            :class="[
              'max-w-3xl',
              msg.role === 'user' ? 'ml-auto' : 'mr-auto',
            ]"
          >
            <div
              :class="[
                'rounded-lg px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-background border',
              ]"
            >
              <template v-if="msg.role === 'assistant' && !msg.content && loading">
                <div class="flex gap-1 items-center h-5">
                  <div class="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
                  <div class="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
                  <div class="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                </div>
              </template>
              <template v-else>{{ msg.content }}</template>
            </div>
          </div>
        </div>

        <!-- Input row -->
        <div class="border-t bg-background p-3 flex gap-2">
          <UTextarea
            v-model="input"
            placeholder="Ask about inventory, reorders, SKU performance…"
            :rows="1"
            autoresize
            class="flex-1"
            :disabled="loading"
            @keydown="handleKey"
          />
          <UButton
            :loading="loading"
            :disabled="!input.trim()"
            icon="i-lucide-send"
            @click="send()"
          />
        </div>
      </div>

    </div>
    </template>
  </UDashboardPanel>
</template>
