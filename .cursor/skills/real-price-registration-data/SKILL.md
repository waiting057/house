---
name: real-price-registration-data
description: >-
  Builds the GitHub Actions / local pipeline that downloads Taiwan MOI real
  price registration (實價登錄) open data, cleans it, and writes static JSON
  under public/data/real-price-registration for the Vue GitHub Pages app. Use
  when adding or changing 實價登錄 data ingest, schema, or scheduled updates.
  Other open-data sources get their own skills later.
---

# Real Price Registration Data Pipeline

英文資料夾名：**`real-price-registration`**（實價登錄資料）。負責從政府 Open Data 取得實價登錄批次資料，轉成前端可讀的靜態 JSON，供 GitHub Pages 使用。其他政府資料集日後另開 skill。

## When to use

- 建立或修改實價登錄下載、清洗、聚合、輸出路徑
- 調整 GitHub Actions 排程更新
- 與分析頁約定 JSON schema 時

## Goal

```
政府 Open Data（ZIP / CSV）
  → 下載與解壓
  → 清洗／篩選／聚合
  → public/data/real-price-registration/*.json
  → Vue 分析頁讀取（見 vue-frontend-framework/real-price-registration）
```

- **非即時**：跟隨官方發布節奏（約每月 1／11／21）
- **自動化**：以 GitHub Actions 排程為主，開發者不必每次手動更新
- **無外部資料庫**：只產出靜態檔

## Official source

- 內政部不動產成交案件實際資訊資料供應系統：<https://plvr.land.moi.gov.tw/DownloadOpenData>
- 政府資料開放平臺相關資料集（CSV／XML 之 ZIP）
- 優先使用 **CSV**（較 XML 易處理）；勿假設有穩定的即時 JSON API

實作時應查閱當期下載頁與 schema 檔（如 `schema-main.csv` 等），欄位以官方為準。

## Output layout

```
public/data/real-price-registration/
├── manifest.json              # 資料版本、來源期別、產生時間、涵蓋範圍
├── monthly-summary.json       # 依年月聚合：筆數、單價統計等（分析頁主資料）
└── (optional) chunks/         # 若需明細，再分縣市或年月切檔
```

路徑必須與前端 `BASE_URL + 'data/real-price-registration/...'` 一致。

### `manifest.json`（建議欄位）

```json
{
  "generatedAt": "ISO-8601",
  "source": "MOI real price registration open data",
  "periods": ["..."],
  "scope": {
    "cities": ["台北市"],
    "transactionType": "買賣",
    "years": [2023, 2024, 2025]
  },
  "files": ["monthly-summary.json"]
}
```

### `monthly-summary.json`（建議列結構，可再擴）

```json
[
  {
    "year": 2024,
    "month": 1,
    "city": "台北市",
    "district": null,
    "dealCount": 0,
    "unitPriceAvg": null,
    "unitPriceMedian": null
  }
]
```

- 單價單位與計算方式（例：元／坪，總價÷建物面積並做車位／非建物過濾）寫進管線註解與 `manifest` 或 README 片段，前後端一致。
- 興趣專案建議**先縮小範圍**（單一或少數縣市、近幾年、僅買賣），避免 repo／Pages 過大。

## Pipeline steps

1. **Download**：取得指定期別 ZIP（本期與必要之歷史期）
2. **Extract**：解壓 CSV
3. **Parse & clean**：編碼、欄位對應、排除無效列、計算單價與交易年月
4. **Aggregate**：依年／月（及縣市等維度）產出 summary
5. **Write**：寫入 `public/data/real-price-registration/`
6. **Commit or upload**：Actions 中 commit 回預設分支，或上傳 Artifact／Release（偏好 commit 到 `public/data` 以便 Pages 直接提供）

腳本語言建議：Node.js 或 Python（擇一寫進 repo，例如 `scripts/real-price-registration/`），並在 skill 實作時固定一種。

## GitHub Actions

建議 workflow（名稱可自訂）：

- **triggers**：`workflow_dispatch`（手動）+ `schedule`（例：每月 2／12／22，避開官方公布當日尖峰）
- **job**：checkout → 跑管線腳本 → 若有檔案變更則 commit push（需 `contents: write`）
- Pages 部署可沿用既有前端 build workflow；資料更新後觸發或與 build 分開皆可

## Interest-project constraints

- 不爬動態查詢網、不繞過 Open Data 授權條款
- 不把全國原始 CSV 長期塞進 git；只提交精簡 JSON
- 失敗時 Actions 應失敗並可重跑；前端可顯示 `manifest.generatedAt` 讓使用者知道資料多久以前

## Relation to other skills

- 前端框架：`vue-frontend-framework`
- 分析頁：`vue-frontend-framework/real-price-registration`（讀取本管線產出）
- 其他 Open Data：另開獨立資料管線 skill，勿塞進本目錄
