<script setup lang="ts">
const { footer } = useAppConfig()

const columns = computed(() => footer?.columns ?? [{
  label: 'Resources',
  children: [{ label: 'Help center' }, { label: 'Docs' }, { label: 'Roadmap' }, { label: 'Changelog' }]
}, {
  label: 'Features',
  children: [{ label: 'Affiliates' }, { label: 'Portal' }, { label: 'Jobs' }, { label: 'Sponsors' }]
}, {
  label: 'Company',
  children: [{ label: 'About' }, { label: 'Pricing' }, { label: 'Careers' }, { label: 'Blog' }]
}])

const newsletter = computed(() => footer?.newsletter ?? {
  label: 'Subscribe to our newsletter',
  placeholder: 'Enter your email',
  buttonText: 'Subscribe',
  successTitle: 'Subscribed!',
  successMessage: "You've been subscribed to our newsletter."
})

const toast = useToast()

const email = ref('')
const loading = ref(false)

function onSubmit() {
  loading.value = true

  toast.add({
    title: newsletter.value.successTitle,
    description: newsletter.value.successMessage
  })
}
</script>

<template>
  <USeparator class="h-px" />

  <UFooter :ui="{ top: 'border-b border-default' }">
    <template #top>
      <UContainer>
        <UFooterColumns :columns="columns">
          <template #right>
            <form @submit.prevent="onSubmit">
              <UFormField
                name="email"
                :label="newsletter.label"
                size="lg"
              >
                <UInput
                  v-model="email"
                  type="email"
                  class="w-full"
                  :placeholder="newsletter.placeholder"
                >
                  <template #trailing>
                    <UButton
                      type="submit"
                      size="xs"
                      :label="newsletter.buttonText"
                    />
                  </template>
                </UInput>
              </UFormField>
            </form>
          </template>
        </UFooterColumns>
      </UContainer>
    </template>

    <template #left>
      <p class="text-sm text-muted">
        {{ footer?.credits || `© ${new Date().getFullYear()}` }}
      </p>
    </template>

    <template #right>
      <UButton
        v-for="(link, index) in footer?.links"
        :key="index"
        v-bind="link"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UFooter>
</template>
