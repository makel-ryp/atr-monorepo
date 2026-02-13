<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

const { data: health, refresh } = await useFetch('/api/control/health')

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

useIntervalFn(() => refresh(), 30000)
</script>

<template>
  <UDashboardPanel id="health">
    <template #header>
      <UDashboardNavbar title="Health">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="health" class="flex flex-col gap-6 p-6">
        <!-- Stat cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-clock" class="text-primary size-5" />
              <div>
                <p class="text-sm text-muted">Uptime</p>
                <p class="text-lg font-semibold">{{ formatUptime(health.uptime) }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-memory-stick" class="text-primary size-5" />
              <div>
                <p class="text-sm text-muted">Memory</p>
                <p class="text-lg font-semibold">{{ health.memory.heapUsed }}MB / {{ health.memory.heapTotal }}MB</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-blocks" class="text-primary size-5" />
              <div>
                <p class="text-sm text-muted">Features</p>
                <p class="text-lg font-semibold">{{ health.features.count }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-scroll-text" class="size-5" :class="health.logs.errors > 0 ? 'text-error' : 'text-primary'" />
              <div>
                <p class="text-sm text-muted">Logs</p>
                <p class="text-lg font-semibold">
                  {{ health.logs.total }}
                  <span v-if="health.logs.errors > 0" class="text-sm text-error"> ({{ health.logs.errors }} errors)</span>
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Integration status -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-plug" class="size-4" />
              <span class="font-semibold">AI Integration</span>
            </div>
          </template>

          <div class="flex items-center gap-3">
            <UBadge :color="health.integrations.ok ? 'success' : 'warning'" variant="subtle">
              {{ health.integrations.ok ? 'Connected' : 'Issues' }}
            </UBadge>
            <span v-if="health.integrations.provider" class="text-sm text-muted">
              {{ health.integrations.provider }}
            </span>
          </div>
          <ul v-if="health.integrations.issues.length" class="mt-2 text-sm text-muted list-disc list-inside">
            <li v-for="issue in health.integrations.issues" :key="issue">{{ issue }}</li>
          </ul>
        </UCard>

        <!-- Config service stats -->
        <UCard v-if="health.configService">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-settings" class="size-4" />
              <span class="font-semibold">Config Service</span>
            </div>
          </template>

          <pre class="text-sm">{{ JSON.stringify(health.configService, null, 2) }}</pre>
        </UCard>

        <!-- Port allocation -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-network" class="size-4" />
              <span class="font-semibold">Port Allocation</span>
            </div>
          </template>

          <UTable
            :data="[
              { service: 'Documentation', port: health.ports.docs, url: `http://localhost:${health.ports.docs}` },
              { service: 'Control Plane', port: health.ports.control, url: `http://localhost:${health.ports.control}` },
              { service: 'Dashboard Demo', port: health.ports.dashboard, url: `http://localhost:${health.ports.dashboard}` },
              { service: 'SaaS Demo', port: health.ports.saas, url: `http://localhost:${health.ports.saas}` },
              { service: 'Landing Demo', port: health.ports.landing, url: `http://localhost:${health.ports.landing}` },
              { service: 'Chat Demo', port: health.ports.chat, url: `http://localhost:${health.ports.chat}` }
            ]"
            :columns="[
              { accessorKey: 'service', header: 'Service' },
              { accessorKey: 'port', header: 'Port' },
              { accessorKey: 'url', header: 'URL' }
            ]"
          />
        </UCard>
      </div>

      <div v-else class="flex items-center justify-center h-64">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>
    </template>
  </UDashboardPanel>
</template>
