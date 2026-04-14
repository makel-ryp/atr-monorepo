<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { TableColumn } from '@nuxt/ui'

// ── File upload ───────────────────────────────────────────────────────────────
interface UploadZone {
  type: 'amazon' | 'sps'
  label: string
  hint: string
  icon: string
  files: File[]
  uploading: boolean
  results: { name: string; ok: boolean; error?: string }[]
}

// Function refs — Vue 3 safe alternative to dynamic $refs inside v-for
const fileInputRefs = new Map<string, HTMLInputElement>()
function setFileInputRef(el: Element | ComponentPublicInstance | null, type: string) {
  if (el) fileInputRefs.set(type, el as HTMLInputElement)
  else fileInputRefs.delete(type)
}
function openFilePicker(type: string) {
  fileInputRefs.get(type)?.click()
}

const uploadZones = ref<UploadZone[]>([
  {
    type: 'amazon',
    label: 'Amazon Reports',
    hint: 'Orders Report or FBA Inventory Report (.csv / .tsv)',
    icon: 'i-lucide-package',
    files: [],
    uploading: false,
    results: [],
  },
  {
    type: 'sps',
    label: 'SPS Commerce',
    hint: 'EDI 850 / 856 / 810 / 855 CSV exports (.csv)',
    icon: 'i-lucide-file-spreadsheet',
    files: [],
    uploading: false,
    results: [],
  },
])

function onFileDrop(zone: UploadZone, event: DragEvent) {
  event.preventDefault()
  const dropped = Array.from(event.dataTransfer?.files ?? [])
  zone.files.push(...dropped)
}

function onFileInput(zone: UploadZone, event: Event) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files ?? [])
  zone.files.push(...selected)
  input.value = ''
}

function removeFile(zone: UploadZone, idx: number) {
  zone.files.splice(idx, 1)
}

async function uploadZone(zone: UploadZone) {
  if (!zone.files.length) return
  zone.uploading = true
  zone.results = []

  let pipelineAutoStarted = false
  for (const file of zone.files) {
    const form = new FormData()
    form.append('type', zone.type)
    form.append('file', file)
    try {
      const res = await $fetch<{ ok: boolean; pipeline_started: boolean }>('/api/upload', { method: 'POST', body: form })
      zone.results.push({ name: file.name, ok: true })
      if (res.pipeline_started) pipelineAutoStarted = true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      zone.results.push({ name: file.name, ok: false, error: msg })
    }
  }

  zone.files = []
  zone.uploading = false

  const successCount = zone.results.filter(r => r.ok).length
  toast.add({
    title: `${zone.label} upload complete`,
    description: pipelineAutoStarted
      ? `${successCount} of ${zone.results.length} files saved — pipeline started, dashboard will update shortly`
      : `${successCount} of ${zone.results.length} files saved — pipeline already running`,
    color: zone.results.every(r => r.ok) ? 'success' : 'warning',
  })

  if (pipelineAutoStarted) {
    pipelineRunning.value = true
    startPolling()
    fetchStatus()
  }
}

interface PipelineStatus {
  last_run_at: string | null
  steps: { source: string; status: string; records_pulled: number | null; notes: string | null }[]
  overall: 'ok' | 'error' | 'running' | 'unknown'
}

interface SkuParam {
  sku: string
  lead_time_days: number | null
  moq: number | null
  carton_qty: number | null
  shipping_method: string | null
  notes: string | null
  updated_at: string | null
}

const UButton = resolveComponent('UButton')
const UInput = resolveComponent('UInput')
const UBadge = resolveComponent('UBadge')

// ── Pipeline ─────────────────────────────────────────────────────────────────
const pipelineRunning = ref(false)
const narrativeRunning = ref(false)
const pipelineStatus = ref<PipelineStatus | null>(null)
const pollInterval = ref<ReturnType<typeof setInterval> | null>(null)
const toast = useToast()

async function fetchStatus() {
  pipelineStatus.value = await $fetch<PipelineStatus>('/api/pipeline/status')
  if (pipelineStatus.value?.overall !== 'running') {
    stopPolling()
    if (pipelineRunning.value) {
      pipelineRunning.value = false
      toast.add({ title: 'Pipeline complete', color: 'success' })
    }
  }
}

function startPolling() {
  if (pollInterval.value) return
  pollInterval.value = setInterval(fetchStatus, 3000)
}

function stopPolling() {
  if (pollInterval.value) { clearInterval(pollInterval.value); pollInterval.value = null }
}

async function runPipeline() {
  pipelineRunning.value = true
  try {
    await $fetch('/api/pipeline/run', { method: 'POST' })
    toast.add({ title: 'Pipeline started', color: 'info' })
    startPolling()
    fetchStatus()
  } catch {
    pipelineRunning.value = false
    toast.add({ title: 'Failed to start pipeline', color: 'error' })
  }
}

async function runNarrative() {
  narrativeRunning.value = true
  try {
    await $fetch('/api/pipeline/run-narrative', { method: 'POST' })
    toast.add({ title: 'Narrative generation started', color: 'info' })
  } catch {
    toast.add({ title: 'Failed to start narrative generation', color: 'error' })
  } finally {
    narrativeRunning.value = false
  }
}

onMounted(fetchStatus)
onUnmounted(stopPolling)

function stepColor(status: string) {
  switch (status) {
    case 'ok':      return 'success' as const
    case 'error':   return 'error' as const
    case 'running': return 'warning' as const
    default:        return 'neutral' as const
  }
}

// ── SKU Params ───────────────────────────────────────────────────────────────
const { data: skuParams, refresh: refreshParams } = await useFetch<SkuParam[]>('/api/sku-params', {
  default: () => [] as SkuParam[],
})
const editingRow = ref<string | null>(null)
const editValues = ref<Partial<SkuParam>>({})
const savingRow = ref<string | null>(null)

function startEdit(row: SkuParam) {
  editingRow.value = row.sku
  editValues.value = { ...row }
}

function cancelEdit() {
  editingRow.value = null
  editValues.value = {}
}

async function saveRow(sku: string) {
  savingRow.value = sku
  try {
    await $fetch(`/api/sku-params/${sku}`, { method: 'PUT', body: editValues.value })
    toast.add({ title: `SKU ${sku} saved`, color: 'success' })
    editingRow.value = null
    await refreshParams()
  } catch {
    toast.add({ title: 'Save failed', color: 'error' })
  } finally {
    savingRow.value = null
  }
}

const skuColumns: TableColumn<SkuParam>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  {
    accessorKey: 'lead_time_days',
    header: 'Lead Time (days)',
    cell: ({ row }) => {
      if (editingRow.value === row.original.sku) {
        return h(UInput, {
          modelValue: editValues.value.lead_time_days,
          'onUpdate:modelValue': (v: number) => { editValues.value.lead_time_days = v },
          type: 'number', size: 'xs', class: 'w-24',
        })
      }
      return row.original.lead_time_days ?? '—'
    },
  },
  {
    accessorKey: 'moq',
    header: 'MOQ',
    cell: ({ row }) => {
      if (editingRow.value === row.original.sku) {
        return h(UInput, {
          modelValue: editValues.value.moq,
          'onUpdate:modelValue': (v: number) => { editValues.value.moq = v },
          type: 'number', size: 'xs', class: 'w-24',
        })
      }
      return row.original.moq ?? '—'
    },
  },
  {
    accessorKey: 'carton_qty',
    header: 'Carton Qty',
    cell: ({ row }) => {
      if (editingRow.value === row.original.sku) {
        return h(UInput, {
          modelValue: editValues.value.carton_qty,
          'onUpdate:modelValue': (v: number) => { editValues.value.carton_qty = v },
          type: 'number', size: 'xs', class: 'w-24',
        })
      }
      return row.original.carton_qty ?? '—'
    },
  },
  {
    accessorKey: 'shipping_method',
    header: 'Shipping',
    cell: ({ row }) => {
      if (editingRow.value === row.original.sku) {
        return h(UInput, {
          modelValue: editValues.value.shipping_method ?? '',
          'onUpdate:modelValue': (v: string) => { editValues.value.shipping_method = v },
          size: 'xs', class: 'w-28',
        })
      }
      return row.original.shipping_method ?? '—'
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => {
      if (editingRow.value === row.original.sku) {
        return h(UInput, {
          modelValue: editValues.value.notes ?? '',
          'onUpdate:modelValue': (v: string) => { editValues.value.notes = v },
          size: 'xs', class: 'w-48',
        })
      }
      return h('span', { class: 'text-muted text-xs truncate max-w-[180px] block' }, row.original.notes ?? '—')
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const sku = row.original.sku
      if (editingRow.value === sku) {
        return h('div', { class: 'flex gap-2' }, [
          h(UButton, {
            size: 'xs',
            loading: savingRow.value === sku,
            onClick: () => saveRow(sku),
          }, () => 'Save'),
          h(UButton, {
            size: 'xs', color: 'neutral', variant: 'ghost',
            onClick: cancelEdit,
          }, () => 'Cancel'),
        ])
      }
      return h(UButton, {
        size: 'xs', color: 'neutral', variant: 'ghost',
        icon: 'i-lucide-pencil',
        onClick: () => startEdit(row.original),
      })
    },
  },
]
</script>

<template>
  <UDashboardPanel id="admin">
    <template #header>
      <UDashboardNavbar title="Admin" />
    </template>

    <template #body>
      <div class="space-y-8">

        <!-- Pipeline control -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-play-circle" class="text-primary h-4 w-4" />
              <span class="font-semibold text-sm">Pipeline Control</span>
            </div>
          </template>

          <div class="flex flex-wrap gap-3 mb-5">
            <UButton
              :loading="pipelineRunning"
              :disabled="pipelineStatus?.overall === 'running'"
              icon="i-lucide-play"
              @click="runPipeline"
            >Run Pipeline</UButton>
            <UButton
              :loading="narrativeRunning"
              color="neutral"
              variant="outline"
              icon="i-lucide-file-text"
              @click="runNarrative"
            >Generate Brief</UButton>
          </div>

          <div v-if="pipelineStatus" class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">Last run:</span>
              <span class="text-sm font-medium">{{ pipelineStatus.last_run_at ?? 'Never' }}</span>
              <UBadge
                :color="pipelineStatus.overall === 'ok' ? 'success' : pipelineStatus.overall === 'error' ? 'error' : pipelineStatus.overall === 'running' ? 'warning' : 'neutral'"
                variant="soft"
                size="xs"
              >{{ pipelineStatus.overall.toUpperCase() }}</UBadge>
            </div>

            <div v-if="pipelineStatus.steps.length" class="rounded-lg border divide-y">
              <div
                v-for="step in pipelineStatus.steps"
                :key="step.source"
                class="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span class="font-medium">{{ step.source }}</span>
                <div class="flex items-center gap-3">
                  <span class="text-muted">{{ step.records_pulled ?? 0 }} rows</span>
                  <UBadge :color="stepColor(step.status)" variant="soft" size="xs">{{ step.status }}</UBadge>
                </div>
              </div>
            </div>
            <div v-else class="text-sm text-muted">No step data yet.</div>
          </div>
        </UCard>

        <!-- Data Uploads -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-upload-cloud" class="text-primary h-4 w-4" />
              <span class="font-semibold text-sm">Upload Data Files</span>
            </div>
          </template>

          <p class="text-sm text-muted mb-5">
            Drop exported CSV/TSV files here. The pipeline will start automatically after upload and the dashboard will update within a minute.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="zone in uploadZones" :key="zone.type" class="space-y-3">
              <div class="flex items-center gap-2">
                <UIcon :name="zone.icon" class="h-4 w-4 text-muted" />
                <span class="font-medium text-sm">{{ zone.label }}</span>
              </div>
              <p class="text-xs text-muted">{{ zone.hint }}</p>

              <!-- Drop zone -->
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
                @dragover.prevent
                @drop="onFileDrop(zone, $event)"
                @click="openFilePicker(zone.type)"
              >
                <UIcon name="i-lucide-cloud-upload" class="h-8 w-8 mx-auto mb-2 text-muted" />
                <p class="text-sm text-muted">Drag & drop or <span class="text-primary font-medium">browse</span></p>
                <input
                  :ref="(el) => setFileInputRef(el, zone.type)"
                  type="file"
                  multiple
                  accept=".csv,.tsv,.txt"
                  class="hidden"
                  @change="onFileInput(zone, $event)"
                />
              </div>

              <!-- Staged files -->
              <div v-if="zone.files.length" class="space-y-1">
                <div
                  v-for="(file, idx) in zone.files"
                  :key="idx"
                  class="flex items-center justify-between text-xs bg-muted/40 rounded px-3 py-1.5"
                >
                  <span class="truncate max-w-[200px]">{{ file.name }}</span>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-muted">{{ (file.size / 1024).toFixed(0) }} KB</span>
                    <UButton
                      size="xs" color="neutral" variant="ghost"
                      icon="i-lucide-x"
                      @click.stop="removeFile(zone, idx)"
                    />
                  </div>
                </div>
                <UButton
                  size="xs"
                  :loading="zone.uploading"
                  icon="i-lucide-upload"
                  class="mt-2 w-full"
                  @click="uploadZone(zone)"
                >
                  Upload {{ zone.files.length }} file{{ zone.files.length > 1 ? 's' : '' }}
                </UButton>
              </div>

              <!-- Results -->
              <div v-if="zone.results.length" class="space-y-1">
                <div
                  v-for="result in zone.results"
                  :key="result.name"
                  class="flex items-center gap-2 text-xs px-2 py-1 rounded"
                  :class="result.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
                >
                  <UIcon :name="result.ok ? 'i-lucide-check' : 'i-lucide-alert-circle'" class="h-3 w-3 shrink-0" />
                  <span class="truncate">{{ result.name }}</span>
                  <span v-if="result.error" class="text-muted truncate">— {{ result.error }}</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- SKU Params editor — ClientOnly because h(UInput) cell renderers differ SSR vs client -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-sliders-horizontal" class="text-primary h-4 w-4" />
              <span class="font-semibold text-sm">SKU Parameters</span>
            </div>
          </template>
          <ClientOnly>
            <UTable :data="skuParams ?? []" :columns="skuColumns" />
            <template #fallback>
              <div class="text-sm text-muted py-4 text-center">Loading SKU parameters…</div>
            </template>
          </ClientOnly>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
