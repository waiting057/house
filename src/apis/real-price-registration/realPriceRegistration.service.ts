import {
  LOCAL_CSV_FILENAME,
  parseCsvText,
} from '@/views/real-price-registration/realPriceRegistrationCsv.service'
import type { RealPriceTransaction } from '@/views/real-price-registration/realPriceRegistration.models'

const basePath = import.meta.env.BASE_URL

/** 預設分析資料：本地士林區 CSV（頁面主路徑） */
export class RealPriceRegistrationDataService {
  static getLocalCsvUrl() {
    return `${basePath}data/real-price-registration/${encodeURIComponent(LOCAL_CSV_FILENAME)}`
  }

  static async loadLocalCsv(): Promise<RealPriceTransaction[]> {
    const response = await fetch(this.getLocalCsvUrl())
    if (!response.ok) {
      throw new Error(`Failed to load ${LOCAL_CSV_FILENAME}: ${response.status}`)
    }
    const text = await response.text()
    return parseCsvText(text)
  }
}
