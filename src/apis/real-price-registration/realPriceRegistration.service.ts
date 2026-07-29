import {
  LOCAL_CSV_FILENAME,
  parseCsvText,
} from '@/views/real-price-registration/realPriceRegistrationCsv.service'
import type { RealPriceTransaction } from '@/views/real-price-registration/realPriceRegistration.models'

const basePath = import.meta.env.BASE_URL

/**
 * @description 實價登錄靜態資料載入：讀取 public 下本地預設 CSV，並解析成分析用交易列
 */
export class RealPriceRegistrationDataService {
  /**
   * @description 組出本地預設 CSV 的完整 URL（含 GitHub Pages 的 BASE_URL 子路徑）
   */
  static getLocalCsvUrl() {
    // 檔名含中文，需 encode；BASE_URL 確保 Pages 子路徑部署時路徑正確
    return `${basePath}data/real-price-registration/${encodeURIComponent(LOCAL_CSV_FILENAME)}`
  }

  /**
   * @description 下載並解析本地預設 CSV 為 RealPriceTransaction[]
   * @throws 網路／HTTP 失敗，或 CSV 格式不符（CsvFormatError）
   */
  static async loadLocalCsv(): Promise<RealPriceTransaction[]> {
    const response = await fetch(this.getLocalCsvUrl())
    if (!response.ok) {
      throw new Error(`Failed to load ${LOCAL_CSV_FILENAME}: ${response.status}`)
    }
    const text = await response.text()
    return parseCsvText(text)
  }
}
