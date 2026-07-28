---
name: home-page
description: >-
  Implements the house app home page: simple welcome/entry copy with a fixed
  left sidebar of feature links. Use when building or changing the home view,
  app shell sidebar entries, or the default route under vue-frontend-framework.
---

# Home Page

首頁：單純入口文案；**左側固定選單**提供各功能入口。實作時遵守父 skill `vue-frontend-framework`。

## When to use

- 建立或修改 `views/home/`
- 調整全站左側選單的項目與路由對應
- 設定預設路由為首頁

## Layout

```
┌──────────┬─────────────────────────────┐
│ Sidebar  │  Home content               │
│ (fixed)  │  - 標題／簡短說明文字         │
│          │  - 不放複雜圖表或篩選         │
│ 選單項目  │                             │
│ · 首頁    │                             │
│ · 實價登錄 │                             │
│ · …      │                             │
└──────────┴─────────────────────────────┘
```

- 左側選單屬 **layout**（`components/layout/`），全站共用，不是只寫在 home 頁裡
- Home 主區：品牌／專案名稱、一兩段說明「可做什麼」、可選的功能導引連結（與側欄同一批入口即可）
- **不要**在首頁塞分析圖表、實價登錄篩選器（那些在分析頁）

## Files（建議）

```
src/
├── components/layout/
│   ├── appSidebar.vue          # 固定左側選單
│   └── appSidebar.models.ts    # 選單項目：label、route name/path
├── views/home/
│   └── home.vue
└── routers/
    └── home.ts                 # path: '/' 或 '/home'
```

## Sidebar menu

選單至少包含：

| 顯示名稱 | route（建議） | 說明 |
|----------|---------------|------|
| 首頁 | `home` → `/` | 本頁 |
| 實價登錄 | `real-price-registration` → `/real-price-registration` | 分析頁（見對應 page skill） |

之後新功能：先加路由與 page skill，再在 `appSidebar` 的選單常數加一筆。

## Router meta

```ts
{
  path: '/',
  name: 'home',
  component: () => import('@/views/home/home.vue'),
  meta: {
    title: '首頁',
    hasHeader: false,   // 或 true，依全站是否要頂欄；側欄為主
    hasSidebar: true,
  },
}
```

## UI content（骨架文案方向）

- 標題：專案名稱（來自 `VITE_APP_NAME` 或固定文案）
- 說明：興趣專案；可瀏覽實價登錄相關分析（資料非即時，由 Open Data 管線更新）
- 語氣簡潔，首屏不要堆統計數字或卡片牆

## Relation

- 父框架：`vue-frontend-framework`
- 分析頁：`vue-frontend-framework/real-price-registration`
- 資料：首頁不直接依賴資料管線；側欄只做導航
