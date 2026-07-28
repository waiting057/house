---
name: real-price-registration-page
description: >-
  Implements the real price registration (實價登錄) analysis page for the house
  Vue app. Use when building or changing views/real-price-registration, its
  routes, filters, or charts. Detailed product requirements will be filled in
  later; until then scaffold only the page shell wired to static data paths.
---

# Real Price Registration Page

英文模組名：**`real-price-registration`**（實價登錄分析頁）。

> **內容待補**：篩選條件、圖表指標、互動細節由使用者之後另行詳細補充。本 skill 先固定模組位置、路由與資料接線約定。

## When to use

- 建立或修改實價登錄分析頁骨架
- 接上 `public/data/real-price-registration/` 靜態資料
- 使用者補充完整需求後，在本 skill 擴充規格再實作

## Place in app

- 路徑建議：`/real-price-registration`
- 左側選單需有對應入口（見 `vue-frontend-framework/home`）
- `meta.hasSidebar: true`

## Files（建議）

```
src/
├── views/real-price-registration/
│   ├── realPriceRegistration.vue      # 頁面殼（之後補 UI）
│   ├── realPriceRegistration.models.ts
│   └── realPriceRegistration.service.ts  # 可轉呼叫 apis/ 層
├── apis/real-price-registration/
│   └── realPriceRegistration.service.ts  # 載入 static JSON
└── routers/
    └── realPriceRegistration.ts
```

## Data dependency

- 資料由 **`real-price-registration-data`** 管線寫入：
  - `public/data/real-price-registration/manifest.json`
  - `public/data/real-price-registration/monthly-summary.json`
- 頁面透過前端 data service 載入；勿在瀏覽器直接抓政府網站當主流程

## Scaffold behavior（需求補齊前）

實作骨架時僅需：

1. 路由 + 側欄可進入本頁
2. 標題／簡短說明佔位（例：實價登錄分析；詳細功能開發中）
3. 可選：嘗試載入 `manifest.json` 並顯示 `generatedAt`（證明資料管線接得上）
4. **不要**臆造完整篩選與圖表，等本 skill 補充需求後再做

## TODO（之後補充到本 skill）

- [ ] 篩選維度（縣市、行政區、時間區間、類型…）
- [ ] 指標定義（單價均價／中位數、買賣筆數等）
- [ ] 圖表類型與互動
- [ ] 空資料／載入失敗 UX
- [ ] 與 `monthly-summary.json` 最終 schema 對齊

## Relation

- 父框架：`vue-frontend-framework`
- 首頁／側欄：`vue-frontend-framework/home`
- 資料管線：`real-price-registration-data`
