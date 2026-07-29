---
name: real-price-registration-page
description: >-
  Implements the real price registration (實價登錄) analysis page for the house
  Vue app. Use when building or changing views/real-price-registration, its
  routes, filters, charts, summary, CSV upload/download, or local JSON/CSV
  default data. Source files come from 內政部實價查詢服務網 via user upload or
  local static files — no Open Data automation.
---

# Real Price Registration Page

英文模組名：**`real-price-registration`**（實價登錄分析頁）。

第一版以 **台北市買賣案件** 為範圍（預設檔可為士林區），部署於 GitHub Pages。  
資料來自 [內政部不動產交易實價查詢服務網](https://lvr.land.moi.gov.tw/)：**使用者上傳 CSV**，或使用 repo 內**本地靜態檔**。沒有 Open Data 自動下載，也沒有排程更新。

目標是只依本 skill 即可從 0 實作出目前分析頁的互動、版面與圖表結果。

## When to use

- 建立或修改實價登錄分析頁
- 接上 `public/data/real-price-registration/` 本地預設資料
- 調整篩選、圖表、清單、上傳／下載與說明文案

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
│   ├── realPriceRegistration.service.ts
│   └── realPriceRegistrationCsv.service.ts
├── apis/real-price-registration/
│   └── realPriceRegistration.service.ts
├── components/common/charts/
│   ├── lineChart.vue
│   └── scatterPlot.vue
└── routers/
    └── realPriceRegistration.ts
```

## Data flow（必守）

```
1. 讀取 CSV
   - 有上傳 → 使用上傳的 CSV
   - 無上傳 → 使用本地預設資料
2. 解析成 JSON（RealPriceTransaction[]）
   - 上傳：執行期 parse CSV
   - 本地：優先直接載入事先轉好的 JSON（避免每次進頁都解析 CSV）
3. 畫面呈現（篩選／摘要／圖表／清單）
```

對應狀態建議：

- `localTransactions`：本地預設解析結果（進頁載入一次）
- `activeTransactions`：目前分析用（本地或上傳成功後）

## Data dependency

- 檔案來源說明：[lvr.land.moi.gov.tw](https://lvr.land.moi.gov.tw/)（人工匯出，非本專案自動抓取）
- **本地預設（建議）**：`public/data/real-price-registration/transactions.json`（由 CSV 事先轉好）
- **本地 CSV 樣板／下載**：`public/data/real-price-registration/士林區實價登錄.csv`
- **上傳 CSV**：標題必須與契約一致（正規化後比對）；成功才改用上傳資料
- **下載**：固定下載本地預設 CSV（不是上傳檔）
- 格式不符：彈窗「不符合格式」，分析繼續用本地資料
- **不做** Open Data／GitHub Actions 自動更新（細節見 `real-price-registration-data`）

### CSV 標題契約（正規化後必須一致）

- `地段位置或門牌`
- `社區簡稱`
- `交易日期`
- `總價(萬元)`
- `單價(萬元/坪)`
- `總面積(坪)`
- `主建物佔比`
- `型態`
- `屋齡`
- `樓別/樓高`
- `交易標的`
- `交易筆棟數`
- `建物現況格局`
- `車位總價(萬元)`
- `管理組織`
- `電梯`
- `主要用途`
- `備註`

注意：原始檔部分欄位用引號包住並含換行（如 `"單價\n(萬元/坪)"`），驗證時先去掉換行與空白再比對。

### 資料欄位（分析用衍生 + CSV 原始）

- 原始 18 欄：供清單依 CSV 標題顯示
- `district` / `roadName`：從 `地段位置或門牌` 解析
- `tradeDate` / `tradeYearMonth`：由民國 `yyy/mm/dd` 轉西元
- `buildingType` ← `型態`
- `buildingAgeYears` ← `屋齡`
- `buildingAreaPing` ← `總面積(坪)`
- `totalPriceWan` ← `總價(萬元)`
- `unitPriceWanPerPing` ← `單價(萬元/坪)`
- `hasParking`：由交易筆棟數／交易標的／車位總價判斷
- `remark` ← `備註`

## Filters

第一版需支援：

1. **行政區**：單選下拉
2. **路名**：關鍵字搜尋候選值，可多次加入已選路名集合
3. **建物型態**：多選（可再點取消）
4. **主要用途**：多選（可再點取消）
5. **屋齡區間**
6. **總面積（坪）區間**
7. **總價（萬元）區間**
8. **單價（萬元/坪）區間**
9. **有無車位**：不限／有／無
10. **有無管理組織**：不限／有／無（對應 CSV「有」「無」）
11. **備註排除**：關鍵字搜尋候選值，可多次加入排除集合；候選＋已選區需有最高高度，過多時區塊內捲動
12. **交易時間區間**：起訖月份（`YYYY-MM`）

篩選／摘要／圖表都吃 `activeTransactions`。`filterOptions` 由目前 active 資料重建。

成交點分布圖：滑鼠移到點上顯示價錢（與單位）與地址摘要；資料量大時以 hover 提示為主，不在每個點常駐標價。

### 路名與備註互動

- 使用者輸入關鍵字後，顯示候選值
- 可勾選部分項目或全選
- 按下加入後，候選值進入已選集合
- 可再次輸入新的關鍵字並繼續加入
- 路名集合是「保留符合」；備註集合是「排除符合」

## Layout

頁面採 **上圖下表**，且目前所有主要區塊都必須支援收合：

1. Hero：標題 + **上傳 CSV** / **下載**；顯示目前資料來源檔名與筆數
2. 篩選區
3. 統計摘要區
4. 圖表區（單價／總價／成交量／散點）
5. 說明區
6. 清單區：欄位與 CSV 18 欄標題一致，依西元 `tradeDate` 新到舊排序

### 收合互動

- 篩選區、統計摘要、每一張圖、成交點分布圖、說明區、清單區都可各自收合
- 收合按鈕用 **icon** 呈現，不顯示純文字「收合 / 展開」
- 預設進頁時全部展開

## Charts

### 單價走勢 / 總價走勢 / 成交量 / 散點

- 資料來源為 `activeTransactions` 衍生欄位
- X 軸：`YYYY-MM` / `成交年月`；Y 軸單位在圖卡右上角
- 只有繪圖區可左右滑；不可撐開整頁

## Result list

清單表頭與儲存格必須對齊 CSV 的 18 欄標題與原始值顯示。預設排序：成交日期（西元）新到舊。

## UX constraints

- 首次進頁載入本地預設資料（優先 JSON）並顯示圖表
- 上傳成功：切到上傳資料並重算 filterOptions
- 上傳失敗／標題不符：彈窗「不符合格式」，分析維持本地
- 下載永遠是本地預設 CSV
- 若無符合條件資料，需明確顯示空狀態
- 若本地資料載入失敗，需顯示錯誤訊息與可重試操作
- 篩選欄位桌面版以 **1 到 2 欄** 為主

## Implementation hints

- `realPriceRegistration.vue`：`localTransactions` + `activeTransactions`、上傳／下載、格式不符 modal
- `realPriceRegistrationCsv.service.ts`：標題契約、parse 上傳 CSV、`buildFilterOptionsFromTransactions`
- `realPriceRegistration.service.ts`：篩選、聚合、格式化、候選值搜尋
- `apis/.../realPriceRegistration.service.ts`：載入本地 `transactions.json`（或 fallback CSV）與本地 CSV 下載 URL
- 上傳依賴：`papaparse`（處理引號多行表頭）
- 本地 JSON 更新方式見 `real-price-registration-data`（手動轉換，無自動化）

## Code comments

註解規範以父 skill `vue-frontend-framework` 的 **Comment style（程式碼規範）** 為準：

- `interface`／`type`：`@description` + 每個欄位 `@property`
- function：`@description`；有分支／邊界規則時用條列寫清楚
- 目的是讓人可不靠猜就能讀懂邏輯；禁止空泛一句話註解

## Relation

- 父框架：`vue-frontend-framework`
- 首頁／側欄：`vue-frontend-framework/home`
- 靜態資料約定：`real-price-registration-data`
