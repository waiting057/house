---
name: real-price-registration-data
description: >-
  Documents how real price registration (實價登錄) static files are prepared for
  the house Vue app: manual CSV from 內政部實價查詢服務網, local default files
  under public/data/real-price-registration, and optional one-off CSV→JSON
  conversion. No Open Data crawl and no scheduled automation. Use when adding
  or changing local CSV/JSON assets, CSV header contract, or conversion scripts.
---

# Real Price Registration Data（本地靜態檔）

英文資料夾名：**`real-price-registration`**（實價登錄資料）。

本專案**不使用**政府 Open Data API／批次 ZIP 自動下載，也**沒有** GitHub Actions 排程更新。

資料由使用者自行從官方查詢網取得 CSV，再放到 repo 本地或於分析頁上傳。

## When to use

- 新增／更新 `public/data/real-price-registration/` 底下的預設 CSV 或預先轉好的 JSON
- 調整 CSV 標題契約或 CSV→JSON 轉換腳本（手動執行，非自動化）
- 與分析頁約定靜態檔路徑與 JSON schema

## Official source（人工下載）

檔案來源：[內政部不動產交易實價查詢服務網](https://lvr.land.moi.gov.tw/)

- 使用者在該網站查詢／匯出 CSV 後，自行上傳到分析頁，或替換 repo 內本地預設檔
- **禁止**把 Open Data 批次下載、爬蟲、排程抓取當成本專案主流程
- **禁止**假設有自動化管線會更新資料

## Program data flow（與分析頁一致）

```
1. 讀取 CSV
   - 有上傳 → 使用上傳的 CSV
   - 無上傳 → 使用本地預設檔
2. 解析成分析用 JSON（RealPriceTransaction[]）
   - 上傳：執行期用 papaparse 解析
   - 本地：可事先轉成 JSON，頁面直接 fetch JSON，避免每次解析 CSV
3. 畫面呈現（篩選／圖表／清單）
```

## Goal

```
https://lvr.land.moi.gov.tw/（人工匯出 CSV）
  → 使用者上傳，或放入 public/data/real-price-registration/
  →（可選）手動腳本 CSV → transactions.json
  → Vue 分析頁讀取並呈現
```

- **無自動化**：更新資料靠人工替換檔案或上傳
- **無外部資料庫**：只使用靜態檔 + 瀏覽器內解析上傳檔
- **興趣專案約束**：不爬查詢網、不繞過網站使用條款

## Output layout

```
public/data/real-price-registration/
├── 士林區實價登錄.csv         # 本地預設 CSV（來源樣板／下載用）
└── transactions.json          # 建議：由上述 CSV 事先轉好，供頁面預設載入
```

路徑必須與前端 `BASE_URL + 'data/real-price-registration/...'` 一致。

| 檔案 | 用途 |
|------|------|
| `士林區實價登錄.csv` | 標題契約樣板；Hero「下載」固定下載此檔；也可當轉換腳本輸入 |
| `transactions.json` | 頁面預設分析資料（已解析），避免每次進頁都 parse CSV |

舊的 Open Data 產物（`manifest.json`、`monthly-summary.json`、`filter-options.json` 等）**不再是主路徑**；若不需要可移除，勿再把它們寫成必備依賴。

### CSV 標題契約（正規化後必須一致）

本地預設檔與上傳檔標題（去掉換行與多餘空白後）必須完全一致：

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

注意：原始檔部分欄位用引號包住並含換行（如 `"單價\n(萬元/坪)"`），驗證時先正規化再比對。

### `transactions.json`（分析用列結構）

由 CSV 解析而來，需同時保留 **CSV 原始 18 欄**（清單顯示）與 **衍生欄位**（篩選／圖表）：

```json
[
  {
    "id": "...",
    "city": "台北市",
    "district": "士林區",
    "roadName": "延平北路六段",
    "fullAddress": "士林區延平北路六段…",
    "buildingType": "住宅大樓(11層含以上有電梯)",
    "tradeDate": "2026-06-11",
    "tradeYearMonth": "2026-06",
    "buildingCompletionDate": null,
    "buildingAgeYears": 20,
    "buildingAreaPing": 22.73,
    "totalPriceWan": 900,
    "unitPriceWanPerPing": 39.59,
    "hasParking": true,
    "parkingType": null,
    "remark": "…",
    "address": "士林區延平北路六段…",
    "communityName": "",
    "tradeDateRaw": "115/06/11",
    "totalPriceWanRaw": "900",
    "unitPriceWanPerPingRaw": "39.59",
    "buildingAreaPingRaw": "22.73",
    "mainBuildingRatio": "61.44%",
    "buildingAgeRaw": "20",
    "floorInfo": "七層/十一層",
    "transactionTarget": "房地(土地+建物)+車位",
    "transactionUnits": "土:1 建:1車:1",
    "layout": "1房1廳1衛",
    "parkingPriceWanRaw": "",
    "hasManagement": "有",
    "hasElevator": "有",
    "mainUse": "住家用"
  }
]
```

衍生規則摘要：

- `district` / `roadName`：從 `地段位置或門牌` 解析
- `tradeDate` / `tradeYearMonth`：民國 `yyy/mm/dd` → 西元
- `buildingType` ← `型態`；屋齡／坪數／總價／單價由對應欄位轉 number
- `hasParking`：由 `交易筆棟數`（`車:` 且非 0）、`交易標的` 含車位、或 `車位總價` 判斷

## Optional conversion script（手動）

若要更新本地預設 JSON，可提供 **手動執行** 的 Node 腳本（例如 `scripts/real-price-registration/csv-to-json.mjs`）：

1. 讀取 `士林區實價登錄.csv`
2. 驗證標題契約
3. 轉成與前端相同的 `RealPriceTransaction[]`
4. 寫入 `transactions.json`

- **不要**接 GitHub Actions schedule
- **不要**從 Open Data／查詢網自動下載
- 開發者有新的 CSV 時，自行替換 CSV 後跑一次腳本即可

## Interest-project constraints

- 資料來源僅限使用者自行從 [lvr.land.moi.gov.tw](https://lvr.land.moi.gov.tw/) 取得的檔案，或 repo 內已放好的靜態檔
- 不引入外部資料庫
- 不實作 Open Data／排程自動化更新
- CSV 表頭可能含 BOM 或引號內換行，parser／轉換腳本都要正規化後再驗證

## Code comments

轉換腳本與相關 TypeScript 註解，同樣遵守 `vue-frontend-framework` 的 **Comment style**：完整 `@description`／規則條列，讓人能讀懂解析與欄位轉換邏輯。

## Relation to other skills

- 前端框架：`vue-frontend-framework`
- 分析頁：`vue-frontend-framework/real-price-registration`（讀取本地 JSON 或上傳 CSV）
