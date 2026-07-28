import type {
  FilterOptionsPayload,
  RealPriceManifest,
  RealPriceTransaction,
} from '@/views/real-price-registration/realPriceRegistration.models'

const basePath = import.meta.env.BASE_URL

async function loadJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(`${basePath}data/real-price-registration/${relativePath}`)
  if (!response.ok) {
    throw new Error(`Failed to load ${relativePath}: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export class RealPriceRegistrationDataService {
  static loadManifest() {
    return loadJson<RealPriceManifest>('manifest.json')
  }

  static loadTransactions() {
    return loadJson<RealPriceTransaction[]>('transactions.json')
  }

  static loadFilterOptions() {
    return loadJson<FilterOptionsPayload>('filter-options.json')
  }
}
