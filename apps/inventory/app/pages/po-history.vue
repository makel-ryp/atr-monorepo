<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface PoHistoryEntry {
  id: number
  po_number: string
  sku: string
  product_title: string | null
  po_date: string | null
  qty_ordered: number | null
  qty_shipped: number | null
  expected_arrival_warehouse: string | null
  actual_arrival_warehouse: string | null
  lead_time_days: number | null
  variance_days: number | null
  shipping_method: string | null
  notes: string | null
}

const UBadge = resolveComponent('UBadge')

const { data: poHistory } = await useFetch<PoHistoryEntry[]>('/api/po-history')

function fmt(v: number | null) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function varianceColor(days: number | null) {
  if (days === null) return 'neutral' as const
  if (days > 14)  return 'error'   as const
  if (days > 5)   return 'warning' as const
  if (days < -5)  return 'success' as const
  return 'neutral' as const
}

function varianceLabel(days: number | null) {
  if (days === null) return '—'
  if (days === 0) return 'On time'
  return days > 0 ? `+${days}d late` : `${Math.abs(days)}d early`
}

// Summary stats
const avgLeadTime = computed(() => {
  const rows = (poHistory.value ?? []).filter(r => r.lead_time_days !== null)
  if (!rows.length) return null
  return Math.round(rows.reduce((s, r) => s + (r.lead_time_days ?? 0), 0) / rows.length)
})

const avgVariance = computed(() => {
  const rows = (poHistory.value ?? []).filter(r => r.variance_days !== null)
  if (!rows.length) return null
  const avg = rows.reduce((s, r) => s + (r.variance_days ?? 0), 0) / rows.length
  return Math.round(avg * 10) / 10
})

const totalOrdered = computed(() =>
  (poHistory.value ?? []).reduce((s, r) => s + (r.qty_ordered ?? 0), 0)
)

const columns: TableColumn<PoHistoryEntry>[] = [
  { accessorKey: 'po_number', header: 'PO #' },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'product_title', header: 'Product' },
  {
    accessorKey: 'po_date',
    header: 'PO Date',
    cell: ({ row }) => fmtDate(row.original.po_date),
  },
  {
    accessorKey: 'qty_ordered',
    header: 'Ordered',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, fmt(row.original.qty_ordered)),
  },
  {
    accessorKey: 'qty_shipped',
    header: 'Shipped',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, fmt(row.original.qty_shipped)),
  },
  {
    accessorKey: 'expected_arrival_warehouse',
    header: 'Expected Arrival',
    cell: ({ row }) => fmtDate(row.original.expected_arrival_warehouse),
  },
  {
    accessorKey: 'actual_arrival_warehouse',
    header: 'Actual Arrival',
    cell: ({ row }) => fmtDate(row.original.actual_arrival_warehouse),
  },
  {
    accessorKey: 'lead_time_days',
    header: 'Lead Time',
    cell: ({ row }) => {
      const d = row.original.lead_time_days
      return h('span', { class: 'tabular-nums' }, d !== null ? `${d}d` : '—')
    },
  },
  {
    accessorKey: 'variance_days',
    header: 'Variance',
    cell: ({ row }) => {
      const d = row.original.variance_days
      return h(UBadge, { color: varianceColor(d), variant: 'soft', size: 'xs' }, () => varianceLabel(d))
    },
  },
  {
    accessorKey: 'shipping_method',
    header: 'Ship Method',
    cell: ({ row }) => row.original.shipping_method ?? '—',
  },
]
</script>

<template>
  <UDashboardPanel id="po-history">
    <template #header>
      <UDashboardNavbar title="PO History" />
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4">
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Total POs</p>
            <p class="text-2xl font-semibold">{{ poHistory?.length ?? 0 }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Avg Lead Time</p>
            <p class="text-2xl font-semibold">{{ avgLeadTime !== null ? `${avgLeadTime}d` : '—' }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Avg Delivery Variance</p>
            <p
              class="text-2xl font-semibold"
              :class="avgVariance !== null && avgVariance > 5 ? 'text-warning' : avgVariance !== null && avgVariance > 0 ? '' : 'text-success'"
            >{{ avgVariance !== null ? `${avgVariance > 0 ? '+' : ''}${avgVariance}d` : '—' }}</p>
          </UCard>
        </div>

        <!-- Table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-file-text" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">Purchase Order History</span>
              <UBadge color="neutral" variant="soft" size="xs">{{ poHistory?.length ?? 0 }} POs</UBadge>
            </div>
          </template>
          <UTable :data="poHistory ?? []" :columns="columns" />
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
