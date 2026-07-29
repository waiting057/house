import type {
  CandidateItem,
  MonthlyMetricPoint,
  RealPriceFilters,
  RealPriceTransaction,
  ScatterPoint,
} from './realPriceRegistration.models'

/**
 * @description 建立篩選條件的初始值（全部不限制；車位／管理組織為「不限」）
 */
export function createInitialFilters(): RealPriceFilters {
  return {
    district: '',
    startTradeMonth: '',
    endTradeMonth: '',
    buildingTypes: [],
    mainUses: [],
    selectedRoadNames: [],
    selectedRemarkExclusions: [],
    roadKeyword: '',
    remarkKeyword: '',
    minBuildingAge: '',
    maxBuildingAge: '',
    minArea: '',
    maxArea: '',
    minTotalPrice: '',
    maxTotalPrice: '',
    minUnitPrice: '',
    maxUnitPrice: '',
    parking: 'all',
    management: 'all',
  }
}

/**
 * @description 把篩選輸入框字串轉成 number；空白或非數字回傳 null（代表該端不設限）
 */
function toNumber(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * @description 不區分大小寫的子字串比對（路名／備註關鍵字搜尋用）
 */
function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase())
}

/**
 * @description 判斷數值是否落在字串上下限區間內
 *
 * 規則：
 * 1. min／max 空白視為該端不設限
 * 2. value 為 null 時：只有上下限都未設才通過（缺值不納入有區間的篩選）
 */
function inRange(value: number | null, minRaw: string, maxRaw: string) {
  const min = toNumber(minRaw)
  const max = toNumber(maxRaw)
  if (value == null) return min == null && max == null
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

/**
 * @description 把 CSV「主要用途」正規成篩選用標籤；空白視為「未提供」
 */
function normalizeMainUse(value: string) {
  const trimmed = String(value || '').trim()
  return trimmed || '未提供'
}

/**
 * @description 依目前篩選條件過濾交易列
 *
 * 規則：
 * 1. 行政區／建物型態／主要用途／路名集合：有選才限制
 * 2. 成交年月以 tradeYearMonth 字串比較（YYYY-MM）
 * 3. 備註排除：備註包含任一已選排除字串即剔除
 * 4. 屋齡／面積／總價／單價走區間
 * 5. 有無車位、有無管理組織：yes／no／all（管理組織對應 CSV「有」「無」）
 */
export function filterTransactions(transactions: RealPriceTransaction[], filters: RealPriceFilters) {
  return transactions.filter((row) => {
    if (filters.district && row.district !== filters.district) return false
    if (filters.startTradeMonth && row.tradeYearMonth < filters.startTradeMonth) return false
    if (filters.endTradeMonth && row.tradeYearMonth > filters.endTradeMonth) return false
    if (filters.buildingTypes.length > 0 && !filters.buildingTypes.includes(row.buildingType)) return false
    if (
      filters.mainUses.length > 0 &&
      !filters.mainUses.includes(normalizeMainUse(row.mainUse))
    ) {
      return false
    }
    if (filters.selectedRoadNames.length > 0 && !filters.selectedRoadNames.includes(row.roadName || '')) return false
    if (
      filters.selectedRemarkExclusions.length > 0 &&
      filters.selectedRemarkExclusions.some((remark) => row.remark.includes(remark))
    ) {
      return false
    }

    if (!inRange(row.buildingAgeYears, filters.minBuildingAge, filters.maxBuildingAge)) return false
    if (!inRange(row.buildingAreaPing, filters.minArea, filters.maxArea)) return false
    if (!inRange(row.totalPriceWan, filters.minTotalPrice, filters.maxTotalPrice)) return false
    if (!inRange(row.unitPriceWanPerPing, filters.minUnitPrice, filters.maxUnitPrice)) return false

    if (filters.parking === 'yes' && !row.hasParking) return false
    if (filters.parking === 'no' && row.hasParking) return false

    if (filters.management === 'yes' && row.hasManagement !== '有') return false
    if (filters.management === 'no' && row.hasManagement !== '無') return false

    return true
  })
}

/**
 * @description 依路名關鍵字產生候選清單（需先輸入關鍵字才顯示，避免一次展開全部路名）
 *
 * 規則：
 * 1. 關鍵字空白 → 回傳空陣列
 * 2. 若已選行政區，只從該區交易列收集路名
 * 3. 結果去重、繁中排序，並標示是否已在已選路名集合中
 */
export function getRoadCandidates(
  transactions: RealPriceTransaction[],
  filters: RealPriceFilters,
  selectedRoadNames: string[],
) {
  const keyword = filters.roadKeyword.trim()
  if (!keyword) return [] as CandidateItem[]

  const roadNames = [...new Set(
    transactions
      .filter((row) => !filters.district || row.district === filters.district)
      .map((row) => row.roadName)
      .filter((value): value is string => Boolean(value))
      .filter((value) => includesIgnoreCase(value, keyword)),
  )]

  return roadNames
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
    .map((value) => ({ value, selected: selectedRoadNames.includes(value) }))
}

/**
 * @description 依備註關鍵字產生「排除用」候選清單
 *
 * 規則：
 * 1. 關鍵字空白 → 回傳空陣列
 * 2. 從全部交易備註收集含關鍵字的完整字串後去重排序
 * 3. selected 表示是否已在排除集合中
 */
export function getRemarkCandidates(
  transactions: RealPriceTransaction[],
  keyword: string,
  selectedRemarkExclusions: string[],
) {
  const search = keyword.trim()
  if (!search) return [] as CandidateItem[]

  const remarkValues = [...new Set(
    transactions
      .map((row) => row.remark)
      .filter((value) => value && includesIgnoreCase(value, search)),
  )]

  return remarkValues
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
    .map((value) => ({ value, selected: selectedRemarkExclusions.includes(value) }))
}

/**
 * @description 計算中位數；偶數筆取中間兩值平均，結果固定兩位小數；空陣列回傳 null
 */
function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2))
  }
  return Number(sorted[middle].toFixed(2))
}

/**
 * @description 計算算術平均，結果固定兩位小數；空陣列回傳 null
 */
function average(values: number[]) {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(2))
}

/**
 * @description 依成交年月分桶，並依年月舊到新排序（供折線圖 X 軸由左到右）
 */
function aggregateByMonth(transactions: RealPriceTransaction[]) {
  const bucketMap = new Map<string, RealPriceTransaction[]>()

  for (const row of transactions) {
    const key = row.tradeYearMonth
    if (!bucketMap.has(key)) {
      bucketMap.set(key, [])
    }
    bucketMap.get(key)?.push(row)
  }

  return [...bucketMap.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/**
 * @description 建立單價或總價折線資料：主線為每月中位數、輔線為每月平均
 * @param metric `unitPriceWanPerPing` 或 `totalPriceWan`
 */
export function buildPriceSeries(
  transactions: RealPriceTransaction[],
  metric: 'unitPriceWanPerPing' | 'totalPriceWan',
) {
  return aggregateByMonth(transactions).map(([label, rows]) => {
    const values = rows
      .map((row) => row[metric])
      .filter((value): value is number => typeof value === 'number')
    return {
      label,
      primary: median(values),
      secondary: average(values),
      dealCount: rows.length,
    } satisfies MonthlyMetricPoint
  })
}

/**
 * @description 建立每月成交筆數折線資料（primary 即該月筆數）
 */
export function buildDealCountSeries(transactions: RealPriceTransaction[]) {
  return aggregateByMonth(transactions).map(([label, rows]) => ({
    label,
    primary: rows.length,
    dealCount: rows.length,
  }))
}

/**
 * @description 建立散點圖資料點（每筆成交一點），依成交時間由舊到新排序
 *
 * 規則：
 * 1. 缺成交日或目標指標為 null 的列略過
 * 2. xValue 用 Date.parse(tradeDate) 作為座標
 * 3. meta 供滑鼠提示顯示日期｜行政區｜地址
 */
export function buildScatterPoints(
  transactions: RealPriceTransaction[],
  metric: 'unitPriceWanPerPing' | 'totalPriceWan',
): ScatterPoint[] {
  return transactions
    .filter((row) => row.tradeDate && row[metric] != null)
    .map((row) => ({
      id: row.id,
      xLabel: row.tradeDate,
      xValue: Date.parse(row.tradeDate),
      yValue: row[metric] as number,
      meta: `${row.tradeDate}｜${row.district}｜${row.fullAddress}`,
    }))
    .sort((a, b) => a.xValue - b.xValue)
}

/**
 * @description 把可空數值格式化成繁中數字字串；null 顯示為「—」
 * @param digits 小數位數（預設 1）
 */
export function formatNumber(value: number | null, digits = 1) {
  if (value == null) return '—'
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}
