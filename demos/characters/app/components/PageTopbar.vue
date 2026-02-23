<template>
  <div class="page-topbar">
    <div class="page-topbar__left">
      <slot name="left" />
    </div>
    <div class="page-topbar__right">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.page-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

@media (min-width: 768px) {
  .page-topbar {
    padding: 0.75rem 1.25rem;
  }
}

.page-topbar__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.page-topbar__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
</style>
