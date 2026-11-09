import {seedBranches, seedPrices, seedProducts, type Branch, type Product} from './data'
import {isValidLatLng} from './location/geo'
import {DEFAULT_CITY} from './location/regions'
import type {PriceRecord} from './pricing'

export type Catalog = {products: Product[]; prices: PriceRecord[]; branches: Branch[]}

export const CATALOG_KEY = 'sp-catalog-v2'
const LEGACY_KEY = 'sp-products'

export const seedCatalog = (): Catalog => ({products: [...seedProducts], prices: [...seedPrices], branches: [...seedBranches]})

type LegacyProduct = Product & {prices?: Record<string, number>}

/** Converts the v1 format (one price per store, implicitly Casablanca) to city-scoped records. */
export function migrateLegacy(legacy: LegacyProduct[], today = new Date().toISOString().slice(0, 10)): Catalog {
  const products: Product[] = []
  const prices: PriceRecord[] = []
  for (const {prices: p, ...product} of legacy) {
    if (!product?.id) continue
    products.push(product)
    for (const [storeId, price] of Object.entries(p || {})) {
      if (!(Number(price) > 0)) continue
      const seed = seedPrices.find(r => r.cityId === DEFAULT_CITY && r.productId === product.id && r.storeId === storeId && r.price === price)
      prices.push(seed ?? {productId: product.id, storeId, cityId: DEFAULT_CITY, price: Number(price), updatedAt: today, status: 'user'})
    }
  }
  return {products, prices, branches: []}
}

const sanitizeBranch = (b: Branch): Branch => {
  // Drop coordinates that are not valid rather than keeping a fake position.
  if (b.lat === undefined && b.lng === undefined) return b
  if (isValidLatLng(b.lat, b.lng)) return b
  const {lat: _a, lng: _b, ...rest} = b
  return rest
}

export function loadCatalog(storage: Pick<Storage, 'getItem'> = localStorage): Catalog {
  try {
    const raw = storage.getItem(CATALOG_KEY)
    if (raw) {
      const c = JSON.parse(raw) as Partial<Catalog>
      if (Array.isArray(c.products) && Array.isArray(c.prices)) {
        return {products: c.products, prices: c.prices, branches: (Array.isArray(c.branches) ? c.branches : []).map(sanitizeBranch)}
      }
    }
    const legacy = storage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      if (Array.isArray(parsed) && parsed.length) return migrateLegacy(parsed)
    }
  } catch { /* fall through to seed */ }
  return seedCatalog()
}

export function saveCatalog(c: Catalog, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(CATALOG_KEY, JSON.stringify(c))
}
