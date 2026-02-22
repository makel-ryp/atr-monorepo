<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

const { auth } = useAppConfig()
const { login: authLogin } = useAuth()
const { fetch: refreshSession } = useUserSession()
const toast = useToast()

const signupConfig = computed(() => auth?.signup ?? {
  title: 'Create an account',
  description: 'Already have an account?',
  descriptionLink: { label: 'Login', to: '/login' },
  submitLabel: 'Create account',
  fields: [{
    name: 'name',
    type: 'text',
    label: 'Name',
    placeholder: 'Enter your name'
  }, {
    name: 'email',
    type: 'text',
    label: 'Email',
    placeholder: 'Enter your email'
  }, {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password'
  }]
})

const fields = computed(() => signupConfig.value.fields ?? [])

const configProviders = computed(() => auth?.providers ?? [
  { label: 'Google', icon: 'i-simple-icons-google', id: 'google' },
  { label: 'GitHub', icon: 'i-simple-icons-github', id: 'github' }
])

const providers = computed(() => configProviders.value.map((p: { label: string, icon: string, id: string }) => ({
  label: p.label,
  icon: p.icon,
  onClick: () => authLogin(p.id)
})))

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: payload.data
    })
    await refreshSession()
    await navigateTo('/')
  } catch (err: any) {
    const message = err?.data?.statusMessage || 'Registration failed'
    toast.add({
      title: 'Sign up failed',
      description: message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

useSeoMeta({
  title: signupConfig.value.seo?.title ?? 'Sign up',
  description: signupConfig.value.seo?.description ?? 'Create an account to get started'
})
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    :providers="providers"
    :title="signupConfig.title"
    :submit="{ label: signupConfig.submitLabel ?? 'Create account' }"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #description>
      {{ signupConfig.description }} <ULink
        :to="signupConfig.descriptionLink?.to ?? '/login'"
        class="text-primary font-medium"
      >{{ signupConfig.descriptionLink?.label ?? 'Login' }}</ULink>.
    </template>

    <template #footer>
      {{ signupConfig.termsText }} <ULink
        :to="signupConfig.termsLink?.to ?? '/'"
        class="text-primary font-medium"
      >{{ signupConfig.termsLink?.label ?? 'Terms of Service' }}</ULink>.
    </template>
  </UAuthForm>
</template>
