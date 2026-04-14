<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface InventoryRow {
  sku: string
  product_title: string | null
  shopify_stock: number | null
  amazon_fba_stock: number | null
  current_stock: number | null      // used in activeSKUs + totalUnitsOnHand cards
  sps_committed_qty: number | null  // folded into Free Stock cell
  effective_stock: number | null
  avg_monthly_velocity: number | null
  months_of_stock: number | null
  forecast_90d: number | null
  order_status: string | null
  order_by_date: string | null
}

interface PipelineStatus {
  last_run_at: string | null
  steps: { source: string; status: string; records_pulled: number | null }[]
  overall: 'ok' | 'error' | 'running' | 'unknown'
}

interface DailyBrief {
  id: number
  date: string
  narrative: string
}

const UBadge = resolveComponent('UBadge')

const { data: inventory } = await useFetch<InventoryRow[]>('/api/inventory')
const { data: pipelineStatus } = await useFetch<PipelineStatus>('/api/pipeline/status')
const { data: briefs } = await useFetch<DailyBrief[]>('/api/daily-briefs')

const today = new Date().toISOString().slice(0, 10)

const todaysBrief = computed(() => briefs.value?.find(b => b.date === today) ?? null)

const activeSKUs = computed(() =>
  (inventory.value ?? []).filter(r => (r.current_stock ?? 0) > 0).length
)
const criticalCount = computed(() =>
  (inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'critical').length
)
const warningCount = computed(() =>
  (inventory.value ?? []).filter(r => r.order_status?.toLowerCase() === 'warning').length
)
const totalUnitsOnHand = computed(() =>
  (inventory.value ?? []).reduce((s, r) => s + (r.current_stock ?? 0), 0)
)

function fmt(val: number | null, decimals = 0) {
  if (val === null || val === undefined) return '—'
  return val.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function statusColor(status: string | null) {
  switch (status?.toLowerCase()) {
    case 'critical':  return 'error' as const
    case 'warning':   return 'warning' as const
    case 'overstock': return 'info' as const
    case 'ok':        return 'success' as const
    default:          return 'neutral' as const
  }
}

function pipelineOverallColor(overall: string) {
  switch (overall) {
    case 'ok':      return 'success' as const
    case 'error':   return 'error' as const
    case 'running': return 'warning' as const
    default:        return 'neutral' as const
  }
}

const columns: TableColumn<InventoryRow>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'product_title', header: 'Product' },
  {
    accessorKey: 'shopify_stock',
    header: 'Shopify',
    cell: ({ row }) => fmt(row.original.shopify_stock),
  },
  {
    accessorKey: 'amazon_fba_stock',
    header: 'Amazon FBA',
    cell: ({ row }) => fmt(row.original.amazon_fba_stock),
  },
  {
    // effective_stock = current_stock − sps_committed_qty
    // Folding sps_committed_qty note in here removes two redundant columns
    // (current_stock is always shopify+amazon; effective is always current−sps)
    accessorKey: 'effective_stock',
    header: 'Free Stock',
    cell: ({ row }) => {
      const val = row.original.effective_stock ?? row.original.current_stock ?? 0
      const committed = row.original.sps_committed_qty ?? 0
      if (committed > 0) {
        return h('span', {}, [
          fmt(val),
          h('span', { class: 'ml-1 text-xs text-warning-500' }, `(${fmt(committed)} SPS)`),
        ])
      }
      return fmt(val)
    },
  },
  {
    // avg_monthly_velocity = total_90d / 3 — all channels combined.
    // Per-channel (shopify_90d/3, amazon_90d/3) removed: identical to this
    // column when only one channel has sales, adding noise otherwise.
    accessorKey: 'avg_monthly_velocity',
    header: 'Velocity /mo',
    cell: ({ row }) => fmt(row.original.avg_monthly_velocity, 0),
  },
  {
    accessorKey: 'months_of_stock',
    header: 'Months of Stock',
    cell: ({ row }) => {
      const m = row.original.months_of_stock
      if (m === null || m === undefined) return '—'
      if (m >= 999) return '∞'
      return fmt(m, 1)
    },
  },
  {
    // forecast_90d from pipeline (WMA or Prophet). Per-channel forecasts
    // removed: they duplicate this column when only one channel is active.
    accessorKey: 'forecast_90d',
    header: 'Forecast (90d)',
    cell: ({ row }) => fmt(row.original.forecast_90d, 0),
  },
  {
    accessorKey: 'order_status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.order_status
      if (!s) return '—'
      return h(UBadge, { color: statusColor(s), variant: 'soft', size: 'xs' }, () => s.toUpperCase())
    },
  },
  {
    accessorKey: 'order_by_date',
    header: 'Order By',
    cell: ({ row }) => {
      const d = row.original.order_by_date
      const isCritical = row.original.order_status?.toLowerCase() === 'critical'
      return h('span', { class: isCritical ? 'text-red-600 font-medium' : '' }, d ?? '—')
    },
  },
]
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Dashboard" />
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Metric cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard>
            <div class="text-sm text-muted">Active SKUs</div>
            <div class="text-3xl font-bold mt-1">{{ activeSKUs }}</div>
          </UCard>
          <UCard>
            <div class="text-sm text-red-500 font-medium">Critical</div>
            <div class="text-3xl font-bold mt-1 text-red-500">{{ criticalCount }}</div>
          </UCard>
          <UCard>
            <div class="text-sm text-yellow-500 font-medium">Warning</div>
            <div class="text-3xl font-bold mt-1 text-yellow-500">{{ warningCount }}</div>
          </UCard>
          <UCard>
            <div class="text-sm text-muted">Total Units On Hand</div>
            <div class="text-3xl font-bold mt-1">{{ fmt(totalUnitsOnHand) }}</div>
          </UCard>
        </div>

        <!-- Today's brief -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-newspaper" class="text-primary h-4 w-4" />
              <span class="font-semibold text-sm">Today's Brief</span>
              <UBadge v-if="todaysBrief" color="success" variant="soft" size="xs">{{ todaysBrief.date }}</UBadge>
            </div>
          </template>
          <div v-if="todaysBrief" class="text-sm whitespace-pre-line leading-relaxed">
            {{ todaysBrief.narrative }}
          </div>
          <div v-else class="text-sm text-muted italic">
            Brief not yet generated — pipeline runs 7am UTC. Visit Admin to trigger manually.
          </div>
        </UCard>

        <!-- Inventory table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-table" class="text-primary h-4 w-4" />
              <span class="font-semibold text-sm">Inventory Status</span>
            </div>
          </template>
          <UTable :data="inventory ?? []" :columns="columns" />
        </UCard>

        <!-- Pipeline status footer -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-activity" class="text-primary h-4 w-4" />
                <span class="font-semibold text-sm">Pipeline Status</span>
              </div>
              <UBadge
                :color="pipelineOverallColor(pipelineStatus?.overall ?? 'unknown')"
                variant="soft"
                size="xs"
              >
                {{ (pipelineStatus?.overall ?? 'unknown').toUpperCase() }}
              </UBadge>
            </div>
          </template>
          <div class="text-sm text-muted">
            Last run: <span class="font-medium text-default">{{ pipelineStatus?.last_run_at ?? 'Never' }}</span>
          </div>
          <div v-if="pipelineStatus?.steps?.length" class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="step in pipelineStatus.steps"
              :key="step.source"
              :color="step.status === 'ok' ? 'success' : step.status === 'error' ? 'error' : 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ step.source }}: {{ step.records_pulled ?? 0 }} rows
            </UBadge>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
