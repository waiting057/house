import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const outputDir = path.join(projectRoot, 'public/data/real-price-registration')
const execFile = promisify(execFileCallback)

const MOI_DATASET_API = 'https://data.gov.tw/api/v2/rest/dataset/77051'
const TARGET_MANIFEST_NAME = 'a_lvr_land_a.csv'
const PING_IN_SQUARE_METER = 3.305785

function parseCsvRows(csvText) {
  const records = parse(csvText, {
    skip_empty_lines: true,
  })

  const [rawHeaders, , ...rows] = records
  const headers = rawHeaders.map((header) => String(header).replace(/^\uFEFF/, ''))
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])),
  )
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const normalized = String(value).replaceAll(',', '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseRocDate(raw) {
  if (!raw) return null
  const value = String(raw).trim()
  if (!/^\d{6,7}$/.test(value)) return null

  const rocYear = Number(value.slice(0, value.length - 4))
  const month = Number(value.slice(-4, -2))
  const day = Number(value.slice(-2))
  const year = rocYear + 1911

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date) {
  return date ? date.toISOString().slice(0, 10) : null
}

function formatYearMonth(date) {
  return date ? date.toISOString().slice(0, 7) : null
}

function convertSquareMeterToPing(squareMeter) {
  if (squareMeter == null || squareMeter <= 0) return null
  return Number((squareMeter / PING_IN_SQUARE_METER).toFixed(2))
}

function convertNtdToWan(value) {
  if (value == null || value <= 0) return null
  return Number((value / 10000).toFixed(2))
}

function convertUnitPriceToWanPerPing(value) {
  if (value == null || value <= 0) return null
  return Number(((value * PING_IN_SQUARE_METER) / 10000).toFixed(2))
}

function computeBuildingAgeYears(tradeDate, completionDate) {
  if (!tradeDate || !completionDate) return null
  const diffMs = tradeDate.getTime() - completionDate.getTime()
  if (diffMs < 0) return null
  const years = diffMs / (365.25 * 24 * 60 * 60 * 1000)
  return Number(years.toFixed(1))
}

function extractRoadName(rawAddress) {
  const address = String(rawAddress || '').trim()
  if (!address) return null

  const cleaned = address
    .replace(/^臺北市/, '')
    .replace(/^台北市/, '')
    .replace(/^[\u4e00-\u9fa5]{2,3}區/, '')

  const match = cleaned.match(/^(.*?(?:路|街|大道)(?:[一二三四五六七八九十百甲乙丙丁\d]+段)?)/)
  return match ? match[1] : cleaned
}

function hasParking(row) {
  if (String(row['交易筆棟數'] || '').includes('車位')) return true
  if (String(row['車位類別'] || '').trim()) return true
  const parkingPrice = parseNumber(row['車位總價元'])
  return parkingPrice != null && parkingPrice > 0
}

function normalizeBuildingType(value) {
  return String(value || '').trim() || '未提供'
}

function normalizeRemark(value) {
  return String(value || '').trim()
}

function isTargetTransaction(row) {
  const target = String(row['交易標的'] || '').trim()
  if (!target) return false

  // 只保留房屋相關買賣，排除純土地與純車位交易，避免混入不適合作住宅行情分析的資料。
  return target.includes('建物') || target.includes('房地')
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2))
  }
  return Number(sorted[middle].toFixed(2))
}

function average(values) {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(2))
}

async function fetchDatasetDownloadUrl() {
  const response = await fetch(MOI_DATASET_API)
  if (!response.ok) {
    throw new Error(`Failed to fetch MOI dataset metadata: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const distributions = payload?.result?.distribution || []
  const csvDistribution = distributions.find((item) => item.resourceDownloadUrl?.includes('lvr_landcsv.zip'))
  const url = csvDistribution?.resourceDownloadUrl

  if (!url) {
    throw new Error('Unable to locate MOI CSV batch download URL from dataset metadata.')
  }

  return url
}

async function downloadZipFile(zipUrl) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'house-moi-'))
  const zipPath = path.join(tempDir, 'lvr_landcsv.zip')

  try {
    const response = await fetch(zipUrl)
    if (!response.ok) {
      throw new Error(`Failed to download MOI CSV zip: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(zipPath, buffer)
    return { tempDir, zipPath }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw error
  }
}

async function readTargetCsv(zipPath) {
  // 直接從 zip 串流讀目標 CSV，避免把整包完整解壓到工作目錄。
  const { stdout } = await execFile('unzip', ['-p', zipPath, TARGET_MANIFEST_NAME], {
    maxBuffer: 1024 * 1024 * 50,
  })
  return parseCsvRows(stdout)
}

function normalizeRows(rows) {
  const transactions = rows
    .filter(isTargetTransaction)
    .map((row) => {
      const tradeDate = parseRocDate(row['交易年月日'])
      const completionDate = parseRocDate(row['建築完成年月'])
      const totalPriceWan = convertNtdToWan(parseNumber(row['總價元']))
      const unitPriceWanPerPing = convertUnitPriceToWanPerPing(parseNumber(row['單價元平方公尺']))
      const buildingAreaPing = convertSquareMeterToPing(parseNumber(row['建物移轉總面積平方公尺']))
      const remark = normalizeRemark(row['備註'])
      const district = String(row['鄉鎮市區'] || '').trim() || '未提供'
      const fullAddress = String(row['土地位置建物門牌'] || '').trim()
      const roadName = extractRoadName(fullAddress)

      return {
        id: [
          formatDate(tradeDate) || 'unknown-date',
          district,
          roadName || 'unknown-road',
          totalPriceWan ?? 'na',
          unitPriceWanPerPing ?? 'na',
        ].join('-'),
        city: '台北市',
        district,
        roadName,
        fullAddress,
        buildingType: normalizeBuildingType(row['建物型態']),
        tradeDate: formatDate(tradeDate),
        tradeYearMonth: formatYearMonth(tradeDate),
        buildingCompletionDate: formatDate(completionDate),
        buildingAgeYears: computeBuildingAgeYears(tradeDate, completionDate),
        buildingAreaPing,
        totalPriceWan,
        unitPriceWanPerPing,
        hasParking: hasParking(row),
        parkingType: String(row['車位類別'] || '').trim() || null,
        remark,
      }
    })
    .filter((transaction) => {
      return (
        transaction.tradeDate &&
        transaction.tradeYearMonth &&
        transaction.fullAddress &&
        transaction.roadName &&
        transaction.buildingAreaPing != null &&
        transaction.buildingAreaPing > 0 &&
        transaction.totalPriceWan != null &&
        transaction.totalPriceWan > 0 &&
        transaction.unitPriceWanPerPing != null &&
        transaction.unitPriceWanPerPing > 0 &&
        transaction.buildingType !== '未提供'
      )
    })
    .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))

  return transactions
}

function buildMonthlySummary(transactions) {
  const monthMap = new Map()

  for (const row of transactions) {
    const key = row.tradeYearMonth
    if (!key) continue
    if (!monthMap.has(key)) {
      const [year, month] = key.split('-').map(Number)
      monthMap.set(key, {
        year,
        month,
        city: '台北市',
        district: null,
        dealCount: 0,
        unitPrices: [],
        totalPrices: [],
      })
    }

    const bucket = monthMap.get(key)
    bucket.dealCount += 1
    bucket.unitPrices.push(row.unitPriceWanPerPing)
    bucket.totalPrices.push(row.totalPriceWan)
  }

  return [...monthMap.values()]
    .sort((a, b) => {
      const aKey = `${a.year}-${String(a.month).padStart(2, '0')}`
      const bKey = `${b.year}-${String(b.month).padStart(2, '0')}`
      return aKey.localeCompare(bKey)
    })
    .map((bucket) => ({
      year: bucket.year,
      month: bucket.month,
      city: bucket.city,
      district: bucket.district,
      dealCount: bucket.dealCount,
      unitPriceAvg: average(bucket.unitPrices),
      unitPriceMedian: median(bucket.unitPrices),
      totalPriceAvg: average(bucket.totalPrices),
      totalPriceMedian: median(bucket.totalPrices),
    }))
}

function buildFilterOptions(transactions) {
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'))

  return {
    districts: unique(transactions.map((row) => row.district)),
    buildingTypes: unique(transactions.map((row) => row.buildingType)),
    roadNames: unique(transactions.map((row) => row.roadName)),
    remarkValues: unique(transactions.map((row) => row.remark)),
  }
}

function buildManifest(transactions, monthlySummary) {
  const years = uniqueYears(transactions)
  return {
    generatedAt: new Date().toISOString(),
    source: 'MOI Real Estate Actual Transaction Batch Data',
    sourceUrl: 'https://plvr.land.moi.gov.tw/DownloadOpenData',
    periods: monthlySummary.map((item) => `${item.year}-${String(item.month).padStart(2, '0')}`),
    scope: {
      cities: ['台北市'],
      transactionType: '買賣',
      years,
    },
    records: {
      transactions: transactions.length,
      months: monthlySummary.length,
    },
    loadingStrategy: 'single-file',
    files: ['transactions.json', 'monthly-summary.json', 'filter-options.json'],
    note: '單價與總價單位皆為萬元；單價單位為萬元/坪。',
  }
}

function uniqueYears(transactions) {
  return [...new Set(transactions.map((row) => Number(row.tradeDate?.slice(0, 4))).filter(Boolean))].sort((a, b) => a - b)
}

async function writeJson(filename, payload) {
  const filePath = path.join(outputDir, filename)
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const zipUrl = await fetchDatasetDownloadUrl()
  const { tempDir, zipPath } = await downloadZipFile(zipUrl)

  try {
    const rows = await readTargetCsv(zipPath)
    const transactions = normalizeRows(rows)
    const monthlySummary = buildMonthlySummary(transactions)
    const filterOptions = buildFilterOptions(transactions)
    const manifest = buildManifest(transactions, monthlySummary)

    await writeJson('transactions.json', transactions)
    await writeJson('monthly-summary.json', monthlySummary)
    await writeJson('filter-options.json', filterOptions)
    await writeJson('manifest.json', manifest)

    console.log(
      JSON.stringify(
        {
          sourceZip: zipUrl,
          fetchedRows: rows.length,
          transactionRows: transactions.length,
          months: monthlySummary.length,
        },
        null,
        2,
      ),
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
