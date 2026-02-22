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

const loginConfig = computed(() => auth?.login ?? {
  title: 'Welcome back',
  icon: 'i-lucide-lock',
  description: "Don't have an account?",
  descriptionLink: { label: 'Sign up', to: '/signup' },
  submitLabel: 'Sign in',
  fields: [{
    name: 'email',
    type: 'text',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true
  }, {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password'
  }]
})

const fields = computed(() => (loginConfig.value.fields ?? []).filter(
  (f: { type: string }) => f.type !== 'checkbox'
))

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
  email: z.email('Invalid email'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: payload.data
    })
    await refreshSession()
    await navigateTo('/')
  } catch (err: any) {
    toast.add({
      title: 'Login failed',
      description: err?.data?.statusMessage || 'Invalid email or password',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

useSeoMeta({
  title: loginConfig.value.seo?.title ?? 'Login',
  description: loginConfig.value.seo?.description ?? 'Login to your account'
})
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    :providers="providers"
    :title="loginConfig.title"
    :icon="loginConfig.icon"
    :submit="{ label: loginConfig.submitLabel ?? 'Sign in' }"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #description>
      {{ loginConfig.description }} <ULink
        :to="loginConfig.descriptionLink?.to ?? '/signup'"
        class="text-primary font-medium"
      >{{ loginConfig.descriptionLink?.label ?? 'Sign up' }}</ULink>.
    </template>

    <template #password-hint>
      <ULink
        v-if="loginConfig.forgotPasswordLink"
        :to="loginConfig.forgotPasswordLink.to"
        class="text-primary font-medium"
        tabindex="-1"
      >{{ loginConfig.forgotPasswordLink.label }}</ULink>
    </template>

    <template #footer>
      {{ loginConfig.termsText }} <ULink
        :to="loginConfig.termsLink?.to ?? '/'"
        class="text-primary font-medium"
      >{{ loginConfig.termsLink?.label ?? 'Terms of Service' }}</ULink>.
    </template>
  </UAuthForm>
</template>
