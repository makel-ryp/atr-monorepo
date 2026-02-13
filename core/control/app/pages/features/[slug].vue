<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

const { data, refresh } = await useFetch(`/api/control/features/${slug}`)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: `Feature "${slug}" not found` })
}

const levelColor: Record<string, string> = {
  error: 'error',
  warn: 'warning',
  log: 'neutral'
}
</script>

<template>
  <UDashboardPanel id="feature-detail">
    <template #header>
      <UDashboardNavbar :title="slug">
        <template #left>
          <UButton to="/features" icon="i-lucide-arrow-left" variant="ghost" color="neutral" size="sm" />
        </template>
        <template #right>
          <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="data" class="flex flex-col gap-6 p-6">
        <!-- Registration -->
        <UCard>
          <template #header>
            <span class="font-semibold">Registration</span>
          </template>

          <div v-if="data.registration" class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-muted">Wrapper Type</p>
              <p class="font-medium">{{ data.registration.wrapper_type }}</p>
            </div>
            <div>
              <p class="text-muted">Invocations</p>
              <p class="font-medium">{{ data.registration.invocation_count }}</p>
            </div>
            <div>
              <p class="text-muted">Log Count</p>
              <p class="font-medium">{{ data.registration.log_count }}</p>
            </div>
            <div>
              <p class="text-muted">Last Seen</p>
              <p class="font-medium">{{ data.registration.last_seen }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            Not found in feature registry. The feature may not have been executed in dev mode yet.
          </p>
        </UCard>

        <!-- Dependencies -->
        <UCard>
          <template #header>
            <span class="font-semibold">Dependencies</span>
          </template>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div v-if="data.edges.uses.length">
              <p class="text-muted mb-1">Uses</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="s in data.edges.uses" :key="s" variant="subtle" size="sm">
                  <NuxtLink :to="`/features/${s}`">{{ s }}</NuxtLink>
                </UBadge>
              </div>
            </div>
            <div v-if="data.edges.usedBy.length">
              <p class="text-muted mb-1">Used By</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="s in data.edges.usedBy" :key="s" variant="subtle" size="sm">
                  <NuxtLink :to="`/features/${s}`">{{ s }}</NuxtLink>
                </UBadge>
              </div>
            </div>
            <div v-if="data.edges.contains.length">
              <p class="text-muted mb-1">Contains</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="s in data.edges.contains" :key="s" variant="subtle" size="sm">
                  <NuxtLink :to="`/features/${s}`">{{ s }}</NuxtLink>
                </UBadge>
              </div>
            </div>
            <div v-if="data.edges.containedBy.length">
              <p class="text-muted mb-1">Contained By</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="s in data.edges.containedBy" :key="s" variant="subtle" size="sm">
                  <NuxtLink :to="`/features/${s}`">{{ s }}</NuxtLink>
                </UBadge>
              </div>
            </div>
          </div>
          <p v-if="!data.edges.uses.length && !data.edges.usedBy.length && !data.edges.contains.length && !data.edges.containedBy.length" class="text-sm text-muted">
            No dependency edges found.
          </p>
        </UCard>

        <!-- Files -->
        <UCard>
          <template #header>
            <span class="font-semibold">Files ({{ data.files.length }})</span>
          </template>

          <UTable
            v-if="data.files.length"
            :data="data.files"
            :columns="[
              { accessorKey: 'file_path', header: 'File' },
              { accessorKey: 'line_start', header: 'Line' }
            ]"
          />
          <p v-else class="text-sm text-muted">
            No file mappings found.
          </p>
        </UCard>

        <!-- Knowledge -->
        <UCard>
          <template #header>
            <span class="font-semibold">Knowledge</span>
          </template>

          <div class="flex items-center gap-2">
            <UBadge :color="data.knowledge.exists ? 'success' : 'warning'" variant="subtle">
              {{ data.knowledge.exists ? 'Documented' : 'Missing' }}
            </UBadge>
            <span v-if="data.knowledge.path" class="text-sm text-muted">{{ data.knowledge.path }}</span>
          </div>
        </UCard>

        <!-- Recent Logs -->
        <UCard>
          <template #header>
            <span class="font-semibold">Recent Logs ({{ data.logs.length }})</span>
          </template>

          <UTable
            v-if="data.logs.length"
            :data="data.logs"
            :columns="[
              { accessorKey: 'timestamp', header: 'Time' },
              { accessorKey: 'level', header: 'Level' },
              { accessorKey: 'message', header: 'Message' }
            ]"
          >
            <template #level-cell="{ row }">
              <UBadge :color="(levelColor[row.original.level] as any) || 'neutral'" variant="subtle" size="sm">
                {{ row.original.level }}
              </UBadge>
            </template>
          </UTable>
          <p v-else class="text-sm text-muted">
            No recent logs for this feature.
          </p>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
