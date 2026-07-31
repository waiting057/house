/**
 * @description CSV 原始欄位（清單顯示用），標題順序與本地／上傳檔契約一致
 * @property {string} address 地段位置或門牌
 * @property {string} communityName 社區簡稱
 * @property {string} tradeDateRaw 交易日期原始字串（民國，如 115/06/11）
 * @property {string} totalPriceWanRaw 總價（萬元）原始字串
 * @property {string} unitPriceWanPerPingRaw 單價（萬元/坪）原始字串
 * @property {string} buildingAreaPingRaw 總面積（坪）原始字串
 * @property {string} mainBuildingRatio 主建物佔比
 * @property {string} buildingType 建物型態
 * @property {string} buildingAgeRaw 屋齡原始字串
 * @property {string} floorInfo 樓別／樓高
 * @property {string} transactionTarget 交易標的
 * @property {string} transactionUnits 交易筆棟數
 * @property {string} layout 建物現況格局
 * @property {string} parkingPriceWanRaw 車位總價（萬元）原始字串
 * @property {string} hasManagement 管理組織
 * @property {string} hasElevator 電梯
 * @property {string} mainUse 主要用途
 * @property {string} remark 備註
 */
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
 * @description 分析用交易列：在 CSV 原始欄位之上，加上篩選／圖表所需的正規化衍生欄位
 * @property {string} id 前端列識別（由日期、行政區、路名、價格與列索引組成）
 * @property {string} city 城市（目前固定台北市）
 * @property {string} district 行政區（自門牌解析）
 * @property {string | null} roadName 標準化路名（自門牌解析；解析不到為 null）
 * @property {string} fullAddress 完整門牌（等同 address）
 * @property {string} tradeDate 西元成交日 YYYY-MM-DD（供排序）
 * @property {string} tradeYearMonth 西元成交年月 YYYY-MM（供月份篩選與折線圖）
 * @property {string | null} buildingCompletionDate 建築完成日（CSV 無此欄時為 null）
 * @property {number | null} buildingAgeYears 屋齡（年）
 * @property {number | null} buildingAreaPing 總面積（坪）
 * @property {number | null} totalPriceWan 總價（萬元）
 * @property {number | null} unitPriceWanPerPing 單價（萬元/坪）
 * @property {boolean} hasParking 是否含車位
 * @property {string | null} parkingType 車位類型（CSV 無對應欄時為 null）
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

/**
 * @description 篩選下拉／候選集合的選項來源（由目前 active 交易資料重建）
 * @property {string[]} districts 行政區清單
 * @property {string[]} buildingTypes 建物型態清單
 * @property {string[]} mainUses 主要用途清單
 * @property {string[]} roadNames 路名清單
 * @property {string[]} communityNames 社區簡稱清單（非空白去重）
 * @property {string[]} remarkValues 備註完整字串清單
 */
export interface FilterOptionsPayload {
  districts: string[]
  buildingTypes: string[]
  mainUses: string[]
  roadNames: string[]
  communityNames: string[]
  remarkValues: string[]
}

/**
 * @description 分析頁目前套用的篩選條件；空字串或空陣列代表該條件不限制
 * @property {string} district 行政區（單選；空字串＝全部）
 * @property {string} startTradeMonth 成交年月起（YYYY-MM）
 * @property {string} endTradeMonth 成交年月迄（YYYY-MM）
 * @property {string[]} buildingTypes 已選建物型態（多選；空＝不限）
 * @property {string[]} mainUses 已選主要用途（多選；空＝不限）
 * @property {string[]} selectedRoadNames 已選路名集合（有值時只保留符合者）
 * @property {string[]} selectedCommunityNames 已選社區簡稱集合（有值時只保留符合者）
 * @property {string[]} selectedRemarkExclusions 備註排除集合（備註包含任一字串則剔除）
 * @property {string} roadKeyword 路名搜尋關鍵字（用來產生候選，不直接過濾清單）
 * @property {string} communityKeyword 社區簡稱搜尋關鍵字（用來產生候選，不直接過濾清單）
 * @property {string} remarkKeyword 備註搜尋關鍵字（用來產生排除候選）
 * @property {string} minBuildingAge 屋齡下限
 * @property {string} maxBuildingAge 屋齡上限
 * @property {string} minArea 總面積（坪）下限
 * @property {string} maxArea 總面積（坪）上限
 * @property {string} minTotalPrice 總價（萬元）下限
 * @property {string} maxTotalPrice 總價（萬元）上限
 * @property {string} minUnitPrice 單價（萬元/坪）下限
 * @property {string} maxUnitPrice 單價（萬元/坪）上限
 * @property {'all' | 'yes' | 'no'} parking 有無車位：不限／有／無
 * @property {'all' | 'yes' | 'no'} management 有無管理組織：不限／有／無（對應 CSV「有」「無」）
 */
export interface RealPriceFilters {
  district: string
  startTradeMonth: string
  endTradeMonth: string
  buildingTypes: string[]
  mainUses: string[]
  selectedRoadNames: string[]
  selectedCommunityNames: string[]
  selectedRemarkExclusions: string[]
  roadKeyword: string
  communityKeyword: string
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
  management: 'all' | 'yes' | 'no'
}

/**
 * @description 本案對照輸入（session 記憶體；換資料集時清空）
 * @property {string} buildingAreaPing 權狀坪數（必填才算單價）
 * @property {string} mainBuildingPing 主建物坪（選填；僅顯示）
 * @property {string} listPriceWan 開價（萬元，選填）
 * @property {string[]} offerPricesWan 出價字串陣列（空值略過）
 */
export interface TargetPropertyInput {
  buildingAreaPing: string
  mainBuildingPing: string
  listPriceWan: string
  offerPricesWan: string[]
}

/**
 * @description 可比釘選列（session 記憶體；重整／換資料集清空）
 * @property {string} transactionId 對應 RealPriceTransaction.id
 * @property {string} note 使用者短註（可空）
 */
export interface PinnedComparable {
  transactionId: string
  note: string
}

/**
 * @description 單價／總價摘要統計（含分位）
 * @property {number | null} average 平均
 * @property {number | null} median 中位數
 * @property {number | null} p25 第 25 百分位；樣本不足時為 null
 * @property {number | null} p75 第 75 百分位；樣本不足時為 null
 * @property {number | null} highest 最高
 * @property {number | null} lowest 最低
 * @property {number} count 有效筆數
 * @property {boolean} hasPercentiles 是否達分位門檻（有效筆數 ≥ 5）
 */
export interface PercentileStats {
  average: number | null
  median: number | null
  p25: number | null
  p75: number | null
  highest: number | null
  lowest: number | null
  count: number
  hasPercentiles: boolean
}

/**
 * @description 本案單一總價列（開價或某一出價）相對篩選後單價分位的結果
 * @property {string} label 列標籤（開價／出價 n）
 * @property {number} totalPriceWan 總價（萬元）
 * @property {number} unitPriceWanPerPing 換算單價（萬元／坪）
 * @property {'偏買方' | '合理帶' | '偏貴' | null} bandLabel 落點標籤；樣本不足或無分位時為 null
 */
export interface TargetPriceRow {
  label: string
  totalPriceWan: number
  unitPriceWanPerPing: number
  bandLabel: '偏買方' | '合理帶' | '偏貴' | null
}

/**
 * @description 折線圖單一月份資料點
 * @property {string} label 成交年月 YYYY-MM（X 軸）
 * @property {number | null} primary 主線數值（通常為中位數或成交筆數）
 * @property {number | null} [secondary] 輔線數值（通常為平均數；成交量圖可不提供）
 * @property {number} dealCount 該月成交筆數
 */
export interface MonthlyMetricPoint {
  label: string
  primary: number | null
  secondary?: number | null
  dealCount: number
}

/**
 * @description 路名／備註搜尋候選列
 * @property {string} value 候選字串
 * @property {boolean} selected 是否已在待加入勾選集合中
 */
export interface CandidateItem {
  value: string
  selected: boolean
}

/**
 * @description 散點圖單筆點（成交或本案假設）
 * @property {string} id 對應交易列 id，或本案假設點識別
 * @property {string} xLabel 成交日期字串（顯示用）
 * @property {number} xValue 成交日時間戳（座標用）
 * @property {number} yValue 單價或總價數值
 * @property {string} meta 滑鼠提示用摘要
 * @property {boolean} [pinned] 是否為已釘選可比成交點
 * @property {'deal' | 'reference'} [kind] 點類型；預設 deal；reference＝本案假設點
 */
export interface ScatterPoint {
  id: string
  xLabel: string
  xValue: number
  yValue: number
  meta: string
  pinned?: boolean
  kind?: 'deal' | 'reference'
}
