import Papa from 'papaparse'
import type { FilterOptionsPayload, RealPriceTransaction } from './realPriceRegistration.models'

/**
 * @description 本地 CSV 與上傳檔必須具備的標題（正規化後比對；順序也必須一致）
 */
export const REQUIRED_HEADERS = [
  '地段位置或門牌',
  '社區簡稱',
  '交易日期',
  '總價(萬元)',
  '單價(萬元/坪)',
  '總面積(坪)',
  '主建物佔比',
  '型態',
  '屋齡',
  '樓別/樓高',
  '交易標的',
  '交易筆棟數',
  '建物現況格局',
  '車位總價(萬元)',
  '管理組織',
  '電梯',
  '主要用途',
  '備註',
] as const

/**
 * @description 本地預設 CSV 檔名（進頁載入與「下載」按鈕共用）
 */
export const LOCAL_CSV_FILENAME = '士林區實價登錄.csv'

/**
 * @description CSV 標題不符、非 CSV 副檔名、或解析後無有效列時拋出，供 UI 顯示「不符合格式」
 */
export class CsvFormatError extends Error {
  constructor(message = '不符合格式') {
    super(message)
    this.name = 'CsvFormatError'
  }
}

/**
 * @description 判斷檔名是否為 CSV（只看副檔名；主檔名可任意，不必與本地預設檔同名）
 *
 * 規則：
 * 1. 副檔名必須是 `.csv`（不分大小寫）
 * 2. 檔名本體不檢查，例如 `北投區.csv`、`export.csv` 皆可
 */
export function isCsvFileName(fileName: string) {
  return /\.csv$/i.test(String(fileName || '').trim())
}

/**
 * @description 上傳前檢查：必須是 CSV 檔（檔名不需與本地相同）
 * @throws {CsvFormatError} 副檔名不是 .csv
 */
export function assertCsvUploadFile(file: File) {
  if (!isCsvFileName(file.name)) {
    throw new CsvFormatError()
  }
}

/**
 * @description 正規化 CSV 表頭文字，讓引號內換行或多餘空白仍能對齊契約
 *
 * 規則：
 * 1. 去掉 BOM
 * 2. 去掉換行
 * 3. 去掉所有空白後再 trim
 */
export function normalizeHeader(text: string) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\r\n]+/g, '')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * @description 驗證表頭是否與 REQUIRED_HEADERS 完全一致（正規化後、含順序）
 * @returns 通過為 true；欄位數或任一欄名不符為 false
 */
export function validateHeaders(headers: string[]) {
  const normalized = headers.map(normalizeHeader).filter(Boolean)
  if (normalized.length !== REQUIRED_HEADERS.length) {
    return false
  }
  return REQUIRED_HEADERS.every((header, index) => normalized[index] === header)
}

/**
 * @description 把可能含千分位逗號的字串轉成 number；空值或非數字回傳 null
 */
function parseNumber(value: string) {
  if (!value || !String(value).trim()) return null
  const parsed = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * @description 解析實價登錄常見的民國日期（例如 115/06/11）為西元日期
 *
 * 規則：
 * 1. 僅接受 `yyy/mm/dd` 或 `yy/mm/dd`
 * 2. 西元年 = 民國年 + 1911
 * 3. 月份／日期不合理時回傳 null
 *
 * @returns `{ tradeDate: YYYY-MM-DD, tradeYearMonth: YYYY-MM }`；無法解析則 null
 */
function parseRocTradeDate(raw: string) {
  const value = String(raw || '').trim()
  const match = value.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const rocYear = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const year = rocYear + 1911
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    tradeDate: iso,
    tradeYearMonth: iso.slice(0, 7),
  }
}

/**
 * @description 自門牌開頭擷取行政區（如「士林區」）；找不到時回傳「未提供」
 */
function extractDistrict(address: string) {
  const match = String(address || '').match(/^([\u4e00-\u9fa5]{2,3}區)/)
  return match ? match[1] : '未提供'
}

/**
 * @description 自門牌擷取路名（去掉行政區後，取到「路／街／大道」及可選段別）
 *
 * 規則：
 * 1. 先去掉開頭「○○區」
 * 2. 優先匹配「…路／街／大道」＋可選段別
 * 3. 匹配不到則回傳去掉行政區後的剩餘字串；空門牌回傳 null
 */
function extractRoadName(address: string) {
  const value = String(address || '').trim()
  if (!value) return null

  const withoutDistrict = value.replace(/^[\u4e00-\u9fa5]{2,3}區/, '')
  const match = withoutDistrict.match(/^(.*?(?:路|街|大道)(?:[一二三四五六七八九十百甲乙丙丁\d]+段)?)/)
  return match ? match[1] : withoutDistrict || null
}

/**
 * @description 判斷該筆交易是否含車位
 *
 * 規則（任一成立即為有車位）：
 * 1. 交易標的含「車位」
 * 2. 交易筆棟數出現 `車:N` 且 N > 0
 * 3. 車位總價可解析且 > 0
 */
function detectHasParking(row: {
  transactionTarget: string
  transactionUnits: string
  parkingPriceWanRaw: string
}) {
  if (String(row.transactionTarget || '').includes('車位')) return true

  const units = String(row.transactionUnits || '')
  const parkingMatch = units.match(/車\s*:\s*(\d+)/)
  if (parkingMatch && Number(parkingMatch[1]) > 0) return true

  const parkingPrice = parseNumber(row.parkingPriceWanRaw)
  return parkingPrice != null && parkingPrice > 0
}

/**
 * @description 依正規化後的標題名稱，從 papaparse 列物件取出欄位值（相容表頭含換行）
 */
function getField(row: Record<string, string>, header: string) {
  const target = normalizeHeader(header)
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === target) {
      return String(value ?? '').trim()
    }
  }
  return ''
}

/**
 * @description 把單一 CSV 列轉成 RealPriceTransaction；缺門牌或日期無法解析時略過該列
 * @param row papaparse 產出的欄位 map
 * @param index 原始列索引（用於組成穩定 id）
 */
function mapRow(row: Record<string, string>, index: number): RealPriceTransaction | null {
  const address = getField(row, '地段位置或門牌')
  const tradeDateRaw = getField(row, '交易日期')
  const parsedDate = parseRocTradeDate(tradeDateRaw)
  if (!address || !parsedDate) return null

  const buildingType = getField(row, '型態') || '未提供'
  const transactionTarget = getField(row, '交易標的')
  const transactionUnits = getField(row, '交易筆棟數')
  const parkingPriceWanRaw = getField(row, '車位總價(萬元)')
  const remark = getField(row, '備註')
  const totalPriceWan = parseNumber(getField(row, '總價(萬元)'))
  const unitPriceWanPerPing = parseNumber(getField(row, '單價(萬元/坪)'))
  const buildingAreaPing = parseNumber(getField(row, '總面積(坪)'))
  const buildingAgeYears = parseNumber(getField(row, '屋齡'))
  const district = extractDistrict(address)
  const roadName = extractRoadName(address)

  return {
    id: [
      parsedDate.tradeDate,
      district,
      roadName || 'unknown-road',
      totalPriceWan ?? 'na',
      unitPriceWanPerPing ?? 'na',
      index,
    ].join('-'),
    city: '台北市',
    district,
    roadName,
    fullAddress: address,
    buildingType,
    tradeDate: parsedDate.tradeDate,
    tradeYearMonth: parsedDate.tradeYearMonth,
    buildingCompletionDate: null,
    buildingAgeYears,
    buildingAreaPing,
    totalPriceWan,
    unitPriceWanPerPing,
    hasParking: detectHasParking({
      transactionTarget,
      transactionUnits,
      parkingPriceWanRaw,
    }),
    parkingType: null,
    remark,
    address,
    communityName: getField(row, '社區簡稱'),
    tradeDateRaw,
    totalPriceWanRaw: getField(row, '總價(萬元)'),
    unitPriceWanPerPingRaw: getField(row, '單價(萬元/坪)'),
    buildingAreaPingRaw: getField(row, '總面積(坪)'),
    mainBuildingRatio: getField(row, '主建物佔比'),
    buildingAgeRaw: getField(row, '屋齡'),
    floorInfo: getField(row, '樓別/樓高'),
    transactionTarget,
    transactionUnits,
    layout: getField(row, '建物現況格局'),
    parkingPriceWanRaw,
    hasManagement: getField(row, '管理組織'),
    hasElevator: getField(row, '電梯'),
    mainUse: getField(row, '主要用途'),
  }
}

/**
 * @description 解析 CSV 文字為分析用交易列，並依西元成交日新到舊排序
 *
 * 規則：
 * 1. 先用 papaparse 讀表頭與資料列
 * 2. 表頭正規化後須與 REQUIRED_HEADERS 一致（對齊本地「士林區實價登錄.csv」標題；
 *    允許引號內換行，如「單價(萬元/坪)」）
 * 3. 無法映射的列略過；若最後有效列為 0 也拋 CsvFormatError
 * 4. 不檢查檔名是否與本地預設檔相同
 *
 * @throws {CsvFormatError} 標題不符或沒有任何有效交易列
 */
export function parseCsvText(csvText: string): RealPriceTransaction[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const fields = parsed.meta.fields
  if (!fields || !validateHeaders(fields)) {
    throw new CsvFormatError()
  }

  const transactions = parsed.data
    .map((row, index) => mapRow(row, index))
    .filter((row): row is RealPriceTransaction => row != null)
    .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))

  if (transactions.length === 0) {
    throw new CsvFormatError()
  }

  return transactions
}

/**
 * @description 從目前交易資料重建篩選候選（行政區、型態、主要用途、路名、備註），並以繁中排序
 */
export function buildFilterOptionsFromTransactions(
  transactions: RealPriceTransaction[],
): FilterOptionsPayload {
  const unique = (values: Array<string | null | undefined>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    )

  return {
    districts: unique(transactions.map((row) => row.district)),
    buildingTypes: unique(transactions.map((row) => row.buildingType)),
    mainUses: unique(
      transactions.map((row) => {
        const trimmed = String(row.mainUse || '').trim()
        return trimmed || '未提供'
      }),
    ),
    roadNames: unique(transactions.map((row) => row.roadName)),
    communityNames: unique(transactions.map((row) => row.communityName.trim()).filter(Boolean)),
    remarkValues: unique(transactions.map((row) => row.remark)),
  }
}
