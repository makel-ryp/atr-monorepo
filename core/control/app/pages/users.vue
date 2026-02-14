<script setup lang="ts">
const { loggedIn, user } = useAuth()
</script>

<template>
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="Users" />
    </template>

    <template #body>
      <div class="flex flex-col gap-6 p-6">
        <!-- Current user -->
        <UCard v-if="loggedIn && user">
          <template #header>
            <span class="font-semibold">Current User</span>
          </template>

          <div class="flex items-center gap-4">
            <UAvatar v-if="user.avatar" :src="user.avatar" size="lg" />
            <div>
              <p class="font-medium">{{ user.name || user.username }}</p>
              <p v-if="user.email" class="text-sm text-muted">{{ user.email }}</p>
              <p v-if="user.role" class="text-sm text-muted">Role: {{ user.role }}</p>
            </div>
          </div>
        </UCard>

        <UCard v-else>
          <div class="text-center py-8 text-muted">
            <UIcon name="i-lucide-user-x" class="size-12 mb-2 mx-auto opacity-30" />
            <p>Not logged in</p>
          </div>
        </UCard>

        <!-- Placeholder -->
        <div class="text-center py-12 text-muted">
          <UIcon name="i-lucide-users" class="size-16 mb-4 mx-auto opacity-20" />
          <p class="text-lg font-medium">User Management</p>
          <p class="text-sm mt-2">Coming in a future release.</p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
