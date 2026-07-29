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

自足規格：依本 skill 產生可建置並部署到 **GitHub Pages** 的前端框架。資料來自靜態檔（見 `real-price-registration-data`），不依賴常駐後端 API envelope。目標是未來只讀本 skill 與子 skill，就能從 0 產出目前專案的前端結果。

## When to use

- 從零建立前端骨架，或擴充目錄／慣例
- 新增 store／router／view／靜態資料讀取時對齊本框架
- 頁面實作以子 skill 為準，並遵守本結構

## Scaffold checklist

1. 根目錄：`package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、ESLint
2. `environments/.env.local`、`.env.local.example`、`.env.production`
3. `src/main.ts`、`src/app.vue`（含左側選單 layout）
4. `public/data/` 佔位（實價登錄等靜態檔見對應 data skill；無 Open Data 自動化）
5. `src/apis/` 或 `src/data/`：讀取靜態 JSON／處理上傳的 thin service（見下方 Data loading）
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

依賴（骨架）：`vue`、`vue-router`、`pinia`；可選 `axios`。dev：`vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`@types/node`、`eslint`、`@typescript-eslint/*`、`eslint-plugin-vue`、`vue-eslint-parser`。圖表以自製 SVG 元件優先，不預設引入第三方圖表套件。

## Environment

- Vite `envDir`：`environments/`
- 本機與正式建置分開：
  - `environments/.env.local`
  - `environments/.env.local.example`
  - `environments/.env.production`

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
│   └── data/                  # 靜態資料（本地檔／手動更新，無自動管線）
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
3. 資料 schema 以各資料 skill 為準（實價登錄見 `real-price-registration-data`：本地 CSV／JSON + 使用者上傳，來源為 [lvr.land.moi.gov.tw](https://lvr.land.moi.gov.tw/)，無 Open Data 自動化）

### 範例

```ts
// apis/real-price-registration/realPriceRegistration.service.ts
export class RealPriceRegistrationDataService {
  static async loadLocalTransactions(): Promise<RealPriceTransaction[]> {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}data/real-price-registration/transactions.json`)
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
    return res.json()
  }
}
```

型別放同領域 `*.models.ts`，依實際 JSON 欄位定義即可。

## Comment style（程式碼規範）

程式註解必須是**完整、清楚、好理解**的維護型註解，目的是讓人可以快速閱讀並理解程式邏輯。不可只寫重述程式表面的廢話。

### 原則

1. **先說目的，再說規則／原因**
   - 優先解釋這段程式「為什麼存在」、「想保證什麼」。
2. **描述資料流與判斷意圖**
   - 對篩選、聚合、圖表座標、路徑組合、環境切換等邏輯，要讓下一位維護者能快速理解輸入、輸出、限制。
3. **避免無效註解**
   - 不要寫像「設定變數值」、「呼叫 API」這種從程式本身就看得懂的句子。
4. **公開型別與函式用 JSDoc**
   - `interface`／`type`、匯出函式、含分支規則的內部函式，都要用完整 JSDoc（見下方範例）。
5. **複雜邏輯可再加行內／區塊註解**
   - 複雜計算、資料正規化、圖表寬度策略、UI 響應式條件等，在關鍵步驟旁補 1 到 3 行說明。
6. **命名與註解要互相補充**
   - 變數與函式名稱先清楚；註解再補充商業規則、例外狀況、為何這樣寫。

### Interface／Type（必寫）

每個 `interface`／重要 `type` 都要有 `@description`，並用 `@property` 說明每個欄位含義。

```ts
/**
 * @description 變更密碼表單資料
 * @property {string} currentPwd 目前密碼
 * @property {string} newPwd 新密碼
 * @property {string} confirmPwd 確認新密碼
 */
export interface ChangePwdForm {
  currentPwd: string
  newPwd: string
  confirmPwd: string
}
```

### Function（必寫）

函式註解以 `@description` 說明「這支函式在做什麼」；若有非直覺規則、邊界條件或演算法，寫在 description 底下用條列交代，讓人不看實作也能理解邏輯。

```ts
/**
 * @description 產生分頁列要渲染的項目（頁碼按鈕 + 省略號）
 *
 * 規則：
 * 1. 總頁數 ≤ 7：全部頁碼都顯示（1, 2, 3, …, totalPages）
 * 2. 總頁數 > 7：只顯示「首尾頁 + 目前頁及其前後一頁」，中間缺口用 … 表示
 *    例如目前在第 5 頁、共 20 頁 → 1 … 4 5 6 … 20
 */
function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  // ...
}
```

可選補充（複雜函式建議加上）：

- `@param`：參數語意不明顯時
- `@returns`：回傳結構或特殊語意時
- `@throws`：會拋出特定錯誤（例如 CSV 格式不符）時

### 行內／區塊註解（建議寫法）

```ts
// 使用 BASE_URL 組 public/data 路徑，確保 GitHub Pages 子路徑部署時仍能正確載入靜態 JSON。
const response = await fetch(`${base}data/real-price-registration/transactions.json`)

// 當資料點很多時，圖表本體需要比可視區更寬，才能把橫向捲動限制在圖表區域內，而不是撐開整頁。
const width = computed(() => Math.max(720, props.points.length * 90))
```

### 不可接受的寫法

```ts
// 取得資料
const response = await fetch(url)

// 設定寬度
const width = 720

/** 變更密碼表單 */
export interface ChangePwdForm {
  currentPwd: string
  newPwd: string
  confirmPwd: string
}

/** 建立分頁 */
function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {}
```

（上列不可接受處：只寫空泛標題、未說明欄位、未交代分支規則。）

### Implementation rules

- Vue 頁面、models、service、圖表元件、資料正規化／CSV 解析程式都要遵守本節規範
- 新增或修改的 `interface`／匯出函式時，同步補齊或更新 JSDoc
- 只要邏輯不是一眼就懂，就應補上讓維護者能直接接手的註解
- 註解語氣以陳述句為主，避免口語化或只寫片段關鍵字
- 實價登錄分析頁／資料 skill 實作時，同樣套用本節，不另訂衝突規則

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

## GitHub Pages

目標網址（repo `waiting057/house`）：`https://waiting057.github.io/house/`

### Repo 設定

1. **Settings → Pages → Build and deployment → Source**：選 **GitHub Actions**（不要用 Deploy from a branch + root）
2. 將含 workflow 的變更 push 到 `main`，或於 Actions 手動跑 **Deploy GitHub Pages**

### Workflow

- 檔案：`.github/workflows/deploy-pages.yml`
- 觸發：`push` 到 `main`、`workflow_dispatch`
- 建置前寫入／使用 `environments/.env.production`（`VITE_BASE_PATH=/house/`）
- `npm ci` → `npm run build` → 複製 `dist/index.html` 為 `dist/404.html`（history mode SPA 後備）→ 部署 `dist`

### 環境變數

| 檔案 | 用途 |
|------|------|
| `environments/.env.local` | 本機（`VITE_BASE_PATH=/`，勿提交） |
| `environments/.env.production` | Pages／正式建置（`VITE_BASE_PATH=/house/`） |

若 GitHub 帳號或 repo 名稱變更，同步改 `VITE_BASE_PATH`（`/<repo>/`）與 workflow／本節網址說明。

## Relation to other skills

| Skill | 用途 |
|-------|------|
| `real-price-registration-data` | 實價登錄本地 CSV／JSON 約定（手動更新，無自動化） |
| `vue-frontend-framework/home` | 首頁 |
| `vue-frontend-framework/real-price-registration` | 實價登錄分析頁 |
| `spring-boot-skeleton` | 可選；**GitHub Pages 主路徑不需要** |
