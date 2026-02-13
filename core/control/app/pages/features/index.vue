<script setup lang="ts">
const { data, refresh } = await useFetch('/api/control/features')

const search = ref('')

const filtered = computed(() => {
  if (!data.value) return []
  if (!search.value) return data.value.features
  const q = search.value.toLowerCase()
  return data.value.features.filter((f: any) => f.slug.toLowerCase().includes(q))
})

const columns = [
  { accessorKey: 'slug', header: 'Feature' },
  { accessorKey: 'wrapper_type', header: 'Type' },
  { accessorKey: 'invocation_count', header: 'Invocations' },
  { accessorKey: 'log_count', header: 'Logs' },
  { accessorKey: 'file_count', header: 'Files' },
  { accessorKey: 'has_knowledge', header: 'Knowledge' }
]
</script>

<template>
  <UDashboardPanel id="features">
    <template #header>
      <UDashboardNavbar title="Features">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="data" class="flex flex-col gap-4 p-6">
        <!-- Summary stats -->
        <div class="flex items-center gap-6 text-sm text-muted">
          <span><strong>{{ data.total }}</strong> features</span>
          <span><strong>{{ data.totalEdges }}</strong> edges</span>
          <span><strong>{{ data.totalFiles }}</strong> file mappings</span>
        </div>

        <!-- Search -->
        <UInput v-model="search" icon="i-lucide-search" placeholder="Filter features..." class="max-w-sm" />

        <!-- Table -->
        <UTable :data="filtered" :columns="columns">
          <template #slug-cell="{ row }">
            <NuxtLink :to="`/features/${row.original.slug}`" class="text-primary hover:underline font-medium">
              {{ row.original.slug }}
            </NuxtLink>
          </template>

          <template #has_knowledge-cell="{ row }">
            <UBadge
              :color="row.original.has_knowledge ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.has_knowledge ? 'Yes' : 'No' }}
            </UBadge>
          </template>
        </UTable>
      </div>

      <div v-else class="flex items-center justify-center h-64">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>
    </template>
  </UDashboardPanel>
</template>
