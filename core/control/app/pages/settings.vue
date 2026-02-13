<script setup lang="ts">
const appId = ref('default')
const environment = ref('development')

const settingsQuery = computed(() => ({
  appId: appId.value,
  environment: environment.value
}))

const { data: settings, refresh: refreshSettings, error: settingsError } = await useFetch('/api/settings', {
  query: settingsQuery
})

const { data: stats, refresh: refreshStats } = await useFetch('/api/settings/stats')

const auditQuery = computed(() => ({
  appId: appId.value,
  environment: environment.value
}))

const { data: audit, refresh: refreshAudit } = await useFetch('/api/settings/audit', {
  query: auditQuery
})

function refreshAll() {
  refreshSettings()
  refreshStats()
  refreshAudit()
}

const editingKey = ref('')
const editingValue = ref('')

function startEdit(key: string, value: any) {
  editingKey.value = key
  editingValue.value = typeof value === 'string' ? value : JSON.stringify(value)
}

async function saveEdit() {
  if (!editingKey.value) return

  try {
    await $fetch(`/api/settings/${editingKey.value}`, {
      method: 'PUT',
      body: {
        value: editingValue.value,
        appId: appId.value,
        environment: environment.value
      }
    })
    editingKey.value = ''
    editingValue.value = ''
    refreshSettings()
  }
  catch (err: any) {
    console.error('Failed to save setting:', err)
  }
}

function cancelEdit() {
  editingKey.value = ''
  editingValue.value = ''
}

const configEntries = computed(() => {
  if (!settings.value || typeof settings.value !== 'object') return []
  const config = (settings.value as any).config || settings.value
  if (typeof config !== 'object') return []

  return Object.entries(config).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    locked: ((settings.value as any).lockedPaths || []).includes(key)
  }))
})
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refreshAll()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 p-6">
        <!-- Selectors -->
        <div class="flex items-center gap-4">
          <div>
            <label class="text-sm text-muted block mb-1">App ID</label>
            <UInput v-model="appId" size="sm" class="w-40" />
          </div>
          <div>
            <label class="text-sm text-muted block mb-1">Environment</label>
            <UInput v-model="environment" size="sm" class="w-40" />
          </div>
        </div>

        <!-- Stats -->
        <UCard v-if="stats">
          <template #header>
            <span class="font-semibold">Stats</span>
          </template>
          <pre class="text-sm overflow-auto">{{ JSON.stringify(stats, null, 2) }}</pre>
        </UCard>

        <!-- Config viewer -->
        <UCard>
          <template #header>
            <span class="font-semibold">Effective Config</span>
          </template>

          <div v-if="settingsError" class="text-sm text-muted">
            <p>Config service not available. Set CORE_DATASOURCE_* env vars to enable.</p>
          </div>

          <UTable
            v-else-if="configEntries.length"
            :data="configEntries"
            :columns="[
              { accessorKey: 'key', header: 'Key' },
              { accessorKey: 'value', header: 'Value' },
              { accessorKey: 'locked', header: 'Locked' },
              { id: 'actions', header: '' }
            ]"
          >
            <template #key-cell="{ row }">
              <span class="font-mono text-sm">{{ row.original.key }}</span>
            </template>

            <template #value-cell="{ row }">
              <template v-if="editingKey === row.original.key">
                <div class="flex items-center gap-2">
                  <UInput v-model="editingValue" size="sm" class="flex-1" @keydown.enter="saveEdit" @keydown.escape="cancelEdit" />
                  <UButton icon="i-lucide-check" size="xs" @click="saveEdit" />
                  <UButton icon="i-lucide-x" size="xs" variant="ghost" @click="cancelEdit" />
                </div>
              </template>
              <span v-else class="text-sm font-mono truncate max-w-md block">{{ row.original.value }}</span>
            </template>

            <template #locked-cell="{ row }">
              <UIcon v-if="row.original.locked" name="i-lucide-lock" class="size-4 text-muted" />
            </template>

            <template #actions-cell="{ row }">
              <UButton
                v-if="!row.original.locked && editingKey !== row.original.key"
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                @click="startEdit(row.original.key, row.original.value)"
              />
            </template>
          </UTable>

          <p v-else class="text-sm text-muted">No config entries found.</p>
        </UCard>

        <!-- Audit log -->
        <UCard v-if="audit">
          <template #header>
            <span class="font-semibold">Audit Log</span>
          </template>
          <pre class="text-sm overflow-auto max-h-96">{{ JSON.stringify(audit, null, 2) }}</pre>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
