export interface RealPriceTransaction {
  id: string
  city: string
  district: string
  roadName: string | null
  fullAddress: string
  buildingType: string
  tradeDate: string
  tradeYearMonth: string
  buildingCompletionDate: string | null
  buildingAgeYears: number | null
  buildingAreaPing: number | null
  totalPriceWan: number | null
  unitPriceWanPerPing: number | null
  hasParking: boolean
  parkingType: string | null
  remark: string
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
