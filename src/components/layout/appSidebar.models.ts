/**
 * @description 左側選單單一項目
 * @property {string} label 選單顯示文字
 * @property {string} routeName 對應 vue-router 的 name
 * @property {string} path 對應路徑（供 <router-link> 或比對用）
 */
export interface SidebarMenuItem {
  label: string
  routeName: string
  path: string
}

/**
 * @description 全站左側選單項目清單（順序即顯示順序）
 */
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
