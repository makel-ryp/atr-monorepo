<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface PipelineEntry {
  id: number
  sku: string
  product_title: string | null
  type: string | null
  qty_to_warehouse: number | null
  qty_to_fba: number | null
  total_quantity: number | null
  expected_arrival_warehouse: string | null
  expected_arrival_fba: string | null
  po_number: string | null
  notes: string | null
  active: string | null
  arrived_date: string | null
  created_at: string | null
}

const UBadge  = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const { data: pipeline, refresh } = await useFetch<PipelineEntry[]>('/api/stock-pipeline')
const toast = useToast()

const showArchived = ref(false)

const rows = computed(() =>
  (pipeline.value ?? []).filter(r =>
    showArchived.value ? true : r.active?.toUpperCase() !== 'FALSE'
  )
)

// ── Add Shipment modal ────────────────────────────────────────────────────────
const showModal = ref(false)
const submitting = ref(false)

const form = reactive({
  sku: '',
  type: 'sea',
  qty_to_warehouse: 0,
  qty_to_fba: 0,
  expected_arrival_warehouse: '',
  expected_arrival_fba: '',
  po_number: '',
  notes: '',
})

const typeOptions = [
  { label: 'Sea Freight', value: 'sea' },
  { label: 'Air Freight', value: 'air' },
  { label: 'Land / Truck', value: 'land' },
  { label: 'Production Run', value: 'production' },
]

function resetForm() {
  form.sku = ''
  form.type = 'sea'
  form.qty_to_warehouse = 0
  form.qty_to_fba = 0
  form.expected_arrival_warehouse = ''
  form.expected_arrival_fba = ''
  form.po_number = ''
  form.notes = ''
}

async function addShipment() {
  if (!form.sku.trim() || !form.expected_arrival_warehouse) {
    toast.add({ title: 'SKU and warehouse arrival date are required', color: 'error' })
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/stock-pipeline', {
      method: 'POST',
      body: {
        sku: form.sku.trim(),
        type: form.type || null,
        qty_to_warehouse: Number(form.qty_to_warehouse) || 0,
        qty_to_fba: Number(form.qty_to_fba) || 0,
        expected_arrival_warehouse: form.expected_arrival_warehouse,
        expected_arrival_fba: form.expected_arrival_fba || null,
        po_number: form.po_number || null,
        notes: form.notes || null,
      },
    })
    toast.add({ title: 'Shipment added', color: 'success' })
    showModal.value = false
    resetForm()
    await refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add shipment'
    toast.add({ title: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}

// ── Mark as Arrived ───────────────────────────────────────────────────────────
const markingId = ref<number | null>(null)

async function markArrived(id: number) {
  markingId.value = id
  try {
    await $fetch('/api/stock-pipeline', {
      method: 'PUT',
      body: {
        id,
        active: 'FALSE',
        arrived_date: new Date().toISOString().slice(0, 10),
      },
    })
    toast.add({ title: 'Marked as arrived', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to update shipment', color: 'error' })
  } finally {
    markingId.value = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function typeColor(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'sea':        return 'info'    as const
    case 'air':        return 'warning' as const
    case 'land':       return 'success' as const
    case 'production': return 'primary' as const
    default:           return 'neutral' as const
  }
}

// ── Table columns ─────────────────────────────────────────────────────────────
const activeCount  = computed(() => (pipeline.value ?? []).filter(r => r.active?.toUpperCase() !== 'FALSE').length)
const totalUnits   = computed(() => rows.value.reduce((s, r) => s + (r.total_quantity ?? 0), 0))
const arrivingSoon = computed(() => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 14)
  return rows.value.filter(r => {
    const d = r.expected_arrival_warehouse || r.expected_arrival_fba
    return d && new Date(d) <= cutoff
  }).length
})

const columns: TableColumn<PipelineEntry>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'product_title', header: 'Product' },
  {
    accessorKey: 'type',
    header: 'Ship Method',
    cell: ({ row }) => {
      const t = row.original.type
      if (!t) return '—'
      return h(UBadge, { color: typeColor(t), variant: 'soft', size: 'xs' }, () => t.toUpperCase())
    },
  },
  {
    accessorKey: 'po_number',
    header: 'PO #',
    cell: ({ row }) => row.original.po_number ?? '—',
  },
  {
    accessorKey: 'qty_to_warehouse',
    header: 'To WH',
    cell: ({ row }) => fmt(row.original.qty_to_warehouse),
  },
  {
    accessorKey: 'qty_to_fba',
    header: 'To FBA',
    cell: ({ row }) => fmt(row.original.qty_to_fba),
  },
  {
    accessorKey: 'total_quantity',
    header: 'Total Units',
    cell: ({ row }) => fmt(row.original.total_quantity),
  },
  {
    accessorKey: 'expected_arrival_warehouse',
    header: 'WH Arrival',
    cell: ({ row }) => fmtDate(row.original.expected_arrival_warehouse),
  },
  {
    accessorKey: 'expected_arrival_fba',
    header: 'FBA Arrival',
    cell: ({ row }) => fmtDate(row.original.expected_arrival_fba),
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => {
      const arrived = !!row.original.arrived_date
      const active  = row.original.active?.toUpperCase() !== 'FALSE'
      if (arrived) return h(UBadge, { color: 'success' as const, variant: 'soft', size: 'xs' }, () => 'Arrived')
      if (active)  return h(UBadge, { color: 'info'    as const, variant: 'soft', size: 'xs' }, () => 'In Transit')
      return h(UBadge, { color: 'neutral' as const, variant: 'soft', size: 'xs' }, () => 'Archived')
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => h('span', { class: 'text-muted text-xs truncate max-w-[180px] block' }, row.original.notes ?? '—'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const entry = row.original
      const isActive = entry.active?.toUpperCase() !== 'FALSE' && !entry.arrived_date
      if (!isActive) return null
      return h(UButton, {
        size: 'xs',
        color: 'success',
        variant: 'soft',
        loading: markingId.value === entry.id,
        onClick: () => markArrived(entry.id),
      }, () => 'Mark Arrived')
    },
  },
]
</script>

<template>
  <UDashboardPanel id="stock-pipeline">
    <template #header>
      <UDashboardNavbar title="Stock Pipeline">
        <template #right>
          <USwitch v-model="showArchived" label="Show archived" />
          <UButton icon="i-lucide-plus" @click="showModal = true">Add Shipment</UButton>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" @click="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">

        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4">
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Active Orders</p>
            <p class="text-2xl font-semibold">{{ activeCount }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Units In Transit</p>
            <p class="text-2xl font-semibold">{{ totalUnits.toLocaleString() }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-muted uppercase mb-1">Arriving ≤14 Days</p>
            <p class="text-2xl font-semibold" :class="arrivingSoon > 0 ? 'text-success' : ''">{{ arrivingSoon }}</p>
          </UCard>
        </div>

        <!-- Table -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-package" class="h-4 w-4 text-primary" />
              <span class="font-semibold text-sm">Incoming Shipments</span>
              <UBadge color="neutral" variant="soft" size="xs">{{ rows.length }}</UBadge>
            </div>
          </template>
          <ClientOnly>
            <UTable :data="rows" :columns="columns" />
            <template #fallback>
              <div class="text-sm text-muted py-4 text-center">Loading shipments…</div>
            </template>
          </ClientOnly>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Shipment Modal — ClientOnly prevents teleport hydration mismatch -->
  <ClientOnly>
  <UModal v-model:open="showModal" title="Add Shipment" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="SKU *" class="col-span-2">
            <UInput v-model="form.sku" placeholder="e.g. 2" class="w-full" />
          </UFormField>

          <UFormField label="Ship Method">
            <USelect v-model="form.type" :options="typeOptions" value-attribute="value" label-attribute="label" class="w-full" />
          </UFormField>

          <UFormField label="PO Number">
            <UInput v-model="form.po_number" placeholder="PO-2026-001" class="w-full" />
          </UFormField>

          <UFormField label="Qty to Warehouse">
            <UInput v-model.number="form.qty_to_warehouse" type="number" min="0" class="w-full" />
          </UFormField>

          <UFormField label="Qty to FBA">
            <UInput v-model.number="form.qty_to_fba" type="number" min="0" class="w-full" />
          </UFormField>

          <UFormField label="WH Arrival Date *" class="col-span-2">
            <UInput v-model="form.expected_arrival_warehouse" type="date" class="w-full" />
          </UFormField>

          <UFormField label="FBA Arrival Date">
            <UInput v-model="form.expected_arrival_fba" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Notes" class="col-span-2">
            <UInput v-model="form.notes" placeholder="Optional notes" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton color="neutral" variant="ghost" @click="showModal = false; resetForm()">Cancel</UButton>
        <UButton :loading="submitting" @click="addShipment">Add Shipment</UButton>
      </div>
    </template>
  </UModal>
  </ClientOnly>
</template>
