<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface RunLogEntry {
  id: number
  run_timestamp: string
  source: string
  records_pulled: number | null
  status: string | null
  notes: string | null
}

const UBadge = resolveComponent('UBadge')

const { data: runLog, refresh } = await useFetch<RunLogEntry[]>('/api/run-log')

function statusColor(s: string | null) {
  switch (s?.toLowerCase()) {
    case 'ok':      return 'success' as const
    case 'error':   return 'error'   as const
    case 'warning': return 'warning' as const
    case 'skipped': return 'neutral' as const
    default:        return 'neutral' as const
  }
}

function fmtTimestamp(ts: string | null) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

const lastRun = computed(() => runLog.value?.[0] ?? null)

const successRate = computed(() => {
  const rows = runLog.value ?? []
  if (!rows.length) return null
  const ok = rows.filter(r => r.status?.toLowerCase() === 'ok').length
  return Math.round((ok / rows.length) * 100)
})

const totalRecords = computed(() =>
  (runLog.value ?? []).reduce((s, r) => s + (r.records_pulled ?? 0), 0)
)

const columns: TableColumn<RunLogEntry>[] = [
  {
    accessorKey: 'run_timestamp',
    header: 'Timestamp',
    cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, fmtTimestamp(row.original.run_timestamp)),
  },
  { accessorKey: 'source', header: 'Source' },
  {
    accessorKey: 'records_pulled',
    header: 'Records',
    cell: ({ row }) => {
      const n = row.original.records_pulled
      return h('span', { class: 'tabular-nums' }, n?.toLocaleString() ?? '—')
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status
      if (!s) return '—'
      return h(UBadge, { color: statusColor(s), variant: 'soft', size: 'xs' }, () => s.toUpperCase())
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => h('span', { class: 'text-muted text-xs' }, row.original.notes ?? '—'),
  },
]
</script>

<template>
  <UDashboardPanel id="run-history">
    <template #header>
      <UDashboardNavbar title="Run History">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" @click="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4">
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Last Run</p>
            <p class="text-sm font-medium">{{ lastRun ? fmtTimestamp(lastRun.run_timestamp) : 'Never' }}</p>
            <UBadge
              v-if="lastRun"
              :color="statusColor(lastRun.status)"
              variant="soft"
              size="xs"
              class="mt-1"
            >{{ lastRun.status?.toUpperCase() ?? '—' }}</UBadge>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Success Rate</p>
            <p class="text-2xl font-semibold">
              {{ successRate !== null ? `${successRate}%` : '—' }}
            </p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Total Records Pulled</p>
            <p class="text-2xl font-semibold">{{ totalRecords.toLocaleString() }}</p>
          </UCard>
        </div>

        <!-- Table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-history" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">Pipeline Run Log</span>
              <UBadge color="neutral" variant="soft" size="xs">{{ runLog?.length ?? 0 }} entries</UBadge>
            </div>
          </template>
          <UTable :data="runLog ?? []" :columns="columns" />
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
