---
name: skill-first-workflow
description: >-
  Enforces house project workflow: plan and review the relevant .cursor/skills
  SKILL.md first, get user approval, then implement code. Use for any feature
  change, page skill update, refactor that changes behavior, or when creating
  implementation plans. Do not start coding until the skill is approved.
---

# Skill-First Workflow（先審 skill、再改程式）

本 repo 所有功能調整都必須遵守：

**先規劃／審核 skill，通過後才改程式**

## When to use

- 新增或修改功能（含 Vue 頁面、資料契約、後端骨架）
- 撰寫／更新實作計畫（CreatePlan 或同等規劃）
- 擴充既有 page／data skill（例如 `vue-frontend-framework/*`、`real-price-registration-data`）
- 行為會變的重構（不只是錯字、純格式、與 skill 無關的小修）

## When not required

以下可直接改程式，不必先走 skill 審核：

- 明顯 bugfix，且修正不改變 skill 已寫明的行為契約
- 純 typo、格式、註解、與對外行為無關的整理
- 使用者明確說「跳過 skill、直接改程式」

## Mandatory sequence

```
1. 找出會受影響的既有 skill（.cursor/skills/.../SKILL.md）
   - 沒有對應 skill → 先草擬新 skill（或擴充最接近的 parent skill）
2. 規劃／起草 skill 變更（寫進計畫或直接改 skill 草稿給使用者看）
3. 停止：等使用者審核通過
4. 通過後：先把核准內容寫入正式 SKILL.md（若尚未寫入）
5. 再依 skill 實作程式；程式不得超出已核准 skill 範圍
```

### 硬性禁止

- **禁止**在使用者核准 skill 前就改業務程式（`src/`、設定行為的 config 等）
- **禁止**邊寫程式邊「順便」擴 skill 當既成事實
- **禁止**實作 skill 未記載的行為，然後事後補 skill 應付

### 計畫（Plan）必寫

任何實作計畫都必須標明：

1. 要改／新增哪些 skill 路徑
2. skill 規格草稿或 diff 摘要（行為契約要具體，避免「可選／視情況」）
3. 明確寫：**Skill 核准後才實作**
4. 本次**不納入** skill 的範圍（避免範圍膨脹）

## Skill 寫法要求（審核用）

寫給審核的 skill 草稿必須能讓人只靠 skill 重做一版相同結果，至少包含：

- 產品定位／不做什麼
- 資料契約或狀態模型（若有）
- UI／互動行為契約（輸入、輸出、邊界）
- 檔案落點與實作提示
- 與相關 skill 的 Relation

風格對齊既有 house skills：`vue-frontend-framework`、`real-price-registration`、`real-price-registration-data` 等。

## Relation

- 各功能細節以對應 page／data／backend skill 為準
- 本 skill 只管**作業順序**；不取代各功能 skill 的規格內容
