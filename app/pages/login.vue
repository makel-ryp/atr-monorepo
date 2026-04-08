<script setup lang="ts">
definePageMeta({ layout: false })

const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: password.value }
    })
    await navigateTo('/')
  } catch {
    error.value = 'Incorrect password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-boxes" class="text-primary h-5 w-5" />
          <span class="font-semibold">Inventory Dashboard</span>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Password">
          <UInput
            v-model="password"
            type="password"
            placeholder="Enter password"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />

        <UButton type="submit" :loading="loading" block>
          Sign in
        </UButton>
      </form>
    </UCard>
  </div>
</template>
