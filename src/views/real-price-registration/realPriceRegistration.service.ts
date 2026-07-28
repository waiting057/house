import type {
  CandidateItem,
  MonthlyMetricPoint,
  RealPriceFilters,
  RealPriceTransaction,
  ScatterPoint,
} from './realPriceRegistration.models'

export function createInitialFilters(): RealPriceFilters {
  return {
    district: '',
    startTradeMonth: '',
    endTradeMonth: '',
    buildingTypes: [],
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
  }
}

function toNumber(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase())
}

function inRange(value: number | null, minRaw: string, maxRaw: string) {
  const min = toNumber(minRaw)
  const max = toNumber(maxRaw)
  if (value == null) return min == null && max == null
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

export function filterTransactions(transactions: RealPriceTransaction[], filters: RealPriceFilters) {
  return transactions.filter((row) => {
    if (filters.district && row.district !== filters.district) return false
    if (filters.startTradeMonth && row.tradeYearMonth < filters.startTradeMonth) return false
    if (filters.endTradeMonth && row.tradeYearMonth > filters.endTradeMonth) return false
    if (filters.buildingTypes.length > 0 && !filters.buildingTypes.includes(row.buildingType)) return false
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

    return true
  })
}

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

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2))
  }
  return Number(sorted[middle].toFixed(2))
}

function average(values: number[]) {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(2))
}

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

export function buildDealCountSeries(transactions: RealPriceTransaction[]) {
  return aggregateByMonth(transactions).map(([label, rows]) => ({
    label,
    primary: rows.length,
    dealCount: rows.length,
  }))
}

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

export function formatNumber(value: number | null, digits = 1) {
  if (value == null) return '—'
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}
