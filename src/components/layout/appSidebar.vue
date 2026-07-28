<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { sidebarMenuItems } from './appSidebar.models'

const appName = import.meta.env.VITE_APP_NAME || 'House'
</script>

<template>
  <aside
    class="sidebar"
    aria-label="主選單"
  >
    <div class="sidebar__brand">
      <p class="sidebar__name">
        {{ appName }}
      </p>
    </div>
    <nav class="sidebar__nav">
      <RouterLink
        v-for="item in sidebarMenuItems"
        :key="item.routeName"
        :to="{ name: item.routeName }"
        class="sidebar__link"
        active-class=""
        exact-active-class="sidebar__link--active"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: var(--sidebar-width);
  min-height: 100vh;
  padding: 1.75rem 1.25rem;
  background: linear-gradient(180deg, #1f2a28 0%, #243530 48%, #1a2422 100%);
  color: #f5f5f4;
}

.sidebar__brand {
  padding: 0 0.35rem;
}

.sidebar__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #99a8a4;
}

.sidebar__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1.15;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar__link {
  display: block;
  padding: 0.7rem 0.85rem;
  border-radius: 0.4rem;
  color: #d6ddd9;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.sidebar__link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(2px);
}

.sidebar__link--active {
  color: #ecfdf5;
  background: rgba(15, 118, 110, 0.45);
}
</style>
