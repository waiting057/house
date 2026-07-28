<script setup lang="ts">
import { RouterLink } from 'vue-router'

const appName = import.meta.env.VITE_APP_NAME || 'House'
</script>

<template>
  <section class="home">
    <p class="home__kicker">
      興趣專案
    </p>
    <h1 class="home__title">
      {{ appName }}
    </h1>
    <p class="home__lead">
      用開放資料看房市。目前可從左側進入實價登錄相關分析；資料非即時，由 Open Data
      管線定期更新後部署至 GitHub Pages。
    </p>
    <p class="home__hint">
      想先看趨勢，請前往
      <RouterLink
        class="home__link"
        :to="{ name: 'real-price-registration' }"
      >
        實價登錄
      </RouterLink>。
    </p>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  max-width: 40rem;
  padding: clamp(2rem, 6vw, 4.5rem);
  animation: home-in 520ms ease-out both;
}

.home__kicker {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.home__title {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 7vw, 4.25rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.home__lead,
.home__hint {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.65;
  color: var(--color-ink-muted);
}

.home__lead {
  margin-bottom: 1.25rem;
}

.home__link {
  color: var(--color-accent);
  font-weight: 600;
  border-bottom: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
  transition: border-color 160ms ease;
}

.home__link:hover {
  border-bottom-color: var(--color-accent);
}

@keyframes home-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
