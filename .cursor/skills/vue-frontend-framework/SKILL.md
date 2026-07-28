---
name: vue-frontend-framework
description: >-
  Scaffolds and maintains the Vue 3 + TypeScript + Vite frontend for the house
  hobby project on GitHub Pages (Pinia, Vue Router, layout, static data loading).
  Use when creating or extending the frontend skeleton, shared structure, or
  wiring page skills. Page details live under vue-frontend-framework/home and
  vue-frontend-framework/real-price-registration.
---

# Vue Frontend Framework

自足規格：依本 skill 產生可建置並部署到 **GitHub Pages** 的前端框架。環境只維護 `.env.local`。資料來自靜態檔（見 `real-price-registration-data`），不依賴常駐後端 API envelope。

## When to use

- 從零建立前端骨架，或擴充目錄／慣例
- 新增 store／router／view／靜態資料讀取時對齊本框架
- 頁面實作以子 skill 為準，並遵守本結構

## Scaffold checklist

1. 根目錄：`package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、ESLint／Prettier（可選）
2. `environments/.env.local`（及 `.env.local.example`）
3. `src/main.ts`、`src/app.vue`（含左側選單 layout）
4. `public/data/` 佔位（實際資料由資料管線 skill 產出）
5. `src/apis/` 或 `src/data/`：讀取靜態 JSON 的 thin service（見下方 Data loading）
6. `src/routers/`：`router.models.ts`、`index.ts`、home／各功能路由
7. `src/stores/`：至少 `useAppStore`（loading 等）
8. `src/components/layout/`：固定左側選單；`common/` 可極簡
9. `src/views/home/` 等頁面（細節見各 page skill）
10. `npm install` 後 `npm run dev` 可啟動；`npm run build` 可給 Pages

## Tech stack

| 類別 | 技術 |
|------|------|
| 框架 | Vue 3、TypeScript |
| 建置 | Vite 5 |
| 狀態 | Pinia |
| 路由 | Vue Router 4 |
| HTTP | `fetch` 或 Axios（僅用來載入靜態 JSON／同站資源） |
| 部署 | GitHub Pages（靜態） |
| 套件管理 | npm |
| Node | `20.x` |

```json
{
  "type": "module",
  "engines": { "node": "20.x" },
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,vue,js}\"",
    "type-check": "vue-tsc --noEmit"
  }
}
```

依賴（骨架）：`vue`、`vue-router`、`pinia`；可選 `axios`。dev：`vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`@types/node`。圖表等業務套件有需求再加。

## Environment

- Vite `envDir`：`environments/`
- 只維護 **`environments/.env.local`**

| 變數 | 說明 |
|------|------|
| `VITE_APP_NAME` | 應用名稱 |
| `VITE_APP_VERSION` | 版號 |
| `VITE_BASE_PATH` | GitHub Pages 專案站子路徑（例：`/house/`）；本機可 `/` |

路徑別名：`@/` → `src/`。

### `vite.config.ts` 範本

```ts
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const envDir = 'environments'
  const env = loadEnv(mode, envDir, '')

  return {
    base: env.VITE_BASE_PATH || '/',
    envDir,
    server: { host: true, port: 5173 },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      APP_VERSION: JSON.stringify(env.VITE_APP_VERSION),
      APP_NAME: JSON.stringify(env.VITE_APP_NAME),
    },
  }
})
```

## Folder structure

```
├── environments/
├── public/
│   └── data/                  # 靜態資料（由資料管線寫入）
├── src/
│   ├── apis/                  # 或 data/：讀取 public/data 的 service
│   │   └── <domain>/
│   ├── assets/
│   │   ├── imgs/
│   │   └── styles/
│   ├── components/
│   │   ├── layout/            # 含固定左側選單
│   │   └── common/
│   ├── routers/
│   ├── stores/
│   ├── utilities/
│   ├── views/
│   │   ├── home/
│   │   └── real-price-registration/
│   ├── app.vue
│   ├── main.ts
│   └── vite-env.d.ts
├── index.html
├── vite.config.ts
└── package.json
```

### 資料夾取名

- **`apis/`／`data/`**：依資料領域分子資料夾（例：`real-price-registration/`），負責載入對應靜態 JSON。
- **`routers/`、`stores/`、`views/`**：依功能模組劃分，與左側選單入口對齊。

### 檔名慣例

| 模式 | 用途 |
|------|------|
| `xxx.models.ts` | 前端型別、篩選條件、圖表用 DTO |
| `xxx.service.ts` | 載入／轉換資料邏輯（**service 單數**） |
| `xxx.constant.ts` | 常數 |
| `*.vue` | 頁面或元件 |

## Bootstrap

### `src/main.ts`

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './app.vue'
import router from './routers'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

### `src/app.vue`

- 固定**左側選單**（各功能入口）+ 右側 `<router-view>`
- 可用 `route.meta.hasSidebar` 控制是否顯示選單（預設首頁與分析頁皆顯示）

## Data loading（取代後端 API envelope）

本專案部署於 GitHub Pages，**不使用** `{ metadata, body }` 後端信封格式，也無需 `api.models.ts` 那套 request metadata。

### 約定

1. 靜態檔放在 `public/data/...`（建置後以 `import.meta.env.BASE_URL` 組路徑）
2. 領域 service 負責 `fetch`／Axios GET JSON、基本錯誤處理、回傳 typed 資料
3. 資料 schema 以各資料管線 skill 為準（實價登錄見 `real-price-registration-data`）

### 範例

```ts
// apis/real-price-registration/realPriceRegistration.service.ts
export class RealPriceRegistrationDataService {
  static async loadMonthlySummary(): Promise<MonthlySummary[]> {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}data/real-price-registration/monthly-summary.json`)
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
    return res.json()
  }
}
```

型別放同領域 `*.models.ts`，依實際 JSON 欄位定義即可。

## Router

### `routers/router.models.ts`

```ts
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
```

### `routers/index.ts`

- 合併各模組 `RouterModel[]`
- `createWebHistory(import.meta.env.BASE_URL)`（Pages 子路徑必填 `VITE_BASE_PATH`）
- 興趣專案預設不需登入守衛

## Pinia

- `useXxxStore` + `defineStore`
- `useAppStore`：全域 `loading` 等
- 複雜領域可拆 `state`／`getters`／`actions`

## Views & components

- `<script setup lang="ts">`
- 樣式可放 `assets/styles/`
- `components/layout/`：左側選單＋主內容區
- 頁面細節：
  - 首頁 → `vue-frontend-framework/home`
  - 實價登錄分析 → `vue-frontend-framework/real-price-registration`

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run type-check
```

## Relation to other skills

| Skill | 用途 |
|-------|------|
| `real-price-registration-data` | 政府實價登錄資料管線 → 寫入 `public/data/...` |
| `vue-frontend-framework/home` | 首頁 |
| `vue-frontend-framework/real-price-registration` | 實價登錄分析頁 |
| `spring-boot-skeleton` | 可選；**GitHub Pages 主路徑不需要** |
