export interface SidebarMenuItem {
  label: string
  routeName: string
  path: string
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  {
    label: '首頁',
    routeName: 'home',
    path: '/',
  },
  {
    label: '實價登錄',
    routeName: 'real-price-registration',
    path: '/real-price-registration',
  },
]
