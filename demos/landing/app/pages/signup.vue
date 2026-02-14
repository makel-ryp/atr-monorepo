<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

const { auth } = useAppConfig()
const { login: authLogin } = useAuth()

const signupConfig = computed(() => auth?.signup ?? {
  title: 'Create an account',
  description: 'Already have an account?',
  descriptionLink: { label: 'Login', to: '/login' },
  termsText: 'By signing up, you agree to our',
  termsLink: { label: 'Terms of Service', to: '/' },
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
  }],
  seo: {
    title: 'Sign up',
    description: 'Create an account to get started'
  }
})

const seoConfig = computed(() => signupConfig.value.seo ?? { title: 'Sign up', description: 'Create an account to get started' })

useSeoMeta({
  title: seoConfig.value.title,
  description: seoConfig.value.description
})

const fields = computed(() => signupConfig.value.fields ?? [{
  name: 'name',
  type: 'text' as const,
  label: 'Name',
  placeholder: 'Enter your name'
}, {
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'Enter your email'
}, {
  name: 'password',
  label: 'Password',
  type: 'password' as const,
  placeholder: 'Enter your password'
}])

const configProviders = computed(() => auth?.providers ?? [
  { label: 'Google', icon: 'i-simple-icons-google', id: 'google' },
  { label: 'GitHub', icon: 'i-simple-icons-github', id: 'github' }
])

const providers = computed(() => configProviders.value.map((p: { label: string, icon: string, id: string }) => ({
  label: p.label,
  icon: p.icon,
  onClick: () => {
    authLogin(p.id)
  }
})))

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

function onSubmit(payload: FormSubmitEvent<Schema>) {
  console.log('Submitted', payload)
}
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    :providers="providers"
    :title="signupConfig.title"
    :submit="{ label: signupConfig.submitLabel ?? 'Create account' }"
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
