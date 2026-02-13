<script setup lang="ts">
const { data } = await useFetch('/api/control/i18n')

const search = ref('')
const selectedLayer = ref<string>('')

const filteredKeys = computed(() => {
  if (!data.value) return []
  return Object.entries(data.value.translations)
    .filter(([key, entry]) => {
      if (search.value && !key.toLowerCase().includes(search.value.toLowerCase())) {
        // Also search values
        const matchesValue = Object.values(entry.values).some(v =>
          v.toLowerCase().includes(search.value.toLowerCase())
        )
        if (!matchesValue) return false
      }
      if (selectedLayer.value && entry.layer !== selectedLayer.value) return false
      return true
    })
    .map(([key, entry]) => ({
      key,
      layer: entry.layer,
      ...entry.values
    }))
})

const columns = computed(() => {
  const cols = [
    { key: 'key', label: 'Key', sortable: true },
    { key: 'layer', label: 'Layer', sortable: true }
  ]
  if (data.value) {
    for (const locale of data.value.locales) {
      cols.push({ key: locale, label: locale.toUpperCase(), sortable: false })
    }
  }
  return cols
})

const layerOptions = computed(() => [
  { label: 'All layers', value: '' },
  ...(data.value?.layers.map(l => ({ label: l, value: l })) ?? [])
])
</script>

<template>
  <UDashboardPanel id="i18n" :ui="{ body: 'p-4 sm:p-6' }">
    <template #header>
      <UDashboardNavbar title="Translations">
        <template #leading>
          <UBadge v-if="data" variant="subtle" size="sm">
            {{ data.totalKeys }} keys
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex items-center gap-3 mb-4">
        <UInput
          v-model="search"
          placeholder="Search keys or values..."
          icon="i-lucide-search"
          class="flex-1 max-w-sm"
        />
        <USelect
          v-model="selectedLayer"
          :items="layerOptions"
          class="w-40"
        />
        <UBadge variant="subtle" size="sm" class="ml-auto">
          {{ filteredKeys.length }} shown
        </UBadge>
      </div>

      <UTable
        :data="filteredKeys"
        :columns="columns"
        class="w-full"
      >
        <template #key-cell="{ row }">
          <code class="text-xs font-mono">{{ row.original.key }}</code>
        </template>
        <template #layer-cell="{ row }">
          <UBadge
            :color="row.original.layer === 'core' ? 'info' : 'success'"
            variant="subtle"
            size="xs"
          >
            {{ row.original.layer }}
          </UBadge>
        </template>
        <template v-for="locale in data?.locales" :key="locale" #[`${locale}-cell`]="{ row }">
          <span class="text-sm">{{ row.original[locale] || '—' }}</span>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
