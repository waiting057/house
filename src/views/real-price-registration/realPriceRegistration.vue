<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import LineChart from '@/components/common/charts/lineChart.vue'
import ScatterPlot from '@/components/common/charts/scatterPlot.vue'
import { useAppStore } from '@/stores'
import { RealPriceRegistrationDataService } from '@/apis/real-price-registration/realPriceRegistration.service'
import type {
  FilterOptionsPayload,
  PinnedComparable,
  RealPriceFilters,
  RealPriceTransaction,
  TargetPropertyInput,
} from './realPriceRegistration.models'
import {
  buildDealCountSeries,
  buildPriceSeries,
  buildReferenceScatterPoints,
  buildScatterPoints,
  buildTargetPriceRows,
  calculatePercentileStats,
  computePercentDiff,
  createInitialFilters,
  createInitialTargetProperty,
  filterTransactions,
  formatNumber,
  getCommunityCandidates,
  getRemarkCandidates,
  getRoadCandidates,
  markPinnedScatterPoints,
  PINNED_COMPARABLE_LIMIT,
  resolveTargetCompareTotalPrice,
} from './realPriceRegistration.service'
import {
  assertCsvUploadFile,
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
  mainUses: [],
  roadNames: [],
  communityNames: [],
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
/** 可比超過上限時提示 */
const showPinLimitModal = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const scatterMetric = ref<'unitPriceWanPerPing' | 'totalPriceWan'>('unitPriceWanPerPing')

/** 本案對照輸入（session；換資料集清空） */
const targetProperty = reactive<TargetPropertyInput>(createInitialTargetProperty())
/** 可比釘選（session；重整／換資料集清空） */
const pinnedComparables = ref<PinnedComparable[]>([])

/** 路名候選區：勾選後尚未加入「已選路名」的暫存 */
const pendingRoadSelections = ref<string[]>([])
/** 社區候選區：勾選後尚未加入「已選社區」的暫存 */
const pendingCommunitySelections = ref<string[]>([])
/** 備註候選區：勾選後尚未加入「排除集合」的暫存 */
const pendingRemarkSelections = ref<string[]>([])
/** 各區塊是否展開（預設全部展開） */
const sectionStates = reactive({
  filters: true,
  summary: true,
  target: true,
  comps: true,
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

const communityCandidates = computed(() =>
  getCommunityCandidates(activeTransactions.value, filters, filters.selectedCommunityNames),
)

const remarkCandidates = computed(() =>
  getRemarkCandidates(activeTransactions.value, filters.remarkKeyword, filters.selectedRemarkExclusions),
)

const unitPriceSeries = computed(() => buildPriceSeries(filteredTransactions.value, 'unitPriceWanPerPing'))
const totalPriceSeries = computed(() => buildPriceSeries(filteredTransactions.value, 'totalPriceWan'))
const dealCountSeries = computed(() => buildDealCountSeries(filteredTransactions.value))

const scatterDealPoints = computed(() =>
  markPinnedScatterPoints(
    buildScatterPoints(filteredTransactions.value, scatterMetric.value),
    pinnedComparables.value,
  ),
)

const summary = computed(() => {
  const rows = filteredTransactions.value
  return {
    dealCount: rows.length,
    unitPrice: calculatePercentileStats(rows.map((row) => row.unitPriceWanPerPing)),
    totalPrice: calculatePercentileStats(rows.map((row) => row.totalPriceWan)),
  }
})

const targetPriceRows = computed(() =>
  buildTargetPriceRows(targetProperty, summary.value.unitPrice),
)

const referenceScatterPoints = computed(() =>
  buildReferenceScatterPoints(targetPriceRows.value, scatterDealPoints.value, scatterMetric.value),
)

/** 符合條件清單：依西元成交日新到舊 */
const sortedTransactions = computed(() =>
  [...filteredTransactions.value].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)),
)

const targetCompareTotalPrice = computed(() => resolveTargetCompareTotalPrice(targetProperty))
const targetAreaPing = computed(() => {
  const raw = targetProperty.buildingAreaPing.trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
})

/**
 * @description 已釘選可比列（對照 activeTransactions；缺列則略過）
 */
const pinnedComparableRows = computed(() => {
  const byId = new Map(activeTransactions.value.map((row) => [row.id, row]))
  return pinnedComparables.value
    .map((pin) => {
      const row = byId.get(pin.transactionId)
      if (!row) return null
      return {
        pin,
        row,
        totalPriceDiffPct: computePercentDiff(row.totalPriceWan, targetCompareTotalPrice.value),
        areaDiffPct: computePercentDiff(row.buildingAreaPing, targetAreaPing.value),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
})

const pinnedIdSet = computed(() => new Set(pinnedComparables.value.map((item) => item.transactionId)))

/**
 * @description 清空本案與可比（換資料集時呼叫）
 */
function resetTargetAndPins() {
  Object.assign(targetProperty, createInitialTargetProperty())
  pinnedComparables.value = []
}

/**
 * @description 切換目前分析資料集：寫入 active、重建 filterOptions，重設篩選／本案／可比
 * @param next 新的交易列
 * @param sourceLabel 來源顯示名稱（本地檔名或上傳檔名）
 */
function applyActiveDataset(next: RealPriceTransaction[], sourceLabel: string) {
  activeTransactions.value = next
  activeSourceLabel.value = sourceLabel
  filterOptions.value = buildFilterOptionsFromTransactions(next)
  resetFilters()
  resetTargetAndPins()
}

/**
 * @description 若釘選 id 已不在 activeTransactions，自動剔除
 */
watch(
  activeTransactions,
  (rows) => {
    const ids = new Set(rows.map((row) => row.id))
    pinnedComparables.value = pinnedComparables.value.filter((pin) => ids.has(pin.transactionId))
  },
)

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
 * @description 把 pending 社區併入已選社區集合後清空 pending
 */
function addCommunitySelections() {
  for (const value of pendingCommunitySelections.value) {
    if (!filters.selectedCommunityNames.includes(value)) {
      filters.selectedCommunityNames.push(value)
    }
  }
  pendingCommunitySelections.value = []
}

/**
 * @description 一次把目前社區候選全部加入已選社區
 */
function addAllCommunityCandidates() {
  const values = communityCandidates.value.map((item) => item.value)
  pendingCommunitySelections.value = values
  addCommunitySelections()
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
 * @description 從已選集合移除單一項目（路名／社區／備註排除 chip）
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
 * @description 重設所有篩選與候選 pending 狀態（不含本案／可比）
 */
function resetFilters() {
  Object.assign(filters, createInitialFilters())
  pendingRoadSelections.value = []
  pendingCommunitySelections.value = []
  pendingRemarkSelections.value = []
}

/**
 * @description 新增一列出價輸入欄
 */
function addOfferPriceField() {
  targetProperty.offerPricesWan.push('')
}

/**
 * @description 移除指定出價輸入欄（至少保留 1 欄）
 */
function removeOfferPriceField(index: number) {
  if (targetProperty.offerPricesWan.length <= 1) return
  targetProperty.offerPricesWan.splice(index, 1)
}

/**
 * @description 判斷交易是否已釘選為可比
 */
function isPinned(transactionId: string) {
  return pinnedIdSet.value.has(transactionId)
}

/**
 * @description 加入或移除可比；超過上限時顯示提示且不加入
 */
function togglePinnedComparable(transactionId: string) {
  const index = pinnedComparables.value.findIndex((item) => item.transactionId === transactionId)
  if (index >= 0) {
    pinnedComparables.value.splice(index, 1)
    return
  }
  if (pinnedComparables.value.length >= PINNED_COMPARABLE_LIMIT) {
    showPinLimitModal.value = true
    return
  }
  pinnedComparables.value.push({ transactionId, note: '' })
}

/**
 * @description 更新某一可比的註記
 */
function updatePinnedNote(transactionId: string, note: string) {
  const pin = pinnedComparables.value.find((item) => item.transactionId === transactionId)
  if (pin) pin.note = note
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
 * 1. 檔名可任意，但副檔名必須是 `.csv`
 * 2. 內容標題須與本地範本一致（REQUIRED_HEADERS；允許引號內換行）
 * 3. 通過後 parseCsvText → applyActiveDataset(上傳資料, 檔名)
 * 4. 失敗：顯示「不符合格式」；若目前不是本地來源，還原 localTransactions
 */
async function onCsvSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    assertCsvUploadFile(file)
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

/**
 * @description 關閉可比上限提示
 */
function closePinLimitModal() {
  showPinLimitModal.value = false
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
          實價證據引擎：依行政區、路名、社區、型態與價格條件掃描行情，再用本案對照與可比釘選輔助出價判斷。本頁不做自動鑑價或貸款試算。
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
            路名、社區與備註都支援關鍵字搜尋後分批加入集合。
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

          <div class="field field--full">
            <span class="field__label">主要用途</span>
            <p class="field__hint">
              可多選，再次點擊同一項即可取消。
            </p>
            <div class="option-chips">
              <button
                v-for="use in filterOptions.mainUses"
                :key="use"
                type="button"
                class="option-chip"
                :class="{ 'option-chip--active': filters.mainUses.includes(use) }"
                @click="toggleSelectedItem(filters.mainUses, use)"
              >
                {{ use }}
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
            <span class="field__label">有無車位</span>
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

          <label class="field">
            <span class="field__label">有無管理組織</span>
            <select
              v-model="filters.management"
              class="field__control"
            >
              <option value="all">
                不限
              </option>
              <option value="yes">
                有管理組織
              </option>
              <option value="no">
                無管理組織
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
                <h3>社區簡稱多選</h3>
                <p>輸入關鍵字後，選擇符合的社區加入篩選集合。</p>
              </div>
              <div class="search-block__actions">
                <button
                  type="button"
                  class="button button--ghost"
                  @click="addAllCommunityCandidates"
                >
                  全選候選
                </button>
                <button
                  type="button"
                  class="button"
                  @click="addCommunitySelections"
                >
                  加入已選
                </button>
              </div>
            </div>

            <input
              v-model="filters.communityKeyword"
              class="field__control"
              placeholder="例如：時代大廈、凡爾賽"
            >

            <div class="candidate-list">
              <label
                v-for="candidate in communityCandidates"
                :key="candidate.value"
                class="candidate-list__item"
              >
                <input
                  :checked="pendingCommunitySelections.includes(candidate.value)"
                  type="checkbox"
                  @change="togglePendingSelection(pendingCommunitySelections, candidate.value)"
                >
                <span>{{ candidate.value }}</span>
              </label>
              <p
                v-if="filters.communityKeyword && communityCandidates.length === 0"
                class="candidate-list__empty"
              >
                沒有符合的社區候選值。
              </p>
            </div>

            <div class="chips">
              <button
                v-for="communityName in filters.selectedCommunityNames"
                :key="communityName"
                type="button"
                class="chip"
                @click="removeSelectedItem(filters.selectedCommunityNames, communityName)"
              >
                {{ communityName }} ×
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

            <div class="remark-panel">
              <div class="remark-panel__section">
                <p class="remark-panel__label">
                  搜尋結果
                </p>
                <div class="candidate-list candidate-list--remark">
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
                  <p
                    v-else-if="!filters.remarkKeyword"
                    class="candidate-list__empty"
                  >
                    輸入關鍵字後顯示候選備註。
                  </p>
                </div>
              </div>

              <div class="remark-panel__section">
                <p class="remark-panel__label">
                  已排除（{{ filters.selectedRemarkExclusions.length }}）
                </p>
                <div class="chips chips--remark">
                  <button
                    v-for="remark in filters.selectedRemarkExclusions"
                    :key="remark"
                    type="button"
                    class="chip chip--muted"
                    @click="removeSelectedItem(filters.selectedRemarkExclusions, remark)"
                  >
                    {{ remark }} ×
                  </button>
                  <p
                    v-if="filters.selectedRemarkExclusions.length === 0"
                    class="candidate-list__empty"
                  >
                    尚未加入排除項目。
                  </p>
                </div>
              </div>
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
            彙整目前篩選條件下的成交筆數、單價與總價分布。P25／P75 為第 25／75 百分位：約四分之一成交低於 P25、四分之一高於 P75，中間一半大致落在 P25～P75（常見行情帶）。有效樣本少於 5 筆時不顯示分位。
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
                <dt>P25（較低四分位）：</dt>
                <dd>
                  {{ summary.unitPrice.hasPercentiles ? formatNumber(summary.unitPrice.p25, 1) : '樣本不足' }}
                </dd>
              </div>
              <div class="summary-card__row">
                <dt>P75（較高四分位）：</dt>
                <dd>
                  {{ summary.unitPrice.hasPercentiles ? formatNumber(summary.unitPrice.p75, 1) : '樣本不足' }}
                </dd>
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
                <dt>P25（較低四分位）：</dt>
                <dd>
                  {{ summary.totalPrice.hasPercentiles ? formatNumber(summary.totalPrice.p25, 0) : '樣本不足' }}
                </dd>
              </div>
              <div class="summary-card__row">
                <dt>P75（較高四分位）：</dt>
                <dd>
                  {{ summary.totalPrice.hasPercentiles ? formatNumber(summary.totalPrice.p75, 0) : '樣本不足' }}
                </dd>
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
            本案對照
          </h2>
          <p class="panel__hint">
            輸入權狀坪與開價／出價，換算單價並對照目前篩選樣本。落點規則：低於 P25（較低四分位）為「偏買方」，落在 P25～P75 為「合理帶」，高於 P75（較高四分位）為「偏貴」。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.target"
          aria-label="切換本案對照區塊"
          @click="toggleSection('target')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.target }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.target"
        class="panel__content"
      >
        <div class="target-grid">
          <label class="field">
            <span class="field__label">權狀坪數</span>
            <input
              v-model="targetProperty.buildingAreaPing"
              class="field__control"
              inputmode="decimal"
              placeholder="例如：59.15"
            >
          </label>
          <label class="field">
            <span class="field__label">主建物坪（選填）</span>
            <input
              v-model="targetProperty.mainBuildingPing"
              class="field__control"
              inputmode="decimal"
              placeholder="僅顯示，不改行情計算"
            >
          </label>
          <label class="field">
            <span class="field__label">開價（萬元）</span>
            <input
              v-model="targetProperty.listPriceWan"
              class="field__control"
              inputmode="decimal"
              placeholder="選填"
            >
          </label>
        </div>

        <div class="offer-list">
          <div class="offer-list__header">
            <h3 class="offer-list__title">
              出價（萬元）
            </h3>
            <button
              type="button"
              class="button button--ghost"
              @click="addOfferPriceField"
            >
              新增出價
            </button>
          </div>
          <div
            v-for="(_, index) in targetProperty.offerPricesWan"
            :key="`offer-${index}`"
            class="offer-list__row"
          >
            <label class="field field--grow">
              <span class="field__label">出價 {{ index + 1 }}</span>
              <input
                v-model="targetProperty.offerPricesWan[index]"
                class="field__control"
                inputmode="decimal"
                placeholder="不預填"
              >
            </label>
            <button
              type="button"
              class="button button--ghost"
              :disabled="targetProperty.offerPricesWan.length <= 1"
              @click="removeOfferPriceField(index)"
            >
              移除
            </button>
          </div>
        </div>

        <p
          v-if="!summary.unitPrice.hasPercentiles"
          class="notice"
        >
          目前篩選後有效單價少於 5 筆，分位與落點標籤顯示為樣本不足。
        </p>

        <div
          v-if="targetPriceRows.length === 0"
          class="notice"
        >
          請先輸入有效權狀坪，以及開價或至少一檔出價。
        </div>

        <div
          v-else
          class="table-wrap"
        >
          <table class="table table--compact">
            <thead>
              <tr>
                <th>項目</th>
                <th>總價（萬）</th>
                <th>單價（萬／坪）</th>
                <th>相對篩選單價中位</th>
                <th>落點</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in targetPriceRows"
                :key="row.label"
              >
                <td>{{ row.label }}</td>
                <td>{{ formatNumber(row.totalPriceWan, 0) }}</td>
                <td>{{ formatNumber(row.unitPriceWanPerPing, 2) }}</td>
                <td>
                  {{
                    summary.unitPrice.median == null
                      ? '—'
                      : formatNumber(row.unitPriceWanPerPing - summary.unitPrice.median, 2)
                  }}
                </td>
                <td>
                  <span
                    v-if="row.bandLabel"
                    class="band"
                    :class="{
                      'band--buyer': row.bandLabel === '偏買方',
                      'band--fair': row.bandLabel === '合理帶',
                      'band--high': row.bandLabel === '偏貴',
                    }"
                  >{{ row.bandLabel }}</span>
                  <span v-else>樣本不足</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel__header">
        <div>
          <h2 class="panel__title">
            可比案例
          </h2>
          <p class="panel__hint">
            從下方清單釘選可比（最多 {{ PINNED_COMPARABLE_LIMIT }} 筆）。總價差／面積差相對「第一個有效出價，否則開價」。
          </p>
        </div>
        <button
          type="button"
          class="button button--ghost button--icon"
          :aria-expanded="sectionStates.comps"
          aria-label="切換可比案例區塊"
          @click="toggleSection('comps')"
        >
          <span
            class="collapse-icon"
            :class="{ 'collapse-icon--collapsed': !sectionStates.comps }"
            aria-hidden="true"
          >⌃</span>
        </button>
      </div>

      <div
        v-if="sectionStates.comps"
        class="panel__content"
      >
        <div
          v-if="pinnedComparableRows.length === 0"
          class="notice"
        >
          尚未釘選可比。請到下方清單按「加入可比」。
        </div>

        <div
          v-else
          class="table-wrap"
        >
          <table class="table table--compact">
            <thead>
              <tr>
                <th>地址</th>
                <th>社區</th>
                <th>交易日期</th>
                <th>坪數</th>
                <th>總價</th>
                <th>單價</th>
                <th>車位</th>
                <th>總價差％</th>
                <th>面積差％</th>
                <th>註記</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in pinnedComparableRows"
                :key="item.pin.transactionId"
              >
                <td>{{ item.row.fullAddress }}</td>
                <td>{{ item.row.communityName || '—' }}</td>
                <td>{{ item.row.tradeDateRaw }}</td>
                <td>{{ formatNumber(item.row.buildingAreaPing, 2) }}</td>
                <td>{{ formatNumber(item.row.totalPriceWan, 0) }}</td>
                <td>{{ formatNumber(item.row.unitPriceWanPerPing, 2) }}</td>
                <td>{{ item.row.hasParking ? '有' : '無' }}</td>
                <td>{{ item.totalPriceDiffPct == null ? '—' : `${formatNumber(item.totalPriceDiffPct, 1)}%` }}</td>
                <td>{{ item.areaDiffPct == null ? '—' : `${formatNumber(item.areaDiffPct, 1)}%` }}</td>
                <td>
                  <input
                    class="field__control field__control--inline"
                    :value="item.pin.note"
                    placeholder="短註"
                    @input="updatePinnedNote(item.pin.transactionId, ($event.target as HTMLInputElement).value)"
                  >
                </td>
                <td>
                  <button
                    type="button"
                    class="button button--ghost button--small"
                    @click="togglePinnedComparable(item.pin.transactionId)"
                  >
                    移除可比
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
            :points="scatterDealPoints"
            :reference-points="referenceScatterPoints"
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
          本頁是實價證據工具，不是自動鑑價或貸款試算。實價登錄會混入特殊高價案、親友或關係人交易、僅車位交易、附帶增建等樣本，平均數很容易被極端值拉動。中位數較不受極端值影響；P25／P75 是第 25／75 百分位，用來標出常見行情帶（約一半成交落在兩者之間）。本案對照與可比釘選用來整理出價依據。
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
                <th>操作</th>
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
                :class="{ 'table__row--pinned': isPinned(row.id) }"
              >
                <td>
                  <button
                    type="button"
                    class="button button--ghost button--small"
                    @click="togglePinnedComparable(row.id)"
                  >
                    {{ isPinned(row.id) ? '移除可比' : '加入可比' }}
                  </button>
                </td>
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
      v-if="showPinLimitModal"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-limit-title"
    >
      <button
        type="button"
        class="modal__backdrop"
        aria-label="關閉可比上限提示"
        @click="closePinLimitModal"
      />
      <div class="modal__panel">
        <h2
          id="pin-limit-title"
          class="modal__title"
        >
          可比已達上限
        </h2>
        <p class="modal__body">
          最多只能釘選 {{ PINNED_COMPARABLE_LIMIT }} 筆可比案例。請先移除部分可比後再加入。
        </p>
        <button
          type="button"
          class="button"
          @click="closePinLimitModal"
        >
          關閉
        </button>
      </div>
    </div>

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
          請上傳 CSV 檔（檔名可不同）。內容欄位標題需與本地下載範本相同：地段位置或門牌、社區簡稱、交易日期…等 18 欄。分析將繼續使用本地資料。
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

/* 備註排除：搜尋結果與已排除分開，各自獨立高度與捲動，避免疊在一起 */
.remark-panel {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.75rem;
}

.remark-panel__section {
  min-width: 0;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.55);
}

.remark-panel__label {
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-ink-muted);
}

.candidate-list--remark {
  max-height: 10rem;
  margin-top: 0;
}

.chips--remark {
  max-height: 8rem;
  margin-top: 0;
  overflow-y: auto;
  align-content: flex-start;
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

.table--compact {
  min-width: 48rem;
}

.table__row--pinned {
  background: rgba(15, 118, 110, 0.08);
}

.target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
  margin-bottom: 1rem;
}

.offer-list {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.offer-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.offer-list__title {
  margin: 0;
  font-size: 1rem;
}

.offer-list__row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.field--grow {
  flex: 1;
  min-width: 0;
}

.field__control--inline {
  min-width: 8rem;
  width: 100%;
}

.button--small {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  white-space: nowrap;
}

.band {
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.band--buyer {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}

.band--fair {
  background: rgba(180, 83, 9, 0.12);
  color: #b45309;
}

.band--high {
  background: rgba(185, 28, 28, 0.12);
  color: #b91c1c;
}

@media (max-width: 1200px) {
  .page__hero,
  .search-block__header {
    flex-direction: column;
  }

  .filters-grid,
  .target-grid {
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
