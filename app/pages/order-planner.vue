<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface InventoryRow {
  sku: string
  product_title: string | null
  current_stock: number | null
  months_of_stock: number | null
  avg_monthly_velocity: number | null
  forecast_90d: number | null
  order_status: string | null
  order_by_date: string | null
  days_until_order_deadline: number | null
  reorder_qty_9mo: number | null
  reorder_qty_12mo: number | null
  reorder_qty_9mo_adj: number | null
  reorder_qty_12mo_adj: number | null
  stockout_date: string | null
}

const UBadge  = resolveComponent('UBadge')
const UInput  = resolveComponent('UInput')

const { data: inventory } = await useFetch<InventoryRow[]>('/api/inventory')

type FilterKey = 'all' | 'critical' | 'warning' | 'overstock' | 'ok'
const activeFilter = ref<FilterKey>('all')

const filterOptions: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all',      label: 'All',      color: 'neutral' },
  { key: 'critical', label: 'Critical', color: 'error' },
  { key: 'warning',  label: 'Warning',  color: 'warning' },
  { key: 'overstock',label: 'Overstock',color: 'info' },
  { key: 'ok',       label: 'OK',       color: 'success' },
]

const rows = computed(() => {
  const all = inventory.value ?? []
  if (activeFilter.value === 'all') return all
  return all.filter(r => r.order_status?.toLowerCase() === activeFilter.value)
})

const counts = computed(() => ({
  critical: (inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'critical').length,
  warning:  (inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'warning').length,
  overstock:(inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'overstock').length,
  ok:       (inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'ok').length,
}))

// ── Local override state (not persisted) ─────────────────────────────────────
const overrideQty   = ref<Record<string, number | null>>({})
const overrideNotes = ref<Record<string, string>>({})

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null, dec = 0) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString(undefined, { maximumFractionDigits: dec })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function statusColor(s: string | null) {
  switch (s?.toLowerCase()) {
    case 'critical':  return 'error'   as const
    case 'warning':   return 'warning' as const
    case 'overstock': return 'info'    as const
    case 'ok':        return 'success' as const
    default:          return 'neutral' as const
  }
}

function deadlineColor(days: number | null) {
  if (days === null) return ''
  if (days <= 7)  return 'text-error'
  if (days <= 21) return 'text-warning'
  return 'text-muted'
}

// ── Export ─────────────────────────────────────────────────────────────────────
function buildExportRows() {
  return rows.value.map(r => ({
    SKU: r.sku,
    Product: r.product_title ?? '',
    'On Hand': r.current_stock ?? 0,
    'Months Left': r.months_of_stock?.toFixed(1) ?? '',
    'Mo Velocity': r.avg_monthly_velocity?.toFixed(0) ?? '',
    'Forecast 90d': r.forecast_90d?.toFixed(0) ?? '',
    'Reorder Qty (9mo)': r.reorder_qty_9mo_adj ?? r.reorder_qty_9mo ?? '',
    'Reorder Qty (12mo)': r.reorder_qty_12mo_adj ?? r.reorder_qty_12mo ?? '',
    'Override Qty': overrideQty.value[r.sku] ?? '',
    'Notes': overrideNotes.value[r.sku] ?? '',
    Status: r.order_status ?? '',
    'Order By': fmtDate(r.order_by_date),
    'Days Remaining': r.days_until_order_deadline ?? '',
    'Stockout Date': fmtDate(r.stockout_date),
  }))
}

function exportFile(sep: string, ext: string) {
  const exportRows = buildExportRows()
  if (!exportRows.length) return
  const headers = Object.keys(exportRows[0])
  const lines = [
    headers.join(sep),
    ...exportRows.map(r => headers.map(h => JSON.stringify(r[h as keyof typeof r] ?? '')).join(sep)),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `order-planner-${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Table columns ─────────────────────────────────────────────────────────────
const columns: TableColumn<InventoryRow>[] = [
  {
    accessorKey: 'order_status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.order_status
      if (!s) return h(UBadge, { color: 'neutral' as const, variant: 'soft', size: 'xs' }, () => '—')
      return h(UBadge, { color: statusColor(s), variant: 'soft', size: 'xs' }, () => s.toUpperCase())
    },
  },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'product_title', header: 'Product' },
  {
    accessorKey: 'current_stock',
    header: 'On Hand',
    cell: ({ row }) => fmt(row.original.current_stock),
  },
  {
    accessorKey: 'months_of_stock',
    header: 'Months Left',
    cell: ({ row }) => {
      const m = row.original.months_of_stock
      if (m === null) return '—'
      const color = m <= 1 ? 'text-error' : m <= 2 ? 'text-warning' : 'text-muted'
      return h('span', { class: `font-semibold tabular-nums ${color}` }, fmt(m, 1))
    },
  },
  {
    accessorKey: 'avg_monthly_velocity',
    header: 'Mo Velocity',
    cell: ({ row }) => fmt(row.original.avg_monthly_velocity, 0),
  },
  {
    accessorKey: 'order_by_date',
    header: 'Order By',
    cell: ({ row }) => {
      const d    = row.original.order_by_date
      const days = row.original.days_until_order_deadline
      return h('div', {}, [
        h('span', { class: 'block text-sm' }, fmtDate(d)),
        days !== null
          ? h('span', { class: `text-xs ${deadlineColor(days)}` }, `${days}d remaining`)
          : null,
      ])
    },
  },
  {
    accessorKey: 'stockout_date',
    header: 'Stockout',
    cell: ({ row }) => fmtDate(row.original.stockout_date),
  },
  {
    accessorKey: 'reorder_qty_9mo_adj',
    header: 'Rec. Qty (9mo)',
    cell: ({ row }) => {
      const adj = row.original.reorder_qty_9mo_adj ?? row.original.reorder_qty_9mo
      return h('span', { class: 'font-semibold tabular-nums' }, fmt(adj))
    },
  },
  {
    id: 'override_qty',
    header: 'Override Qty',
    cell: ({ row }) => {
      const sku = row.original.sku
      return h(UInput, {
        modelValue: overrideQty.value[sku] ?? null,
        'onUpdate:modelValue': (v: number | null) => { overrideQty.value[sku] = v ? Number(v) : null },
        type: 'number',
        min: '0',
        size: 'xs',
        class: 'w-24',
        placeholder: '—',
      })
    },
  },
  {
    id: 'override_notes',
    header: 'Notes',
    cell: ({ row }) => {
      const sku = row.original.sku
      return h(UInput, {
        modelValue: overrideNotes.value[sku] ?? '',
        'onUpdate:modelValue': (v: string) => { overrideNotes.value[sku] = v },
        size: 'xs',
        class: 'w-36',
        placeholder: 'Optional…',
      })
    },
  },
]
</script>

<template>
  <UDashboardPanel id="order-planner">
    <template #header>
      <UDashboardNavbar title="Order Planner">
        <template #right>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" @click="exportFile(',', 'csv')">
            CSV
          </UButton>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" @click="exportFile('\t', 'tsv')">
            TSV
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Alert banner -->
        <UAlert
          v-if="counts.critical > 0"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :title="`${counts.critical} SKU${counts.critical > 1 ? 's' : ''} in CRITICAL status`"
          description="These items risk stockout. Place orders immediately."
        />

        <!-- Metric cards -->
        <div class="grid grid-cols-4 gap-4">
          <UCard
            v-for="f in filterOptions.filter(f => f.key !== 'all')"
            :key="f.key"
            class="cursor-pointer transition-all"
            :class="activeFilter === f.key ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'"
            @click="activeFilter = f.key"
          >
            <p class="text-xs text-muted uppercase mb-1">{{ f.label }}</p>
            <p class="text-2xl font-semibold">{{ counts[f.key as keyof typeof counts] }}</p>
          </UCard>
        </div>

        <!-- Filter tabs -->
        <div class="flex items-center gap-2 flex-wrap">
          <UButton
            v-for="f in filterOptions"
            :key="f.key"
            size="sm"
            :variant="activeFilter === f.key ? 'solid' : 'ghost'"
            :color="activeFilter === f.key ? 'primary' : 'neutral'"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
            <span v-if="f.key !== 'all'" class="ml-1 opacity-70">
              {{ counts[f.key as keyof typeof counts] }}
            </span>
          </UButton>
        </div>

        <!-- Table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-clipboard-list" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">Order Recommendations</span>
              <UBadge color="neutral" variant="soft" size="xs">{{ rows.length }} SKUs</UBadge>
              <span class="ml-auto text-xs text-muted">Override Qty and Notes are local-only (not saved)</span>
            </div>
          </template>
          <UTable :data="rows" :columns="columns" />
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
