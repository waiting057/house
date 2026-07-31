---
name: real-price-registration-page
description: >-
  Implements the real price registration (實價登錄) analysis page for the house
  Vue app. Use when building or changing views/real-price-registration, its
  routes, filters (including community), charts, summary (with P25/P75), target
  property comparison, pinned comparables, CSV upload/download, or local
  JSON/CSV default data. Source files come from 內政部實價查詢服務網 via user
  upload or local static files — no Open Data automation.
---

# Real Price Registration Page

英文模組名：**`real-price-registration`**（實價登錄分析頁）。

以 **台北市買賣案件** 為範圍（預設檔可為士林區），部署於 GitHub Pages。  
資料來自 [內政部不動產交易實價查詢服務網](https://lvr.land.moi.gov.tw/)：**使用者上傳 CSV**，或使用 repo 內**本地靜態檔**。沒有 Open Data 自動下載，也沒有排程更新。

目標是只依本 skill 即可從 0 實作出目前分析頁的互動、版面與圖表結果。

## 產品定位

本頁是**實價證據引擎**，不是自動鑑價或貸款工具。

| 能力 | 對應 UI |
|------|---------|
| 掃描 | 篩選＋摘要＋圖表＋清單 |
| 定錨 | 社區篩選＋可比釘選 |
| 出價 | 本案對照＋散點本案假設點 |

**不做**：新青安／貸款試算、成交機率、談判話術、自動鑑價模型、扣除車位後單價、主建物佔比／樓層篩選、面積 vs 單價圖、可比 Markdown／CSV 匯出、清單欄位排序、門牌全文搜尋、localStorage 持久化可比。

## When to use

- 建立或修改實價登錄分析頁
- 接上 `public/data/real-price-registration/` 本地預設資料
- 調整篩選、圖表、清單、上傳／下載與說明文案
- 調整**本案對照、社區篩選、可比案例釘選**

作業順序見 `skill-first-workflow`：**先規劃／審核 skill，通過後才改程式**。

## Place in app

- 路徑建議：`/real-price-registration`
- 左側選單需有對應入口（見 `vue-frontend-framework/home`）
- `meta.hasSidebar: true`

## Files（建議）

```
src/
├── views/real-price-registration/
│   ├── realPriceRegistration.vue          # 本案區、可比區、社區篩選、摘要分位
│   ├── realPriceRegistration.models.ts    # filters／本案／可比型別
│   ├── realPriceRegistration.service.ts   # 篩選、分位、價差、本案換算
│   └── realPriceRegistrationCsv.service.ts # filterOptions 含社區清單
├── apis/real-price-registration/
│   └── realPriceRegistration.service.ts
├── components/common/charts/
│   ├── lineChart.vue
│   └── scatterPlot.vue                    # 可選 referencePoints（本案假設點）
└── routers/
    └── realPriceRegistration.ts
```

邏輯優先放既有 service；不必為本案／可比硬拆新目錄。散點參考點擴充 `scatterPlot.vue`，不另開圖表元件。

## Data flow（必守）

```
1. 讀取 CSV
   - 有上傳 → 使用上傳的 CSV
   - 無上傳 → 使用本地預設資料
2. 解析成 JSON（RealPriceTransaction[]）
   - 上傳：執行期 parse CSV
   - 本地：優先直接載入事先轉好的 JSON（避免每次進頁都解析 CSV）
3. 畫面呈現（篩選／摘要／本案／可比／圖表／清單）
```

對應狀態建議：

- `localTransactions`：本地預設解析結果（進頁載入一次）
- `activeTransactions`：目前分析用（本地或上傳成功後）
- `filters`：含社區簡稱集合
- `targetProperty`：本案對照輸入（session 記憶體）
- `pinnedComparables`：可比釘選（session 記憶體；重整清空；不做 localStorage／後端）

切換上傳／本地資料集時：重設篩選，並**清空可比釘選與本案輸入**（避免 id／口徑錯亂）。

## Data dependency

- 檔案來源說明：[lvr.land.moi.gov.tw](https://lvr.land.moi.gov.tw/)（人工匯出，非本專案自動抓取）
- **本地預設（建議）**：`public/data/real-price-registration/transactions.json`（由 CSV 事先轉好）
- **本地 CSV 樣板／下載**：`public/data/real-price-registration/士林區實價登錄.csv`
- **上傳 CSV**：
  - 檔名可任意（不必與 `士林區實價登錄.csv` 相同）
  - 必須是 `.csv`
  - 內容標題必須與本地範本一致（正規化後比對 18 欄；允許引號內換行如 `單價(萬元/坪)`）
  - 成功才改用上傳資料；失敗彈窗「不符合格式」，分析維持本地
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
- `communityName` ← `社區簡稱`（篩選與可比展示用；CSV 契約不變、無新欄位）

### 分析狀態型別（非 CSV）

- `TargetPropertyInput`
  - `buildingAreaPing`：權狀坪數（必填才算單價）
  - `mainBuildingPing`：主建物坪（選填；僅顯示，不改行情計算）
  - `listPriceWan`：開價（選填）
  - `offerPricesWan`：出價字串陣列（空值略過；支援多檔同時顯示）
- `PinnedComparable`
  - `transactionId`：對應 `RealPriceTransaction.id`
  - `note`：使用者短註（可空）
- `RealPriceFilters` 增補：
  - `selectedCommunityNames: string[]`（有值＝只保留社區簡稱符合者）
  - `communityKeyword: string`（產生候選，不直接過濾）
- `FilterOptionsPayload` 增補：`communityNames: string[]`（來自 `communityName` 非空白去重）

## Filters

需支援：

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
13. **社區簡稱**：互動與路名相同（關鍵字 → 候選勾選／全選 → 加入保留集合；可多次加入；可移除）

篩選／摘要／圖表都吃篩選後的 `activeTransactions`。`filterOptions` 由目前 active 資料重建（含 `communityNames`）。

`filterTransactions`：若 `selectedCommunityNames.length > 0`，只保留 `communityName` 在集合內者；空白社區名不符任何已選社區。重設篩選時一併清空社區相關欄位。

### 路名、備註、社區互動

- 使用者輸入關鍵字後，顯示候選值
- 可勾選部分項目或全選
- 按下加入後，候選值進入已選集合
- 可再次輸入新的關鍵字並繼續加入
- 路名、社區集合是「保留符合」；備註集合是「排除符合」
- 社區候選 UX 與路名相同（高度上限、區塊內捲動）

## Layout

頁面採 **上圖下表**，且目前所有主要區塊都必須支援收合。區塊順序固定：

1. Hero：標題 + **上傳 CSV** / **下載**；顯示目前資料來源檔名與筆數
2. 篩選區（含社區簡稱）
3. 統計摘要區（單價／總價：平均、中位、**P25、P75**、最高、最低）
4. **本案對照區**（可收合）
5. **可比案例區**（可收合）
6. 圖表區（單價／總價／成交量／散點）
7. 說明區（須說明：本頁是實價證據，非自動鑑價／貸款試算）
8. 清單區：CSV 18 欄＋獨立操作欄；依西元 `tradeDate` 新到舊排序

### 收合互動

- 篩選區、統計摘要、本案對照、可比案例、每一張圖、成交點分布圖、說明區、清單區都可各自收合
- 收合按鈕用 **icon** 呈現，不顯示純文字「收合 / 展開」
- 預設進頁時全部展開

## 統計摘要與分位

- 對篩選後資料計算單價、總價的 min／avg／median／p25／p75／max
- 分位：有效數值排序後線性插值百分位（實作於 `realPriceRegistration.service.ts`）
- **有效單價筆數 &lt; 5**：摘要仍可顯示平均／中位／高低（若算得出）；**不顯示 P25／P75**；本案落點標籤也不顯示（改顯示「樣本不足」）
- 總價分位同樣以有效總價筆數 &lt; 5 為門檻

## 本案對照區

### 輸入

- 權狀坪數、主建物坪（選填）、開價（選填）
- 出價列：可新增／刪除；預設 3 個空欄位（不預填金額）

### 輸出（相對目前篩選後資料）

- 每一有效總價（開價＋各出價）：`單價 = 總價 ÷ 權狀坪數`（顯示 2 位小數）；權狀坪無效則不算
- 相對篩選後**單價**的中位數、P25、P75（樣本不足時顯示「樣本不足」）
- 落點標籤（以該假設單價對照單價 P25／P75；樣本足夠時）：
  - ＜ P25 →「偏買方」
  - P25～P75（含邊界）→「合理帶」
  - ＞ P75 →「偏貴」
  - 無法算分位 → 不顯示標籤

### 落點水位尺（溫度計式）

樣本足夠（有單價 P25／P75）且至少一列有效本案總價時，在結果表**左側或上方**顯示共用水位尺（單位：萬元／坪）：

```
偏貴
──────── P75：{p75}
合理帶
──────── P25：{p25}
偏買方
```

規則：

1. 水位數字：上界線＝篩選後單價 **P75**，下界線＝**P25**（與落點判斷同一組）
2. 每一有效開價／出價的換算單價，在尺上標一點（標籤區分「開價／出價 n」）；點所在區段即該列落點
3. 表格「落點」欄仍保留文字標籤（偏買方／合理帶／偏貴）
4. 樣本不足：不畫水位尺
5. 版面：桌面尺與結果表並排（尺在左）；窄螢幕尺在上、表在下
6. **不做**：總價水位尺、可拖曳調整分位、自訂門檻、統計摘要區水位尺

無篩選結果時本案區仍可編輯；分位與落點顯示空／樣本不足。

### 散點本案假設點

- 權狀坪有效且至少一個總價有效時，傳 `referencePoints` 給成交點分布圖（樣式須與成交點可區分）
- **X**：與篩選結果中**最新成交月對齊**；若無成交點可對齊，則畫在圖表 X 軸最右側
- **Y**：該假設的單價或總價（跟隨散點目前 metric 切換）
- hover：`本案假設｜總價｜單價`

## 可比案例區

### 釘選

- 清單每一列有「加入可比」；已釘選則改「移除可比」
- 同一 `transactionId` 不可重複；上限 **12** 筆；超過時提示且不加入
- 釘選集合不因篩選條件變動而移除；若該筆已不在 `activeTransactions`（換資料集）則自動剔除

### 展示

- 地址、社區、交易日期、型態、坪數、總價、單價、有無車位、使用者註記（可編輯）
- **本案對照總價**：預設用第一個有效出價；若無則用開價
- 若本案權狀坪與本案對照總價皆有效，顯示：
  - 總價差％ = `(可比總價 − 本案對照總價) / 本案對照總價 × 100`
  - 面積差％ = `(可比坪數 − 本案權狀坪) / 本案權狀坪 × 100`
  - 缺數值則該％顯示「—」

## Charts

### 單價走勢 / 總價走勢 / 成交量 / 散點

- 資料來源為篩選後交易的衍生欄位
- X 軸：`YYYY-MM` / `成交年月`；Y 軸單位在圖卡右上角
- 只有繪圖區可左右滑；不可撐開整頁
- 成交點分布：滑鼠移到點上顯示價錢（與單位）與地址摘要；資料量大時以 hover 為主，不在每個點常駐標價
- 散點可將**已釘選**成交點用不同樣式標出；無 pin 時維持現狀
- 散點支援可選 `referencePoints`（本案假設點）

## Result list

- 清單表頭與儲存格必須對齊 CSV 的 18 欄標題與原始值顯示
- **操作欄**（加入／移除可比）獨立在最前或最後，**不計入** CSV 標題驗證、不改變 18 欄契約
- 已釘選列需有視覺區分（列底色或標記）
- 預設排序：成交日期（西元）新到舊

## UX constraints

- 首次進頁載入本地預設資料（優先 JSON）並顯示圖表
- 上傳成功：切到上傳資料、重算 filterOptions、重設篩選、清空本案與可比
- 上傳失敗／標題不符：彈窗「不符合格式」，分析維持本地
- 下載永遠是本地預設 CSV
- 若無符合條件資料，需明確顯示空狀態
- 若本地資料載入失敗，需顯示錯誤訊息與可重試操作
- 篩選欄位桌面版以 **1 到 2 欄** 為主

## Implementation hints

- `realPriceRegistration.vue`：`localTransactions` + `activeTransactions`、上傳／下載、格式不符 modal、本案區、可比區、社區篩選
- `realPriceRegistrationCsv.service.ts`：標題契約、parse 上傳 CSV、`buildFilterOptionsFromTransactions`（含 `communityNames`）
- `realPriceRegistration.service.ts`：篩選、聚合、格式化、路名／備註／社區候選、`calculatePercentileStats`（或擴充 `calculateStats`）、本案單價與落點、可比價差％
- `apis/.../realPriceRegistration.service.ts`：載入本地 `transactions.json`（或 fallback CSV）與本地 CSV 下載 URL
- `buildScatterPoints` 維持；頁面組 `referencePoints` 與 pin 樣式傳入 `ScatterPlot`
- `getCommunityCandidates` 比照 `getRoadCandidates`
- 上傳依賴：`papaparse`（處理引號多行表頭）
- 本地 JSON 更新方式見 `real-price-registration-data`（手動轉換，無自動化）

## Code comments

註解規範以父 skill `vue-frontend-framework` 的 **Comment style（程式碼規範）** 為準：

- `interface`／`type`：`@description` + 每個欄位 `@property`
- function：`@description`；有分支／邊界規則時用條列寫清楚
- 目的是讓人可不靠猜就能讀懂邏輯；禁止空泛一句話註解

## Relation

- 作業順序：`skill-first-workflow`
- 父框架：`vue-frontend-framework`
- 首頁／側欄：`vue-frontend-framework/home`
- 靜態資料約定：`real-price-registration-data`（CSV 契約不變，本次無新欄位）
