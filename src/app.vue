<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/appSidebar.vue'
import { useAppStore } from '@/stores'

const route = useRoute()
const appStore = useAppStore()

const showSidebar = computed(() => route.meta.hasSidebar !== false)
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell--with-sidebar': showSidebar }"
  >
    <AppSidebar v-if="showSidebar" />
    <main class="app-shell__main">
      <div
        v-if="appStore.loading"
        class="app-shell__loading"
        aria-live="polite"
      >
        載入中…
      </div>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
}

.app-shell--with-sidebar {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.app-shell__main {
  position: relative;
  min-width: 0;
  min-height: 100vh;
}

.app-shell__loading {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: rgba(28, 25, 23, 0.85);
  color: #fafaf9;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .app-shell--with-sidebar {
    grid-template-columns: 1fr;
  }

  .app-shell--with-sidebar :deep(.sidebar) {
    position: relative;
    width: 100%;
    min-height: auto;
  }
}
</style>
