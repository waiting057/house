import { defineStore } from 'pinia'

/**
 * @description 全站共用狀態（例如載入遮罩），供各頁在非同步作業時顯示 loading
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    /** 是否顯示全域載入中 */
    loading: false,
  }),
  actions: {
    /**
     * @description 開關全域 loading
     * @param value true 顯示載入；false 關閉
     */
    setLoading(value: boolean) {
      this.loading = value
    },
  },
})
