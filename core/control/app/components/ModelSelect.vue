<script setup lang="ts">
const { model, models, formatModelName } = useModels()

function modelIcon(m: string) {
  const prefix = m.split('/')[0]
  return prefix ? `i-simple-icons-${prefix}` : 'i-lucide-bot'
}

const items = computed(() => models.value.map(m => ({
  label: formatModelName(m),
  value: m,
  icon: modelIcon(m)
})))
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    size="sm"
    :icon="modelIcon(model)"
    variant="ghost"
    value-key="value"
    class="hover:bg-default focus:bg-default data-[state=open]:bg-default"
    :ui="{
      trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
    }"
  />
</template>
