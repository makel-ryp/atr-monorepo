<script setup lang="ts">
import { VisXYContainer, VisLine, VisArea, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'

interface InventoryRow { sku: string; product_title: string | null }

interface ForecastRow {
  date: string
  actual_units: number | null
  forecast_units: number | null
  forecast_lower: number | null
  forecast_upper: number | null
}

const { data: inventory } = await useFetch<InventoryRow[]>('/api/inventory')

const skuOptions = computed(() =>
  (inventory.value ?? []).map(r => ({ label: `${r.sku}${r.product_title ? ` — ${r.product_title}` : ''}`, value: r.sku }))
)

const selectedSku = ref<string | null>(null)

// Auto-select first SKU when inventory loads
watch(inventory, (rows) => {
  if (rows?.length && !selectedSku.value) selectedSku.value = rows[0].sku
}, { immediate: true })

const { data: forecastData, pending, refresh } = await useFetch<ForecastRow[]>('/api/forecast', {
  query: computed(() => ({ sku: selectedSku.value })),
  watch: [selectedSku],
})

// unovis helpers — x is the index, y functions per series
const x = (_: ForecastRow, i: number) => i
const yActual = (d: ForecastRow) => d.actual_units ?? 0
const yForecast = (d: ForecastRow) => d.forecast_units ?? 0
const yLower = (d: ForecastRow) => d.forecast_lower ?? 0
const yUpper = (d: ForecastRow) => d.forecast_upper ?? 0

const rows = computed(() => forecastData.value ?? [])

function xTick(i: number) {
  const d = rows.value[i]
  if (!d) return ''
  // Show label every ~30 data points to avoid crowding
  if (i % 30 !== 0 && i !== rows.value.length - 1) return ''
  return d.date.slice(0, 10)
}

const tooltip = (d: ForecastRow) =>
  `<strong>${d.date?.slice(0, 10)}</strong><br/>
   Actual: ${d.actual_units ?? '—'}<br/>
   Forecast: ${d.forecast_units ?? '—'}<br/>
   Range: ${d.forecast_lower ?? '—'} – ${d.forecast_upper ?? '—'}`

// Split where we cross from historical (actual) to forecast-only
const splitIndex = computed(() => {
  const idx = rows.value.findLastIndex(r => r.actual_units !== null && r.actual_units > 0)
  return idx >= 0 ? idx : rows.value.length
})
</script>

<template>
  <UDashboardPanel id="forecast">
    <template #header>
      <UDashboardNavbar title="Forecast">
        <template #right>
          <USelect
            v-model="selectedSku"
            :options="skuOptions"
            value-attribute="value"
            label-attribute="label"
            placeholder="Select a SKU…"
            class="w-72"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Summary cards -->
        <div v-if="rows.length" class="grid grid-cols-3 gap-4">
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Data Points</p>
            <p class="text-2xl font-semibold">{{ rows.length }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Historical</p>
            <p class="text-2xl font-semibold">{{ splitIndex }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Forecast Window</p>
            <p class="text-2xl font-semibold">{{ rows.length - splitIndex }}</p>
          </UCard>
        </div>

        <!-- Chart -->
        <UCard :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
          <template #header>
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-2 text-sm">
                <span class="inline-block h-2 w-6 rounded bg-primary" />
                <span class="text-muted">Actual</span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="inline-block h-2 w-6 rounded border-2 border-dashed border-warning bg-transparent" />
                <span class="text-muted">Forecast</span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="inline-block h-2 w-6 rounded bg-warning opacity-20" />
                <span class="text-muted">Confidence band</span>
              </div>
            </div>
          </template>

          <div v-if="pending" class="flex items-center justify-center h-80">
            <UIcon name="i-lucide-loader-circle" class="animate-spin h-6 w-6 text-muted" />
          </div>

          <div v-else-if="!rows.length" class="flex flex-col items-center justify-center h-80 text-muted gap-2">
            <UIcon name="i-lucide-chart-no-axes-column" class="h-8 w-8" />
            <p class="text-sm">No forecast data for this SKU yet.</p>
          </div>

          <VisXYContainer
            v-else
            :data="rows"
            :padding="{ top: 20, left: 16, right: 16, bottom: 8 }"
            class="h-80"
          >
            <!-- Confidence band as area between lower and upper -->
            <VisArea
              :x="x"
              :y0="yLower"
              :y1="yUpper"
              color="var(--ui-warning)"
              :opacity="0.12"
            />

            <!-- Actual units line -->
            <VisLine
              :x="x"
              :y="yActual"
              color="var(--ui-primary)"
            />

            <!-- Forecast line -->
            <VisLine
              :x="x"
              :y="yForecast"
              color="var(--ui-warning)"
            />

            <VisAxis type="x" :x="x" :tick-format="xTick" />
            <VisAxis type="y" />

            <VisCrosshair
              color="var(--ui-primary)"
              :template="tooltip"
            />
            <VisTooltip />
          </VisXYContainer>
        </UCard>

        <!-- Raw data table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-table-2" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">Raw Data</span>
            </div>
          </template>
          <div class="overflow-auto max-h-64">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-elevated/80 backdrop-blur-sm">
                <tr>
                  <th class="text-left px-3 py-2 text-muted font-medium">Date</th>
                  <th class="text-right px-3 py-2 text-muted font-medium">Actual</th>
                  <th class="text-right px-3 py-2 text-muted font-medium">Forecast</th>
                  <th class="text-right px-3 py-2 text-muted font-medium">Lower</th>
                  <th class="text-right px-3 py-2 text-muted font-medium">Upper</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="row in rows" :key="row.date" class="hover:bg-elevated/50">
                  <td class="px-3 py-1.5 font-mono text-xs">{{ row.date?.slice(0, 10) }}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{{ row.actual_units ?? '—' }}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums text-warning">{{ row.forecast_units ?? '—' }}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums text-muted">{{ row.forecast_lower ?? '—' }}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums text-muted">{{ row.forecast_upper ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);
  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
