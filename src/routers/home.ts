import type { RouterModel } from './router.models'

export const homeRoutes: RouterModel[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/home/home.vue'),
    meta: {
      title: '首頁',
      hasHeader: false,
      hasSidebar: true,
    },
  },
]
