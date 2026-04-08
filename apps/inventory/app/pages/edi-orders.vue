<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface EdiOrder {
  id: number
  po_number: string
  sku: string
  retailer: string | null
  product_title: string | null
  ordered_qty: number | null
  shipped_qty: number | null
  expected_date: string | null
  date: string | null
  doc_type: string | null
  status: string | null
}

const UBadge = resolveComponent('UBadge')

const { data: ediOrders } = await useFetch<EdiOrder[]>('/api/edi-orders')

const searchQuery = ref('')

const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return ediOrders.value ?? []
  return (ediOrders.value ?? []).filter(r =>
    r.po_number?.toLowerCase().includes(q)
    || r.sku?.toLowerCase().includes(q)
    || r.retailer?.toLowerCase().includes(q)
    || r.product_title?.toLowerCase().includes(q)
  )
})

function fmt(v: number | null) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function statusColor(s: string | null) {
  switch (s?.toLowerCase()) {
    case 'shipped':    return 'success' as const
    case 'pending':    return 'warning' as const
    case 'cancelled':  return 'error'   as const
    case 'received':   return 'info'    as const
    default:           return 'neutral' as const
  }
}

function docTypeColor(t: string | null) {
  switch (t?.toUpperCase()) {
    case '850': return 'primary'  as const   // Purchase Order
    case '856': return 'success'  as const   // Ship Notice
    case '810': return 'info'     as const   // Invoice
    default:    return 'neutral'  as const
  }
}

function docTypeLabel(t: string | null) {
  if (!t) return '—'
  const labels: Record<string, string> = {
    '850': '850 PO',
    '856': '856 ASN',
    '810': '810 Invoice',
  }
  return labels[t.toUpperCase()] ?? t
}

// Summary
const retailers = computed(() => new Set((ediOrders.value ?? []).map(r => r.retailer).filter(Boolean)).size)

const fulfillmentRate = computed(() => {
  const rows = (ediOrders.value ?? []).filter(r => r.ordered_qty && r.shipped_qty !== null)
  if (!rows.length) return null
  const pct = rows.reduce((s, r) => s + (r.shipped_qty ?? 0) / (r.ordered_qty ?? 1), 0) / rows.length
  return Math.round(pct * 100)
})

const totalOrdered = computed(() =>
  (ediOrders.value ?? []).reduce((s, r) => s + (r.ordered_qty ?? 0), 0)
)

const columns: TableColumn<EdiOrder>[] = [
  { accessorKey: 'po_number', header: 'PO #' },
  {
    accessorKey: 'doc_type',
    header: 'Doc Type',
    cell: ({ row }) => {
      const t = row.original.doc_type
      return h(UBadge, { color: docTypeColor(t), variant: 'soft', size: 'xs' }, () => docTypeLabel(t))
    },
  },
  { accessorKey: 'retailer', header: 'Retailer' },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'product_title', header: 'Product' },
  {
    accessorKey: 'ordered_qty',
    header: 'Ordered',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, fmt(row.original.ordered_qty)),
  },
  {
    accessorKey: 'shipped_qty',
    header: 'Shipped',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, fmt(row.original.shipped_qty)),
  },
  {
    accessorKey: 'date',
    header: 'Order Date',
    cell: ({ row }) => fmtDate(row.original.date),
  },
  {
    accessorKey: 'expected_date',
    header: 'Expected Date',
    cell: ({ row }) => fmtDate(row.original.expected_date),
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
]
</script>

<template>
  <UDashboardPanel id="edi-orders">
    <template #header>
      <UDashboardNavbar title="EDI Orders">
        <template #right>
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search PO, SKU, retailer…"
            class="w-64"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4">
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Total Orders</p>
            <p class="text-2xl font-semibold">{{ ediOrders?.length ?? 0 }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Retailers</p>
            <p class="text-2xl font-semibold">{{ retailers }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Avg Fulfillment Rate</p>
            <p class="text-2xl font-semibold" :class="fulfillmentRate !== null && fulfillmentRate < 90 ? 'text-warning' : 'text-success'">
              {{ fulfillmentRate !== null ? `${fulfillmentRate}%` : '—' }}
            </p>
          </UCard>
        </div>

        <!-- Table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-building-2" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">EDI Orders</span>
              <UBadge color="neutral" variant="soft" size="xs">{{ filteredRows.length }} orders</UBadge>
            </div>
          </template>
          <UTable :data="filteredRows" :columns="columns" />
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
