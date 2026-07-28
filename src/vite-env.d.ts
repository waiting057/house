/// <reference types="vite/client" />

declare const APP_NAME: string
declare const APP_VERSION: string

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_BASE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    hasHeader?: boolean
    hasSidebar?: boolean
  }
}
