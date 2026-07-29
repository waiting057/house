<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import LineChart from '@/components/common/charts/lineChart.vue'
import ScatterPlot from '@/components/common/charts/scatterPlot.vue'
import { useAppStore } from '@/stores'
import { RealPriceRegistrationDataService } from '@/apis/real-price-registration/realPriceRegistration.service'
import type {
  FilterOptionsPayload,
  RealPriceFilters,
  RealPriceTransaction,
} from './realPriceRegistration.models'
import {
  buildDealCountSeries,
  buildPriceSeries,
  buildScatterPoints,
  createInitialFilters,
  filterTransactions,
  formatNumber,
  getRemarkCandidates,
  getRoadCandidates,
} from './realPriceRegistration.service'
import {
  buildFilterOptionsFromTransactions,
  LOCAL_CSV_FILENAME,
  parseCsvText,
  REQUIRED_HEADERS,
} from './realPriceRegistrationCsv.service'

const appStore = useAppStore()

const filters = reactive<RealPriceFilters>(createInitialFilters())
const filterOptions = ref<FilterOptionsPayload>({
  districts: [],
  buildingTypes: [],
  roadNames: [],
  remarkValues: [],
})
/** 本地預設 CSV 解析結果；上傳失敗時仍以此為準 */
const localTransactions = ref<RealPriceTransaction[]>([])
/** 目前分析用資料（本地或上傳成功後的資料） */
const activeTransactions = ref<RealPriceTransaction[]>([])
/** 目前資料來源顯示名稱（本地檔名或上傳檔名） */
const activeSourceLabel = ref(LOCAL_CSV_FILENAME)
const errorMessage = ref('')
/** 上傳 CSV 標題／解析失敗時顯示「不符合格式」彈窗 */
const showFormatErrorModal = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const scatterMetric = ref<'unitPriceWanPerPing' | 'totalPriceWan'>('unitPriceWanPerPing')

/** 路名候選區：勾選後尚未加入「已選路名」的暫存 */
const pendingRoadSelections = ref<string[]>([])
/** 備註候選區：勾選後尚未加入「排除集合」的暫存 */
const pendingRemarkSelections = ref<string[]>([])
/** 各區塊是否展開（預設全部展開） */
const sectionStates = reactive({
  filters: true,
  summary: true,
  unitTrend: true,
  totalTrend: true,
  dealCountTrend: true,
  scatter: true,
  note: true,
  list: true,
})

/** 清單表頭：與 CSV 契約 18 欄完全一致 */
const listColumns = REQUIRED_HEADERS.map((header) => ({
  header,
  key: header,
}))

const filteredTransactions = computed(() => filterTransactions(activeTransactions.value, filters))

const roadCandidates = computed(() =>
  getRoadCandidates(activeTransactions.value, filters, filters.selectedRoadNames),
)

const remarkCandidates = computed(() =>
  getRemarkCandidates(activeTransactions.value, filters.remarkKeyword, filters.selectedRemarkExclusions),
)

const unitPriceSeries = computed(() => buildPriceSeries(filteredTransactions.value, 'unitPriceWanPerPing'))
const totalPriceSeries = computed(() => buildPriceSeries(filteredTransactions.value, 'totalPriceWan'))
const dealCountSeries = computed(() => buildDealCountSeries(filteredTransactions.value))
const scatterPoints = computed(() => buildScatterPoints(filteredTransactions.value, scatterMetric.value))

/** 符合條件清單：依西元成交日新到舊 */
const sortedTransactions = computed(() =>
  [...filteredTransactions.value].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)),
)

/**
 * @description 切換目前分析資料集：寫入 active、重建 filterOptions，並重設篩選為初始狀態
 * @param next 新的交易列
 * @param sourceLabel 來源顯示名稱（本地檔名或上傳檔名）
 */
function applyActiveDataset(next: RealPriceTransaction[], sourceLabel: string) {
  activeTransactions.value = next
  activeSourceLabel.value = sourceLabel
  filterOptions.value = buildFilterOptionsFromTransactions(next)
  resetFilters()
}

/**
 * @description 依 CSV 標題取出清單儲存格文字（顯示原始字串，空值用「—」）
 */
function getCsvCellValue(row: RealPriceTransaction, header: string) {
  const map: Record<string, string> = {
    地段位置或門牌: row.address,
    社區簡稱: row.communityName,
    交易日期: row.tradeDateRaw,
    '總價(萬元)': row.totalPriceWanRaw,
    '單價(萬元/坪)': row.unitPriceWanPerPingRaw,
    '總面積(坪)': row.buildingAreaPingRaw,
    主建物佔比: row.mainBuildingRatio,
    型態: row.buildingType,
    屋齡: row.buildingAgeRaw,
    '樓別/樓高': row.floorInfo,
    交易標的: row.transactionTarget,
    交易筆棟數: row.transactionUnits,
    建物現況格局: row.layout,
    '車位總價(萬元)': row.parkingPriceWanRaw,
    管理組織: row.hasManagement,
    電梯: row.hasElevator,
    主要用途: row.mainUse,
    備註: row.remark,
  }
  const value = map[header]
  return value && value.trim() ? value : '—'
}

/**
 * @description 計算摘要統計（平均、中位數、最高、最低）；無有效數值時全部為 null
 */
function calculateStats(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value != null).sort((a, b) => a - b)
  if (numbers.length === 0) {
    return {
      average: null,
      median: null,
      highest: null,
      lowest: null,
    }
  }

  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  const middle = Math.floor(numbers.length / 2)
  const median =
    numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle]

  return {
    average,
    median,
    highest: numbers[numbers.length - 1],
    lowest: numbers[0],
  }
}

const summary = computed(() => {
  const rows = filteredTransactions.value
  return {
    dealCount: rows.length,
    unitPrice: calculateStats(rows.map((row) => row.unitPriceWanPerPing)),
    totalPrice: calculateStats(rows.map((row) => row.totalPriceWan)),
  }
})

/**
 * @description 在候選暫存陣列中切換某一值的勾選狀態（有則移除、無則加入）
 */
function togglePendingSelection(collection: string[], value: string) {
  const index = collection.indexOf(value)
  if (index >= 0) {
    collection.splice(index, 1)
    return
  }
  collection.push(value)
}

/**
 * @description 把 pending 路名併入已選路名集合後清空 pending
 */
function addRoadSelections() {
  for (const value of pendingRoadSelections.value) {
    if (!filters.selectedRoadNames.includes(value)) {
      filters.selectedRoadNames.push(value)
    }
  }
  pendingRoadSelections.value = []
}

/**
 * @description 一次把目前路名候選全部加入已選路名
 */
function addAllRoadCandidates() {
  const values = roadCandidates.value.map((item) => item.value)
  pendingRoadSelections.value = values
  addRoadSelections()
}

/**
 * @description 把 pending 備註併入排除集合後清空 pending
 */
function addRemarkSelections() {
  for (const value of pendingRemarkSelections.value) {
    if (!filters.selectedRemarkExclusions.includes(value)) {
      filters.selectedRemarkExclusions.push(value)
    }
  }
  pendingRemarkSelections.value = []
}

/**
 * @description 一次把目前備註候選全部加入排除集合
 */
function addAllRemarkCandidates() {
  const values = remarkCandidates.value.map((item) => item.value)
  pendingRemarkSelections.value = values
  addRemarkSelections()
}

/**
 * @description 從已選集合移除單一項目（路名或備註排除 chip）
 */
function removeSelectedItem(collection: string[], value: string) {
  const index = collection.indexOf(value)
  if (index >= 0) {
    collection.splice(index, 1)
  }
}

/**
 * @description 切換已選集合中的項目（建物型態 chip：再點同一項可取消）
 */
function toggleSelectedItem(collection: string[], value: string) {
  const index = collection.indexOf(value)
  if (index >= 0) {
    collection.splice(index, 1)
    return
  }
  collection.push(value)
}

/**
 * @description 展開／收合指定區塊
 */
function toggleSection(section: keyof typeof sectionStates) {
  sectionStates[section] = !sectionStates[section]
}

/**
 * @description 重設所有篩選與候選 pending 狀態
 */
function resetFilters() {
  Object.assign(filters, createInitialFilters())
  pendingRoadSelections.value = []
  pendingRemarkSelections.value = []
}

/**
 * @description 進頁載入本地預設 CSV，寫入 local／active 並重建篩選選項
 */
async function loadData() {
  errorMessage.value = ''
  appStore.setLoading(true)
  try {
    const nextTransactions = await RealPriceRegistrationDataService.loadLocalCsv()
    localTransactions.value = nextTransactions
    applyActiveDataset(nextTransactions, LOCAL_CSV_FILENAME)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '資料載入失敗'
  } finally {
    appStore.setLoading(false)
  }
}

/**
 * @description 觸發隱藏的 file input，開啟系統檔案選擇
 */
function openFilePicker() {
  fileInputRef.value?.click()
}

/**
 * @description 處理上傳 CSV：成功則切換 active；失敗則彈窗並維持／還原本地資料
 *
 * 規則：
 * 1. 讀取檔案文字後走 parseCsvText（標題契約）
 * 2. 成功：applyActiveDataset(上傳資料, 檔名)
 * 3. 失敗：顯示「不符合格式」；若目前不是本地來源，還原 localTransactions
 */
async function onCsvSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const nextTransactions = parseCsvText(text)
    applyActiveDataset(nextTransactions, file.name)
  } catch {
    showFormatErrorModal.value = true
    // 格式不符時維持本地分析；若先前已切到上傳檔，則還原本地資料
    if (activeSourceLabel.value !== LOCAL_CSV_FILENAME) {
      applyActiveDataset(localTransactions.value, LOCAL_CSV_FILENAME)
    }
  }
}

/**
 * @description 固定下載本地預設 CSV（不是目前上傳檔）
 */
function downloadLocalCsv() {
  const link = document.createElement('a')
  link.href = RealPriceRegistrationDataService.getLocalCsvUrl()
  link.download = LOCAL_CSV_FILENAME
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * @description 關閉「不符合格式」彈窗
 */
function closeFormatErrorModal() {
  showFormatErrorModal.value = false
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <section class="page">
    <header class="page__hero">
      <div>
        <p class="page__eyebrow">
          Taipei real price
        </p>
        <h1 class="page__title">
          實價登錄分析
        </h1>
        <p class="page__lead">
          先以台北市買賣案件做第一版。你可以依行政區、路名、型態、屋齡、坪數、價格與備註排除條件，快速縮小到想看的成交樣本。
        </p>
      </div>
      <div class="page__meta">
        <p>
          目前資料：
          <strong>{{ activeSourceLabel }}</strong>
        </p>
        <p>
          筆數：
          <strong>{{ activeTransactions.length }}</strong>
        </p>
        <div class="page__actions">
          <input
            ref="fileInputRef"
            class="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            @change="onCsvSelected"
          >
          <button
            type="button"
            class="button"
            @click="openFilePicker"
          >
            上傳 CSV
          </button>
          <button
            type="button"
            class="button button--ghost"
            @click="downloadLocalCsv"
          >
            下載
          </button>
        </div>
      </div>
    </header>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            篩選條件
          </h2>
          <p class="panel__hint">
            路名與備註都支援關鍵字搜尋後分批加入集合。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.filters"
          aria-label="切換篩選條件區塊"
          @click="toggleSection('filters')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.filters }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.filters"
        class="panel__content"
      >
        <div class="panel__actions">
          <button
            type="button"
            class="button button--ghost"
            @click="resetFilters"
          >
            重設篩選
          </button>
        </div>

        <div
          v-if="errorMessage"
          class="notice notice--error"
        >
          {{ errorMessage }}
          <button
            type="button"
            class="button button--inline"
            @click="loadData"
          >
            重新載入
          </button>
        </div>

        <div class="filters-grid">
        <label class="field">
          <span class="field__label">行政區</span>
          <select
            v-model="filters.district"
            class="field__control"
          >
            <option value="">
              全部行政區
            </option>
            <option
              v-for="district in filterOptions.districts"
              :key="district"
              :value="district"
            >
              {{ district }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">交易時間區間</span>
          <div class="range">
            <input
              v-model="filters.startTradeMonth"
              class="field__control"
              type="month"
            >
            <span class="range__sep">~</span>
            <input
              v-model="filters.endTradeMonth"
              class="field__control"
              type="month"
            >
          </div>
        </label>

        <div class="field field--full">
          <span class="field__label">建物型態</span>
          <p class="field__hint">
            可多選，再次點擊同一項即可取消。
          </p>
          <div class="option-chips">
            <button
              v-for="type in filterOptions.buildingTypes"
              :key="type"
              type="button"
              class="option-chip"
              :class="{ 'option-chip--active': filters.buildingTypes.includes(type) }"
              @click="toggleSelectedItem(filters.buildingTypes, type)"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <label class="field">
          <span class="field__label">屋齡區間</span>
          <div class="range">
            <input
              v-model="filters.minBuildingAge"
              class="field__control"
              inputmode="decimal"
              placeholder="最小"
            >
            <span class="range__sep">~</span>
            <input
              v-model="filters.maxBuildingAge"
              class="field__control"
              inputmode="decimal"
              placeholder="最大"
            >
          </div>
        </label>

        <label class="field">
          <span class="field__label">總面積（坪）</span>
          <div class="range">
            <input
              v-model="filters.minArea"
              class="field__control"
              inputmode="decimal"
              placeholder="最小"
            >
            <span class="range__sep">~</span>
            <input
              v-model="filters.maxArea"
              class="field__control"
              inputmode="decimal"
              placeholder="最大"
            >
          </div>
        </label>

        <label class="field">
          <span class="field__label">總價（萬元）</span>
          <div class="range">
            <input
              v-model="filters.minTotalPrice"
              class="field__control"
              inputmode="decimal"
              placeholder="最小"
            >
            <span class="range__sep">~</span>
            <input
              v-model="filters.maxTotalPrice"
              class="field__control"
              inputmode="decimal"
              placeholder="最大"
            >
          </div>
        </label>

        <label class="field">
          <span class="field__label">單價（萬元/坪）</span>
          <div class="range">
            <input
              v-model="filters.minUnitPrice"
              class="field__control"
              inputmode="decimal"
              placeholder="最小"
            >
            <span class="range__sep">~</span>
            <input
              v-model="filters.maxUnitPrice"
              class="field__control"
              inputmode="decimal"
              placeholder="最大"
            >
          </div>
        </label>

        <label class="field">
          <span class="field__label">是否有車位</span>
          <select
            v-model="filters.parking"
            class="field__control"
          >
            <option value="all">
              不限
            </option>
            <option value="yes">
              有車位
            </option>
            <option value="no">
              無車位
            </option>
          </select>
        </label>
        </div>

        <div class="search-blocks">
          <section class="search-block">
          <div class="search-block__header">
            <div>
              <h3>路名多選</h3>
              <p>輸入關鍵字後，選擇符合的路名加入篩選集合。</p>
            </div>
            <div class="search-block__actions">
              <button
                type="button"
                class="button button--ghost"
                @click="addAllRoadCandidates"
              >
                全選候選
              </button>
              <button
                type="button"
                class="button"
                @click="addRoadSelections"
              >
                加入已選
              </button>
            </div>
          </div>

          <input
            v-model="filters.roadKeyword"
            class="field__control"
            placeholder="例如：士東路、中山北路六段、德行東路"
          >

          <div class="candidate-list">
            <label
              v-for="candidate in roadCandidates"
              :key="candidate.value"
              class="candidate-list__item"
            >
              <input
                :checked="pendingRoadSelections.includes(candidate.value)"
                type="checkbox"
                @change="togglePendingSelection(pendingRoadSelections, candidate.value)"
              >
              <span>{{ candidate.value }}</span>
            </label>
            <p
              v-if="filters.roadKeyword && roadCandidates.length === 0"
              class="candidate-list__empty"
            >
              沒有符合的路名候選值。
            </p>
          </div>

          <div class="chips">
            <button
              v-for="roadName in filters.selectedRoadNames"
              :key="roadName"
              type="button"
              class="chip"
              @click="removeSelectedItem(filters.selectedRoadNames, roadName)"
            >
              {{ roadName }} ×
            </button>
          </div>
          </section>

          <section class="search-block">
          <div class="search-block__header">
            <div>
              <h3>備註排除</h3>
              <p>用關鍵字找出特殊交易、親友交易等備註後加入排除集合。</p>
            </div>
            <div class="search-block__actions">
              <button
                type="button"
                class="button button--ghost"
                @click="addAllRemarkCandidates"
              >
                全選候選
              </button>
              <button
                type="button"
                class="button"
                @click="addRemarkSelections"
              >
                加入排除
              </button>
            </div>
          </div>

          <input
            v-model="filters.remarkKeyword"
            class="field__control"
            placeholder="例如：親友、關係人、車位、增建"
          >

          <div class="candidate-list">
            <label
              v-for="candidate in remarkCandidates"
              :key="candidate.value"
              class="candidate-list__item"
            >
              <input
                :checked="pendingRemarkSelections.includes(candidate.value)"
                type="checkbox"
                @change="togglePendingSelection(pendingRemarkSelections, candidate.value)"
              >
              <span>{{ candidate.value }}</span>
            </label>
            <p
              v-if="filters.remarkKeyword && remarkCandidates.length === 0"
              class="candidate-list__empty"
            >
              沒有符合的備註候選值。
            </p>
          </div>

          <div class="chips">
            <button
              v-for="remark in filters.selectedRemarkExclusions"
              :key="remark"
              type="button"
              class="chip chip--muted"
              @click="removeSelectedItem(filters.selectedRemarkExclusions, remark)"
            >
              {{ remark }} ×
            </button>
          </div>
          </section>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            統計摘要
          </h2>
          <p class="panel__hint">
            彙整目前篩選條件下的成交筆數、單價與總價分布。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.summary"
          aria-label="切換統計摘要區塊"
          @click="toggleSection('summary')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.summary }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.summary"
        class="panel__content"
      >
        <section class="summary-grid">
          <article class="summary-card">
            <p class="summary-card__label">
              符合成交筆數
            </p>
            <p class="summary-card__value">
              {{ summary.dealCount }}
            </p>
          </article>
          <article class="summary-card">
            <p class="summary-card__title">
              單價
            </p>
            <dl class="summary-card__stats">
              <div class="summary-card__row">
                <dt>平均：</dt>
                <dd>{{ formatNumber(summary.unitPrice.average, 1) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>中位數：</dt>
                <dd>{{ formatNumber(summary.unitPrice.median, 1) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>最高：</dt>
                <dd>{{ formatNumber(summary.unitPrice.highest, 1) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>最低：</dt>
                <dd>{{ formatNumber(summary.unitPrice.lowest, 1) }}</dd>
              </div>
            </dl>
          </article>
          <article class="summary-card">
            <p class="summary-card__title">
              總價
            </p>
            <dl class="summary-card__stats">
              <div class="summary-card__row">
                <dt>平均：</dt>
                <dd>{{ formatNumber(summary.totalPrice.average, 0) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>中位數：</dt>
                <dd>{{ formatNumber(summary.totalPrice.median, 0) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>最高：</dt>
                <dd>{{ formatNumber(summary.totalPrice.highest, 0) }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>最低：</dt>
                <dd>{{ formatNumber(summary.totalPrice.lowest, 0) }}</dd>
              </div>
            </dl>
          </article>
        </section>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            單價走勢
          </h2>
          <p class="panel__hint">
            顯示每月單價的中位數與平均數。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.unitTrend"
          aria-label="切換單價走勢區塊"
          @click="toggleSection('unitTrend')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.unitTrend }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.unitTrend"
        class="panel__content"
      >
        <div class="chart-scroll">
          <LineChart
            title="單價走勢"
            :points="unitPriceSeries"
            primary-label="中位數"
            secondary-label="平均數（虛線）"
            unit-label="萬元 / 坪"
            x-axis-label="成交年月"
          />
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            總價走勢
          </h2>
          <p class="panel__hint">
            顯示每月總價的中位數與平均數。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.totalTrend"
          aria-label="切換總價走勢區塊"
          @click="toggleSection('totalTrend')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.totalTrend }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.totalTrend"
        class="panel__content"
      >
        <div class="chart-scroll">
          <LineChart
            title="總價走勢"
            :points="totalPriceSeries"
            primary-label="中位數"
            secondary-label="平均數（虛線）"
            unit-label="萬元"
            x-axis-label="成交年月"
          />
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            成交量
          </h2>
          <p class="panel__hint">
            顯示每月符合條件的成交筆數。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.dealCountTrend"
          aria-label="切換成交量區塊"
          @click="toggleSection('dealCountTrend')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.dealCountTrend }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.dealCountTrend"
        class="panel__content"
      >
        <div class="chart-scroll">
          <LineChart
            title="成交量"
            :points="dealCountSeries"
            primary-label="成交筆數"
            unit-label="筆"
            x-axis-label="成交年月"
          />
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header panel__header--center">
        <div>
          <h2 class="panel__title">
            成交點分布圖
          </h2>
          <p class="panel__hint">
            顯示目前篩選後的全部資料，每個點代表一筆成交。
          </p>
        </div>
        <div class="segmented">
          <button
            type="button"
            class="segmented__button"
            :class="{ 'segmented__button--active': scatterMetric === 'unitPriceWanPerPing' }"
            @click="scatterMetric = 'unitPriceWanPerPing'"
          >
            單價分布
          </button>
          <button
            type="button"
            class="segmented__button"
            :class="{ 'segmented__button--active': scatterMetric === 'totalPriceWan' }"
            @click="scatterMetric = 'totalPriceWan'"
          >
            總價分布
          </button>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.scatter"
          aria-label="切換成交點分布圖區塊"
          @click="toggleSection('scatter')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.scatter }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.scatter"
        class="panel__content"
      >
        <div class="chart-scroll">
          <ScatterPlot
            :title="scatterMetric === 'unitPriceWanPerPing' ? '單價分布' : '總價分布'"
            :points="scatterPoints"
            :unit-label="scatterMetric === 'unitPriceWanPerPing' ? '萬元 / 坪' : '萬元'"
            x-axis-label="成交年月"
          />
        </div>
      </div>
    </section>

    <section class="panel panel--note">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            為什麼中位數比較值得參考？
          </h2>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.note"
          aria-label="切換中位數說明區塊"
          @click="toggleSection('note')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.note }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>
      <div
        v-if="sectionStates.note"
        class="panel__content"
      >
        <p class="note">
          實價登錄會混入特殊高價案、親友或關係人交易、僅車位交易、附帶增建等樣本，平均數很容易被極端值拉動。中位數較不受少數異常案件影響，因此更適合用來觀察特定區域的行情變化；平均數則保留為輔助觀察線。
        </p>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            符合條件清單
          </h2>
          <p class="panel__hint">
            依成交日期新到舊排序。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.list"
          aria-label="切換成交清單區塊"
          @click="toggleSection('list')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.list }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.list"
        class="panel__content"
      >
        <div
          v-if="sortedTransactions.length === 0"
          class="notice"
        >
          目前沒有符合條件的成交資料。
        </div>

        <div
          v-else
          class="table-wrap"
        >
          <table class="table">
            <thead>
              <tr>
                <th
                  v-for="column in listColumns"
                  :key="column.key"
                >
                  {{ column.header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in sortedTransactions"
                :key="row.id"
              >
                <td
                  v-for="column in listColumns"
                  :key="`${row.id}-${column.key}`"
                >
                  {{ getCsvCellValue(row, column.header) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div
      v-if="showFormatErrorModal"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-format-error-title"
    >
      <button
        type="button"
        class="modal__backdrop"
        aria-label="關閉不符合格式提示"
        @click="closeFormatErrorModal"
      />
      <div class="modal__panel">
        <h2
          id="csv-format-error-title"
          class="modal__title"
        >
          不符合格式
        </h2>
        <p class="modal__body">
          請使用與本地預設檔相同標題的 CSV，分析將繼續使用本地資料。
        </p>
        <button
          type="button"
          class="button"
          @click="closeFormatErrorModal"
        >
          關閉
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1.25rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  box-sizing: border-box;
}

.page__hero,
.panel,
.summary-card {
  border: 1px solid var(--color-line);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(10px);
  min-width: 0;
}

.page__hero,
.panel {
  padding: 1.35rem;
}

.page__hero {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.page__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--color-accent);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

.page__title {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
}

.page__lead,
.page__meta,
.panel__hint,
.note,
.candidate-list__empty,
.notice {
  color: var(--color-ink-muted);
  line-height: 1.65;
}

.page__lead {
  max-width: 46rem;
  margin: 0;
}

.page__meta {
  min-width: 12rem;
  font-size: 0.94rem;
}

.page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1.25rem;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  margin: 0;
  background: rgba(20, 24, 28, 0.45);
  cursor: pointer;
}

.modal__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 22rem);
  padding: 1.35rem;
  border-radius: 1rem;
  border: 1px solid var(--color-line);
  background: #fff;
  display: grid;
  gap: 0.85rem;
}

.modal__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
}

.modal__body {
  margin: 0;
  color: var(--color-ink-muted);
  line-height: 1.6;
}

.panel__header,
.search-block__header {
  display: flex;
  justify-content: flex-start;
  gap: 1rem;
  align-items: flex-start;
}

.panel__header--center {
  align-items: center;
}

.panel__header {
  flex-wrap: wrap;
  align-items: center;
}

.panel__content {
  margin-top: 1rem;
}

.panel__actions {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1rem;
}

.panel__title,
.search-block h3 {
  margin: 0;
}

.panel__hint,
.search-block p,
.summary-card__label {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.field {
  display: grid;
  gap: 0.45rem;
}

.field--full {
  grid-column: 1 / -1;
}

.field__label {
  font-size: 0.92rem;
  font-weight: 600;
}

.field__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.86rem;
}

.field__control {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: 0.85rem;
  background: #fff;
  color: var(--color-ink);
}

.range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
}

.range__sep {
  color: var(--color-ink-muted);
}

.search-blocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.search-block {
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: rgba(247, 244, 239, 0.8);
  min-width: 0;
}

.search-block__actions {
  display: flex;
  gap: 0.55rem;
}

.candidate-list {
  display: grid;
  gap: 0.45rem;
  max-height: 14rem;
  margin-top: 0.75rem;
  padding: 0.2rem 0.1rem 0.2rem 0;
  overflow: auto;
}

.candidate-list__item {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  font-size: 0.94rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.chip,
.button {
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.option-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.option-chip {
  padding: 0.65rem 0.95rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: #fff;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease;
}

.option-chip--active {
  border-color: transparent;
  background: var(--color-accent);
  color: #f0fdfa;
}

.chip {
  padding: 0.45rem 0.75rem;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.chip--muted {
  background: #efe4ff;
  color: #6d28d9;
}

.button {
  padding: 0.65rem 1rem;
  background: var(--color-accent);
  color: #f0fdfa;
}

.button--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  min-width: 1.5rem;
  min-height: 1.5rem;
  padding: 0;
  order: -1;
}

.collapse-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  line-height: 1;
  transition: transform 0.2s ease;
}

.collapse-icon--collapsed {
  transform: rotate(180deg);
}

.segmented {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  margin-left: auto;
}

.segmented__button {
  padding: 0.55rem 0.9rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.segmented__button--active {
  background: var(--color-accent);
  color: #f0fdfa;
}

.button--ghost,
.button--inline {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-line));
}

.button--inline {
  margin-left: 0.75rem;
}

.summary-grid {
  display: grid;
  gap: 1rem;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.summary-card {
  padding: 1rem 1.1rem;
}

.summary-card__value {
  margin: 0.35rem 0 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.summary-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.summary-card__stats {
  display: grid;
  gap: 0.45rem;
  margin: 0;
}

.summary-card__row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-ink-muted);
}

.summary-card__row dt,
.summary-card__row dd {
  margin: 0;
}

.panel--note {
  background: rgba(240, 253, 250, 0.72);
}

.chart-scroll {
  overflow: hidden;
}

.notice {
  padding: 1rem;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.76);
}

.notice--error {
  background: rgba(255, 238, 238, 0.88);
}

.table-wrap {
  overflow: auto;
  margin-top: 0.75rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 72rem;
}

.table th,
.table td {
  padding: 0.8rem 0.7rem;
  border-bottom: 1px solid var(--color-line);
  text-align: left;
  vertical-align: top;
  font-size: 0.92rem;
}

.table th {
  color: var(--color-ink-muted);
  font-weight: 600;
}

@media (max-width: 1200px) {
  .page__hero,
  .search-block__header {
    flex-direction: column;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .search-blocks {
    grid-template-columns: 1fr;
  }

  .panel__actions {
    justify-content: flex-start;
  }
}
</style>
