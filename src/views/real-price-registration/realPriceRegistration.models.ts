/** CSV 原始欄位（清單顯示用，標題與本地檔一致） */
export interface RealPriceCsvRow {
  address: string
  communityName: string
  tradeDateRaw: string
  totalPriceWanRaw: string
  unitPriceWanPerPingRaw: string
  buildingAreaPingRaw: string
  mainBuildingRatio: string
  buildingType: string
  buildingAgeRaw: string
  floorInfo: string
  transactionTarget: string
  transactionUnits: string
  layout: string
  parkingPriceWanRaw: string
  hasManagement: string
  hasElevator: string
  mainUse: string
  remark: string
}

/**
 * 分析用交易列：保留 CSV 原始欄位供清單顯示，
 * 同時提供篩選／圖表所需的正規化衍生欄位。
 */
export interface RealPriceTransaction extends RealPriceCsvRow {
  id: string
  city: string
  district: string
  roadName: string | null
  fullAddress: string
  tradeDate: string
  tradeYearMonth: string
  buildingCompletionDate: string | null
  buildingAgeYears: number | null
  buildingAreaPing: number | null
  totalPriceWan: number | null
  unitPriceWanPerPing: number | null
  hasParking: boolean
  parkingType: string | null
}

export interface RealPriceManifest {
  generatedAt: string | null
  source: string
  sourceUrl?: string
  periods: string[]
  scope: {
    cities: string[]
    transactionType: string
    years: number[]
  }
  records?: {
    transactions: number
    months: number
  }
  loadingStrategy?: 'single-file' | 'chunked'
  files: string[]
  note?: string
}

export interface FilterOptionsPayload {
  districts: string[]
  buildingTypes: string[]
  roadNames: string[]
  remarkValues: string[]
}

export interface RealPriceFilters {
  district: string
  startTradeMonth: string
  endTradeMonth: string
  buildingTypes: string[]
  selectedRoadNames: string[]
  selectedRemarkExclusions: string[]
  roadKeyword: string
  remarkKeyword: string
  minBuildingAge: string
  maxBuildingAge: string
  minArea: string
  maxArea: string
  minTotalPrice: string
  maxTotalPrice: string
  minUnitPrice: string
  maxUnitPrice: string
  parking: 'all' | 'yes' | 'no'
}

export interface MonthlyMetricPoint {
  label: string
  primary: number | null
  secondary?: number | null
  dealCount: number
}

export interface CandidateItem {
  value: string
  selected: boolean
}

export interface ScatterPoint {
  id: string
  xLabel: string
  xValue: number
  yValue: number
  meta: string
}
