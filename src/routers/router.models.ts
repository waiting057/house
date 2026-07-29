import type { Component } from 'vue'

/**
 * @description 單一路由定義（各模組 routers/*.ts 匯出後由 index 合併）
 * @property {string} path URL 路徑
 * @property {string} name 路由名稱（程式導頁／側欄對應用）
 * @property {Component} component 頁面元件
 * @property {{ title: string, hasHeader: boolean, hasSidebar: boolean }} meta 版面與文件標題設定
 * @property {string} meta.title 瀏覽器／頁面標題
 * @property {boolean} meta.hasHeader 是否顯示頂欄
 * @property {boolean} meta.hasSidebar 是否顯示左側選單
 */
export interface RouterModel {
  path: string
  name: string
  component: Component
  meta: {
    title: string
    hasHeader: boolean
    hasSidebar: boolean
  }
}
