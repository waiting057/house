import type { RouterModel } from './router.models'

/** Placeholder until real-price-registration page skill is implemented in full. */
export const realPriceRegistrationRoutes: RouterModel[] = [
  {
    path: '/real-price-registration',
    name: 'real-price-registration',
    component: () => import('@/views/real-price-registration/realPriceRegistration.vue'),
    meta: {
      title: '實價登錄',
      hasHeader: false,
      hasSidebar: true,
    },
  },
]
