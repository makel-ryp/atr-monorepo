<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0' }">
    <template #body>
      <div class="flex flex-col h-full min-h-0">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-white/10 md:hidden">
          <UDashboardSidebarToggle />
          <Logo class="h-5 w-5 shrink-0" />
          <span class="text-lg font-bold text-white">Characters</span>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          <HomeHeroCarousel />
          <HomeAvatarStrip />
          <HomeLiveAction />
          <HomeCharacterGrid />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
