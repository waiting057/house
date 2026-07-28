import type { Component } from 'vue'

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
