<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

const slug = ref('')
const level = ref('')
const since = ref('1 hour')
const limit = ref(50)
const liveMode = ref(false)

const queryParams = computed(() => ({
  slug: slug.value || undefined,
  level: level.value || undefined,
  since: since.value || undefined,
  limit: limit.value
}))

const { data: logs, refresh: refreshLogs } = await useFetch('/api/control/logs', {
  query: queryParams
})

const { data: summary, refresh: refreshSummary } = await useFetch('/api/control/logs/summary', {
  query: computed(() => ({ since: since.value || undefined }))
})

function refreshAll() {
  refreshLogs()
  refreshSummary()
}

// --- Live streaming via SSE ---
const streamUrl = computed(() => {
  if (!liveMode.value) return ''
  const params = new URLSearchParams()
  if (slug.value) params.set('slug', slug.value)
  if (level.value) params.set('level', level.value)
  const qs = params.toString()
  return `/api/control/logs/stream${qs ? `?${qs}` : ''}`
})

const liveEntries = ref<any[]>([])
let eventSource: EventSource | null = null

watch(liveMode, (live) => {
  if (live) {
    liveEntries.value = []
    startStream()
  } else {
    stopStream()
    refreshAll()
  }
})

// Restart stream when filters change during live mode
watch([slug, level], () => {
  if (liveMode.value) {
    stopStream()
    liveEntries.value = []
    startStream()
  }
})

function startStream() {
  if (!import.meta.client) return
  stopStream()
  const url = streamUrl.value
  if (!url) return

  eventSource = new EventSource(url)
  eventSource.addEventListener('log', (e) => {
    try {
      const entry = JSON.parse(e.data)
      liveEntries.value = [entry, ...liveEntries.value].slice(0, 200)
    }
    catch {}
  })
  eventSource.onerror = () => {
    // Will auto-reconnect per SSE spec
  }
}

function stopStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

onUnmounted(() => stopStream())

// Displayed entries: live entries in live mode, fetched logs otherwise
const displayedLogs = computed(() => {
  return liveMode.value ? liveEntries.value : (logs.value || [])
})

// --- Polling fallback (when not in live mode) ---
const autoRefresh = ref(false)
const { pause, resume } = useIntervalFn(() => refreshAll(), 5000, { immediate: false })

watch(autoRefresh, (val) => {
  if (val) resume()
  else pause()
})

// Turn off polling when entering live mode
watch(liveMode, (live) => {
  if (live) {
    autoRefresh.value = false
    pause()
  }
})

const levelOptions = [
  { label: 'All Levels', value: '' },
  { label: 'Log', value: 'log' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' }
]

const sinceOptions = [
  { label: '5 minutes', value: '5 minutes' },
  { label: '30 minutes', value: '30 minutes' },
  { label: '1 hour', value: '1 hour' },
  { label: '24 hours', value: '24 hours' },
  { label: 'All time', value: '' }
]

const levelColor: Record<string, string> = {
  error: 'error',
  warn: 'warning',
  log: 'neutral'
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}
</script>

<template>
  <UDashboardPanel id="logs">
    <template #header>
      <UDashboardNavbar title="Logs">
        <template #right>
          <div class="flex items-center gap-2">
            <USwitch v-model="liveMode" size="sm" />
            <span class="text-sm" :class="liveMode ? 'text-primary font-medium' : 'text-muted'">
              <UIcon v-if="liveMode" name="i-lucide-radio" class="size-3.5 inline animate-pulse" />
              {{ liveMode ? 'Live' : 'Live' }}
            </span>

            <template v-if="!liveMode">
              <USwitch v-model="autoRefresh" size="sm" />
              <span class="text-sm text-muted">Poll</span>
            </template>

            <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refreshAll()" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-6">
        <!-- Summary bar -->
        <div v-if="summary" class="flex items-center gap-6 text-sm">
          <span><strong>{{ summary.total }}</strong> total</span>
          <span v-for="bl in summary.byLevel" :key="bl.level">
            <UBadge :color="(levelColor[bl.level] as any) || 'neutral'" variant="subtle" size="sm">
              {{ bl.level }}: {{ bl.count }}
            </UBadge>
          </span>
          <span v-if="liveMode && liveEntries.length" class="text-primary">
            +{{ liveEntries.length }} new
          </span>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="slug" icon="i-lucide-search" placeholder="Filter by slug..." class="w-48" size="sm" />

          <USelectMenu
            v-model="level"
            :items="levelOptions"
            value-key="value"
            placeholder="Level"
            size="sm"
            class="w-36"
          />

          <USelectMenu
            v-if="!liveMode"
            v-model="since"
            :items="sinceOptions"
            value-key="value"
            placeholder="Time range"
            size="sm"
            class="w-36"
          />
        </div>

        <!-- Logs table -->
        <UTable
          v-if="displayedLogs.length"
          :data="displayedLogs"
          :columns="[
            { accessorKey: 'timestamp', header: 'Time' },
            { accessorKey: 'slug', header: 'Feature' },
            { accessorKey: 'level', header: 'Level' },
            { accessorKey: 'message', header: 'Message' },
            { accessorKey: 'data', header: 'Data' }
          ]"
        >
          <template #timestamp-cell="{ row }">
            <span class="text-sm font-mono text-muted">{{ formatTimestamp(row.original.timestamp) }}</span>
          </template>

          <template #slug-cell="{ row }">
            <NuxtLink :to="`/features/${row.original.slug}`" class="text-primary hover:underline">
              {{ row.original.slug }}
            </NuxtLink>
          </template>

          <template #level-cell="{ row }">
            <UBadge :color="(levelColor[row.original.level] as any) || 'neutral'" variant="subtle" size="sm">
              {{ row.original.level }}
            </UBadge>
          </template>

          <template #data-cell="{ row }">
            <span v-if="row.original.data" class="text-xs text-muted font-mono truncate max-w-xs block">
              {{ row.original.data }}
            </span>
          </template>
        </UTable>

        <div v-else class="text-center py-12 text-muted">
          <UIcon name="i-lucide-scroll-text" class="size-12 mb-2 mx-auto opacity-30" />
          <template v-if="liveMode">
            <p>Waiting for new log entries...</p>
            <p class="text-sm mt-1">New logs will appear here in real-time as feat.log() is called.</p>
          </template>
          <template v-else>
            <p>No logs found matching your filters.</p>
            <p class="text-sm mt-1">Logs are written by feat.log() during dev mode execution.</p>
          </template>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
