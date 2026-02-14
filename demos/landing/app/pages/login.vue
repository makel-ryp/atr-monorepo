<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

const { auth } = useAppConfig()
const { login: authLogin } = useAuth()

const loginConfig = computed(() => auth?.login ?? {
  title: 'Welcome back',
  icon: 'i-lucide-lock',
  description: "Don't have an account?",
  descriptionLink: { label: 'Sign up', to: '/signup' },
  forgotPasswordLink: { label: 'Forgot password?', to: '/' },
  termsText: 'By signing in, you agree to our',
  termsLink: { label: 'Terms of Service', to: '/' },
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
  }, {
    name: 'remember',
    label: 'Remember me',
    type: 'checkbox'
  }],
  seo: {
    title: 'Login',
    description: 'Login to your account to continue'
  }
})

const seoConfig = computed(() => loginConfig.value.seo ?? { title: 'Login', description: 'Login to your account to continue' })

useSeoMeta({
  title: seoConfig.value.title,
  description: seoConfig.value.description
})

const fields = computed(() => loginConfig.value.fields ?? [{
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password' as const,
  placeholder: 'Enter your password'
}, {
  name: 'remember',
  label: 'Remember me',
  type: 'checkbox' as const
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
    :title="loginConfig.title"
    :icon="loginConfig.icon"
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
        :to="loginConfig.forgotPasswordLink?.to ?? '/'"
        class="text-primary font-medium"
        tabindex="-1"
      >{{ loginConfig.forgotPasswordLink?.label ?? 'Forgot password?' }}</ULink>
    </template>

    <template #footer>
      {{ loginConfig.termsText }} <ULink
        :to="loginConfig.termsLink?.to ?? '/'"
        class="text-primary font-medium"
      >{{ loginConfig.termsLink?.label ?? 'Terms of Service' }}</ULink>.
    </template>
  </UAuthForm>
</template>
