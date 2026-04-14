<script setup lang="ts">
// ── types ──────────────────────────────────────────────────────────────────────
interface InventoryRow { sku: string; product_title: string | null }

interface SkuSummary {
  sku: string
  product_title: string | null
  run_date: string | null
  forecast_method: string | null
  prev:        { d30: number | null; d60: number | null; d90: number | null }
  next:        { d30: number | null; d60: number | null; d90: number | null; lower_90d: unknown; upper_90d: unknown }
  vs_prev_pct: { d30: number | null; d60: number | null; d90: number | null }
  yoy:         { current_ytd: number | null; prior_ytd: number | null; change_pct: number | null }
  qvq: {
    q0: number; q1: number; q2: number
    q0_label: string; q1_label: string; q2_label: string
    q0_vs_q1_pct: number | null
    q1_vs_q2_pct: number | null
  }
  channel: {
    shopify: { d30: number | null; d60: number | null; d90: number | null }
    amazon:  { d30: number | null; d60: number | null; d90: number | null }
    edi:     { d30: number | null; d60: number | null; d90: number | null }
  }
  rolling:  { d7: number | null; d14: number | null; d30: number | null; d60: number | null; d90: number | null; d180: number | null }
  velocity: { avg_daily_30d: number | null; avg_daily_90d: number | null; trend: string | null }
}

// ── data ───────────────────────────────────────────────────────────────────────
const { data: inventory } = await useFetch<InventoryRow[]>('/api/inventory')

const skuOptions = computed(() =>
  (inventory.value ?? []).map(r => ({
    label: r.product_title ? `${r.sku} — ${r.product_title}` : r.sku,
    value: r.sku,
  }))
)

const selectedSkus = ref<string[]>([])

// Auto-select first SKU on load
watch(inventory, (rows) => {
  if (rows?.length && !selectedSkus.value.length) {
    selectedSkus.value = [rows[0].sku]
  }
}, { immediate: true })

const skusQuery = computed(() => selectedSkus.value.join(','))

// Let useFetch handle reactivity natively — API returns [] for empty skus, which maps to the empty state
const { data: summaryData, pending, refresh: refreshSummary } = useFetch<SkuSummary[]>('/api/forecast-summary', {
  query: computed(() => ({ skus: skusQuery.value })),
  watch: [skusQuery],
})

const results = computed<SkuSummary[]>(() => summaryData.value ?? [])

// ── active tab ─────────────────────────────────────────────────────────────────
const tabs = [
  { label: 'Prev vs Next', slot: 'prev-next' as const },
  { label: 'Year over Year', slot: 'yoy' as const },
  { label: 'Quarter vs Quarter', slot: 'qvq' as const },
  { label: 'Channel', slot: 'channel' as const },
  { label: 'Velocity', slot: 'velocity' as const },
]

// ── display helpers ────────────────────────────────────────────────────────────
function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString()
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `${n > 0 ? '+' : ''}${n}%`
}

function deltaClass(n: number | null): string {
  if (n === null) return 'text-muted'
  if (n > 0) return 'text-success font-medium'
  if (n < 0) return 'text-error font-medium'
  return 'text-muted'
}

function trendIcon(trend: string | null): string {
  if (!trend) return 'i-lucide-minus'
  if (trend === 'up') return 'i-lucide-trending-up'
  if (trend === 'down') return 'i-lucide-trending-down'
  return 'i-lucide-minus'
}

function trendColor(trend: string | null): string {
  if (trend === 'up') return 'text-success'
  if (trend === 'down') return 'text-error'
  return 'text-muted'
}
</script>

<template>
  <UDashboardPanel id="forecast">
    <template #header>
      <UDashboardNavbar title="Forecast">
        <template #right>
          <div class="flex items-center gap-3">
            <USelectMenu
              v-model="selectedSkus"
              :items="skuOptions"
              value-key="value"
              label-key="label"
              multiple
              placeholder="Select SKUs…"
              class="w-96"
            >
              <template #label>
                <span v-if="!selectedSkus.length" class="text-muted">Select SKUs…</span>
                <span v-else-if="selectedSkus.length === 1">{{ selectedSkus[0] }}</span>
                <span v-else>{{ selectedSkus.length }} SKUs selected</span>
              </template>
            </USelectMenu>
            <UButton
              v-if="selectedSkus.length"
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-x"
              @click="selectedSkus = []"
            >
              Clear
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-refresh-cw"
              :loading="pending"
              @click="refreshSummary()"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Empty state -->
        <div v-if="!selectedSkus.length" class="flex flex-col items-center justify-center h-64 text-muted gap-3">
          <UIcon name="i-lucide-bar-chart-2" class="h-10 w-10" />
          <p class="text-sm">Select one or more SKUs to view forecast data.</p>
        </div>

        <!-- Loading -->
        <div v-else-if="pending" class="flex items-center justify-center h-64">
          <UIcon name="i-lucide-loader-circle" class="animate-spin h-6 w-6 text-muted" />
        </div>

        <!-- No results -->
        <div v-else-if="!results.length" class="flex flex-col items-center justify-center h-64 text-muted gap-3">
          <UIcon name="i-lucide-database-zap" class="h-10 w-10" />
          <p class="text-sm">No forecast data yet — run the pipeline to generate data.</p>
        </div>

        <!-- Data -->
        <template v-else>

          <!-- Summary chips -->
          <div class="flex items-center gap-3 flex-wrap">
            <UBadge
              v-for="s in results"
              :key="s.sku"
              variant="subtle"
              color="primary"
              class="text-xs"
            >
              {{ s.sku }}
              <span v-if="s.product_title" class="text-muted ml-1">— {{ s.product_title }}</span>
            </UBadge>
            <span v-if="results[0]?.run_date" class="text-xs text-muted ml-auto">
              Last run: {{ results[0].run_date }}
            </span>
          </div>

          <!-- Tabs -->
          <UTabs :items="tabs">

            <!-- ── Prev vs Next ───────────────────────────────────────────── -->
            <template #prev-next>
              <div class="overflow-x-auto mt-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left px-4 py-3 text-muted font-medium w-48">SKU</th>
                      <!-- 30d -->
                      <th class="text-right px-3 py-3 text-muted font-medium">Prev 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Next 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">+/−</th>
                      <!-- 60d -->
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Prev 60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Next 60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">+/−</th>
                      <!-- 90d -->
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Prev 90d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Next 90d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">+/−</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="s in results" :key="s.sku" class="hover:bg-elevated/50">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ s.sku }}</p>
                        <p v-if="s.product_title" class="text-xs text-muted truncate max-w-40">{{ s.product_title }}</p>
                      </td>
                      <!-- 30d -->
                      <td class="px-3 py-3 text-right tabular-nums text-muted">{{ fmt(s.prev.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums font-medium">{{ fmt(s.next.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.vs_prev_pct.d30)">{{ fmtPct(s.vs_prev_pct.d30) }}</td>
                      <!-- 60d -->
                      <td class="px-3 py-3 text-right tabular-nums text-muted border-l border-border">{{ fmt(s.prev.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums font-medium">{{ fmt(s.next.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.vs_prev_pct.d60)">{{ fmtPct(s.vs_prev_pct.d60) }}</td>
                      <!-- 90d -->
                      <td class="px-3 py-3 text-right tabular-nums text-muted border-l border-border">{{ fmt(s.prev.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums font-medium">{{ fmt(s.next.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.vs_prev_pct.d90)">{{ fmtPct(s.vs_prev_pct.d90) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- ── Year over Year ─────────────────────────────────────────── -->
            <template #yoy>
              <div class="overflow-x-auto mt-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left px-4 py-3 text-muted font-medium w-48">SKU</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">YTD (This Yr)</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">YTD (Prior Yr)</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">YoY %</th>
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Prev 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Prev 60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Prev 90d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Next 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Next 60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Next 90d</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="s in results" :key="s.sku" class="hover:bg-elevated/50">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ s.sku }}</p>
                        <p v-if="s.product_title" class="text-xs text-muted truncate max-w-40">{{ s.product_title }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums font-medium">{{ fmt(s.yoy.current_ytd) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted">{{ fmt(s.yoy.prior_ytd) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.yoy.change_pct)">{{ fmtPct(s.yoy.change_pct) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted border-l border-border">{{ fmt(s.prev.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted">{{ fmt(s.prev.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted">{{ fmt(s.prev.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums border-l border-border">{{ fmt(s.next.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.next.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.next.d90) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-xs text-muted mt-3 px-4">
                  YoY is year-to-date vs same period prior year. Per-interval YoY requires 365 days of history — extend
                  <code class="font-mono">HISTORY_DAYS</code> in <code class="font-mono">forecast_timeseries.py</code> to unlock it.
                </p>
              </div>
            </template>

            <!-- ── Quarter vs Quarter ─────────────────────────────────────── -->
            <template #qvq>
              <div class="overflow-x-auto mt-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left px-4 py-3 text-muted font-medium w-48">SKU</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Q0 (most recent 90d)</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Q-1 (prior 90d)</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Q0 vs Q-1</th>
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Q-2 (90d before)</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Q-1 vs Q-2</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="s in results" :key="s.sku" class="hover:bg-elevated/50">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ s.sku }}</p>
                        <p v-if="s.product_title" class="text-xs text-muted truncate max-w-40">{{ s.product_title }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums font-medium">
                        {{ fmt(s.qvq.q0) }}
                        <p class="text-xs text-muted font-normal">{{ s.qvq.q0_label }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted">
                        {{ fmt(s.qvq.q1) }}
                        <p class="text-xs text-muted">{{ s.qvq.q1_label }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.qvq.q0_vs_q1_pct)">
                        {{ fmtPct(s.qvq.q0_vs_q1_pct) }}
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums text-muted border-l border-border">
                        {{ fmt(s.qvq.q2) }}
                        <p class="text-xs text-muted">{{ s.qvq.q2_label }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums" :class="deltaClass(s.qvq.q1_vs_q2_pct)">
                        {{ fmtPct(s.qvq.q1_vs_q2_pct) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-xs text-muted mt-3 px-4">
                  QvQ is computed from daily actuals in <code class="font-mono">forecast_history</code>.
                  Extend <code class="font-mono">HISTORY_DAYS</code> beyond 180 in the pipeline for deeper quarter history.
                </p>
              </div>
            </template>

            <!-- ── Channel Breakdown ──────────────────────────────────────── -->
            <template #channel>
              <div class="overflow-x-auto mt-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left px-4 py-3 text-muted font-medium w-48">SKU</th>
                      <!-- Shopify -->
                      <th class="text-right px-3 py-3 text-muted font-medium">
                        <div class="flex items-center justify-end gap-1">
                          <UIcon name="i-logos-shopify" class="h-3 w-3" />
                          30d
                        </div>
                      </th>
                      <th class="text-right px-3 py-3 text-muted font-medium">60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">90d</th>
                      <!-- Amazon -->
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">
                        <div class="flex items-center justify-end gap-1">
                          <UIcon name="i-logos-amazon" class="h-3 w-3" />
                          30d
                        </div>
                      </th>
                      <th class="text-right px-3 py-3 text-muted font-medium">60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">90d</th>
                      <!-- EDI -->
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">EDI 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">90d</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="s in results" :key="s.sku" class="hover:bg-elevated/50">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ s.sku }}</p>
                        <p v-if="s.product_title" class="text-xs text-muted truncate max-w-40">{{ s.product_title }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.shopify.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.shopify.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.shopify.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums border-l border-border">{{ fmt(s.channel.amazon.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.amazon.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.amazon.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums border-l border-border">{{ fmt(s.channel.edi.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.edi.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.channel.edi.d90) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- ── Velocity ───────────────────────────────────────────────── -->
            <template #velocity>
              <div class="overflow-x-auto mt-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left px-4 py-3 text-muted font-medium w-48">SKU</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">7d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">14d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">60d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">90d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">180d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium border-l border-border">Avg/day 30d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Avg/day 90d</th>
                      <th class="text-right px-3 py-3 text-muted font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="s in results" :key="s.sku" class="hover:bg-elevated/50">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ s.sku }}</p>
                        <p v-if="s.product_title" class="text-xs text-muted truncate max-w-40">{{ s.product_title }}</p>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d7) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d14) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d30) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d60) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d90) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ fmt(s.rolling.d180) }}</td>
                      <td class="px-3 py-3 text-right tabular-nums border-l border-border">
                        {{ s.velocity.avg_daily_30d != null ? s.velocity.avg_daily_30d.toFixed(1) : '—' }}
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums">
                        {{ s.velocity.avg_daily_90d != null ? s.velocity.avg_daily_90d.toFixed(1) : '—' }}
                      </td>
                      <td class="px-3 py-3 text-right">
                        <div class="flex items-center justify-end gap-1" :class="trendColor(s.velocity.trend)">
                          <UIcon :name="trendIcon(s.velocity.trend)" class="h-4 w-4" />
                          <span class="text-xs capitalize">{{ s.velocity.trend ?? '—' }}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

          </UTabs>
        </template>

      </div>
    </template>
  </UDashboardPanel>
</template>
