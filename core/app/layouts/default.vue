<script setup lang="ts">
// Default layout component
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <nav>
        <NuxtLink to="/">Home</NuxtLink>
      </nav>
    </header>

    <main class="app-main">
      <slot />
    </main>

    <footer class="app-footer">
      <p>&copy; {{ new Date().getFullYear() }} App Agent</p>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.app-header nav {
  display: flex;
  gap: 1rem;
}

.app-main {
  flex: 1;
  padding: 2rem;
}

.app-footer {
  padding: 1rem;
  border-top: 1px solid #eee;
  text-align: center;
}
</style>
