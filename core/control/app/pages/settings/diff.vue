<script setup lang="ts">
const leftAppId = ref('default')
const leftEnv = ref('development')
const rightAppId = ref('default')
const rightEnv = ref('production')

const leftQuery = computed(() => ({ appId: leftAppId.value, environment: leftEnv.value }))
const rightQuery = computed(() => ({ appId: rightAppId.value, environment: rightEnv.value }))

const { data: leftData, error: leftError } = await useFetch('/api/settings', { query: leftQuery })
const { data: rightData, error: rightError } = await useFetch('/api/settings', { query: rightQuery })

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path))
    } else {
      result[path] = typeof value === 'string' ? value : JSON.stringify(value)
    }
  }
  return result
}

function getConfig(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {}
  return data.config || data
}

const diffRows = computed(() => {
  const left = flattenObject(getConfig(leftData.value))
  const right = flattenObject(getConfig(rightData.value))

  const allKeys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()

  return allKeys.map(key => {
    const lv = left[key] ?? null
    const rv = right[key] ?? null
    let status: 'same' | 'changed' | 'left-only' | 'right-only'

    if (lv === null) status = 'right-only'
    else if (rv === null) status = 'left-only'
    else if (lv === rv) status = 'same'
    else status = 'changed'

    return { key, left: lv, right: rv, status }
  })
})

const changedCount = computed(() => diffRows.value.filter(r => r.status !== 'same').length)

const showOnlyDiffs = ref(true)

const displayedRows = computed(() => {
  if (showOnlyDiffs.value) return diffRows.value.filter(r => r.status !== 'same')
  return diffRows.value
})

const statusColor: Record<string, string> = {
  same: 'neutral',
  changed: 'warning',
  'left-only': 'error',
  'right-only': 'info'
}

const statusLabel: Record<string, string> = {
  same: 'Same',
  changed: 'Changed',
  'left-only': 'Left only',
  'right-only': 'Right only'
}
</script>

<template>
  <UDashboardPanel id="settings-diff">
    <template #header>
      <UDashboardNavbar title="Config Diff">
        <template #left>
          <UButton to="/settings" icon="i-lucide-arrow-left" variant="ghost" color="neutral" size="sm" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 p-6">
        <!-- Side-by-side selectors -->
        <div class="grid grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-semibold text-sm">Left</span>
            </template>
            <div class="flex items-center gap-3">
              <div>
                <label class="text-xs text-muted block mb-1">App ID</label>
                <UInput v-model="leftAppId" size="sm" class="w-32" />
              </div>
              <div>
                <label class="text-xs text-muted block mb-1">Environment</label>
                <UInput v-model="leftEnv" size="sm" class="w-32" />
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <span class="font-semibold text-sm">Right</span>
            </template>
            <div class="flex items-center gap-3">
              <div>
                <label class="text-xs text-muted block mb-1">App ID</label>
                <UInput v-model="rightAppId" size="sm" class="w-32" />
              </div>
              <div>
                <label class="text-xs text-muted block mb-1">Environment</label>
                <UInput v-model="rightEnv" size="sm" class="w-32" />
              </div>
            </div>
          </UCard>
        </div>

        <!-- Errors -->
        <div v-if="leftError || rightError" class="text-sm text-muted">
          <p v-if="leftError">Left: Config service not available.</p>
          <p v-if="rightError">Right: Config service not available.</p>
        </div>

        <!-- Summary + toggle -->
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-sm">
            <span><strong>{{ diffRows.length }}</strong> keys</span>
            <span v-if="changedCount > 0" class="text-warning"><strong>{{ changedCount }}</strong> differences</span>
            <span v-else class="text-success">Identical</span>
          </div>
          <div class="flex items-center gap-2">
            <USwitch v-model="showOnlyDiffs" size="sm" />
            <span class="text-sm text-muted">Show diffs only</span>
          </div>
        </div>

        <!-- Diff table -->
        <UTable
          v-if="displayedRows.length"
          :data="displayedRows"
          :columns="[
            { accessorKey: 'key', header: 'Key' },
            { accessorKey: 'left', header: `${leftEnv} (${leftAppId})` },
            { accessorKey: 'right', header: `${rightEnv} (${rightAppId})` },
            { accessorKey: 'status', header: 'Status' }
          ]"
        >
          <template #key-cell="{ row }">
            <span class="font-mono text-sm">{{ row.original.key }}</span>
          </template>

          <template #left-cell="{ row }">
            <span
              class="font-mono text-sm truncate max-w-xs block"
              :class="row.original.status === 'right-only' ? 'text-muted italic' : ''"
            >
              {{ row.original.left ?? '—' }}
            </span>
          </template>

          <template #right-cell="{ row }">
            <span
              class="font-mono text-sm truncate max-w-xs block"
              :class="row.original.status === 'left-only' ? 'text-muted italic' : ''"
            >
              {{ row.original.right ?? '—' }}
            </span>
          </template>

          <template #status-cell="{ row }">
            <UBadge :color="(statusColor[row.original.status] as any) || 'neutral'" variant="subtle" size="sm">
              {{ statusLabel[row.original.status] }}
            </UBadge>
          </template>
        </UTable>

        <p v-else-if="!leftError && !rightError" class="text-sm text-muted text-center py-8">
          {{ showOnlyDiffs ? 'No differences found between these environments.' : 'No config entries found.' }}
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
