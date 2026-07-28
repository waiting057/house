import { createRouter, createWebHistory } from 'vue-router'
import { homeRoutes } from './home'
import { realPriceRegistrationRoutes } from './realPriceRegistration'
import type { RouterModel } from './router.models'

const routes: RouterModel[] = [...homeRoutes, ...realPriceRegistrationRoutes]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  const appName = import.meta.env.VITE_APP_NAME || 'House'
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} · ${appName}` : appName
})

export default router
