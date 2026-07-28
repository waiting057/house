---
name: real-price-registration-page
description: >-
  Implements the real price registration (實價登錄) analysis page for the house
  Vue app. Use when building or changing views/real-price-registration, its
  routes, filters, charts, summary blocks, or transaction list backed by static
  JSON data.
---

# Real Price Registration Page

英文模組名：**`real-price-registration`**（實價登錄分析頁）。

第一版以 **台北市、近幾年、買賣案件** 為範圍，部署於 GitHub Pages，資料由 `real-price-registration-data` 產出的靜態 JSON 提供。目標是只依本 skill 即可從 0 實作出目前分析頁的互動、版面與圖表結果。

## When to use

- 建立或修改實價登錄分析頁
- 接上 `public/data/real-price-registration/` 靜態資料
- 調整篩選條件、圖表、清單排序與說明文案

## Place in app

- 路徑建議：`/real-price-registration`
- 左側選單需有對應入口（見 `vue-frontend-framework/home`）
- `meta.hasSidebar: true`

## Files（建議）

```
src/
├── views/real-price-registration/
│   ├── realPriceRegistration.vue
│   ├── realPriceRegistration.models.ts
│   └── realPriceRegistration.service.ts
├── apis/real-price-registration/
│   └── realPriceRegistration.service.ts
├── components/common/charts/
│   ├── lineChart.vue
│   └── scatterPlot.vue
└── routers/
    └── realPriceRegistration.ts
```

## Data dependency

- 資料由 **`real-price-registration-data`** 管線寫入：
  - `public/data/real-price-registration/manifest.json`
  - `public/data/real-price-registration/transactions.json`
  - `public/data/real-price-registration/monthly-summary.json`
- `public/data/real-price-registration/filter-options.json`
- 頁面只讀取同站靜態檔；勿在瀏覽器直接抓政府網站當主流程

### 資料欄位（第一版）

- `district`：行政區
- `roadName`：標準化路名
- `fullAddress`：完整地址
- `buildingType`：建物型態
- `tradeDate` / `tradeYearMonth`
- `buildingAreaPing`
- `totalPriceWan`
- `unitPriceWanPerPing`
- `buildingAgeYears`
- `hasParking`
- `remark`
- `parkingType`

### 第一版資料範圍

- 城市：台北市
- 交易類型：買賣
- 時間：近幾年（由管線輸出資料實際涵蓋年度為準）

## Filters

第一版需支援：

1. **行政區**：單選下拉
2. **路名**：關鍵字搜尋候選值，可多次加入已選路名集合
3. **建物型態**：多選
4. **屋齡區間**
5. **總面積（坪）區間**
6. **總價（萬元）區間**
7. **單價（萬元/坪）區間**
8. **是否有車位**：不限／有／無
9. **備註排除**：關鍵字搜尋候選值，可多次加入排除集合
10. **交易時間區間**：起訖月份（`YYYY-MM`）

### 路名與備註互動

- 使用者輸入關鍵字後，顯示候選值
- 可勾選部分項目或全選
- 按下加入後，候選值進入已選集合
- 可再次輸入新的關鍵字並繼續加入
- 路名集合是「保留符合」；備註集合是「排除符合」

## Layout

頁面採 **上圖下表**，且目前所有主要區塊都必須支援收合：

1. 篩選區
2. 統計摘要區
   - 成交筆數
   - 單價：平均 / 中位數 / 最高 / 最低
   - 總價：平均 / 中位數 / 最高 / 最低
3. 圖表區
   - 單價走勢
   - 總價走勢
   - 成交量
   - 成交點分布圖（單價 / 總價切換）
4. 說明區
   - 中位數較有參考價值的原因
5. 清單區
   - 預設按成交日期新到舊排序

### 收合互動

- 篩選區、統計摘要、每一張圖、成交點分布圖、說明區、清單區都可各自收合
- 收合按鈕用 **icon** 呈現，不顯示純文字「收合 / 展開」
- 預設進頁時全部展開

## Charts

### 單價走勢

- 主線：每月單價 **中位數**
- 輔線：每月單價 **平均數**（虛線）
- 每個折點需顯示對應數值
- X 軸刻度與 X 軸名稱都使用完整 `YYYY-MM` / `成交年月`
- Y 軸單位顯示在圖卡右上角

### 總價走勢

- 主線：每月總價 **中位數**
- 輔線：每月總價 **平均數**（虛線）
- 每個折點需顯示對應數值
- X 軸刻度與 X 軸名稱都使用完整 `YYYY-MM` / `成交年月`
- Y 軸單位顯示在圖卡右上角

### 成交量

- 每月成交筆數
- X 軸刻度與 X 軸名稱都使用完整 `YYYY-MM` / `成交年月`
- Y 軸單位顯示在圖卡右上角

### 成交點分布圖

- X 軸：成交日期
- 每筆成交一個點
- 需提供切換控制：
  - `單價分布`
  - `總價分布`
- 顯示目前篩選後的**全部資料**，不另外縮成近 12 或 24 個月
- 目的不是取代趨勢圖，而是補足單筆樣本分布與離群值觀察
- X 軸名稱需明確標示（建議：`成交年月`）
- Y 軸單位顯示在圖卡右上角

### 圖表說明文案

需在圖表下方明確說明：

- 中位數較不容易受極端值影響
- 在實價登錄資料中，特殊高價案、親屬交易、僅車位交易等都可能拉高或拉低平均數
- 因此中位數較適合作為區域行情參考，平均數則作為輔助觀察

## Chart rendering constraints

- 每張圖都要有自己的獨立卡片與標題，不要把三張折線圖塞在同一個共用面板內
- **只有圖表的繪圖區域可以左右滑動**
  - 外層頁面、整張卡片、整個主內容區都不應因圖表而產生整頁橫向捲動
  - 正確做法是：圖卡標題與說明固定，內層繪圖 viewport `overflow-x: auto`
- 當資料點很多時，圖表本體寬度可大於可視區；以內層滾動容器承接，不可撐開整頁
- 需考慮左側 sidebar 存在時的可用寬度，區塊排版與斷點要偏保守

## Result list

清單欄位至少包含：

- 成交日期
- 行政區
- 地址
- 建物型態
- 屋齡
- 總面積（坪）
- 總價（萬元）
- 單價（萬元/坪）
- 車位
- 備註

預設排序：**成交日期新到舊**

## UX constraints

- 首次進頁可直接載入資料並顯示預設圖表
- 若無符合條件資料，需明確顯示空狀態
- 若資料載入失敗，需顯示錯誤訊息與可重試操作
- 路名與備註候選值不應一次全部展開，需靠搜尋縮小範圍
- 篩選欄位不應全部擠成單一長排；桌面版以 **1 到 2 欄** 為主，重點是易讀、不重疊
- Hero、搜尋區塊、篩選區塊都要允許在較窄寬度下換行或降欄，避免被 sidebar 擠爆

## Implementation hints

- `realPriceRegistration.vue`
  - 管理篩選條件、收合狀態、資料載入、摘要統計與圖表資料來源
- `realPriceRegistration.models.ts`
  - 定義 `RealPriceTransaction`、`RealPriceManifest`、`RealPriceFilters`、圖表資料型別
- `realPriceRegistration.service.ts`
  - 放篩選、聚合、格式化、候選值搜尋邏輯
- `apis/real-price-registration/realPriceRegistration.service.ts`
  - 專心處理靜態 JSON 載入
- `lineChart.vue`
  - 自製 SVG 折線圖，支援主線/輔線、數值標籤、右上 Y 軸單位、底部 X 軸名稱、內層橫向捲動 viewport
- `scatterPlot.vue`
  - 自製 SVG 散點圖，支援完整年月刻度、右上 Y 軸單位、底部 X 軸名稱、內層橫向捲動 viewport

## Relation

- 父框架：`vue-frontend-framework`
- 首頁／側欄：`vue-frontend-framework/home`
- 資料管線：`real-price-registration-data`
