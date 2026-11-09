import {config} from './config'
import type {Product} from './data'
import {matchCity, matchNeighborhood} from './location/geo'
import {ALL_NEIGHBORHOODS, neighborhoodById} from './location/regions'

/* ------------------------------------------------------------------ *
 * City-scoped price engine.
 * Every price belongs to ONE city (and optionally one neighborhood).
 * Prices from different cities are never mixed.
 * ------------------------------------------------------------------ */

export type PriceStatus = 'verified' | 'user'
export type Freshness = 'verified' | 'user' | 'outdated'

export type PriceRecord = {
  productId: string
  storeId: string
  cityId: string
  /** Neighborhood id. Undefined = applies to the whole city. */
  area?: string
  price: number
  /** ISO date (YYYY-MM-DD or full ISO timestamp). */
  updatedAt: string
  status: PriceStatus
}

export type PriceIndex = Map<string, Map<string, PriceRecord>>

const DAY = 86_400_000

export function freshness(r: PriceRecord, now = Date.now(), outdatedDays = config.outdatedDays): Freshness {
  const t = Date.parse(r.updatedAt)
  if (!Number.isFinite(t) || now - t > outdatedDays * DAY) return 'outdated'
  return r.status
}

/**
 * Builds productId → storeId → record for one city.
 * - City-wide records apply everywhere in the city.
 * - Neighborhood records apply only when that neighborhood is selected, and override city-wide ones.
 */
export function buildPriceIndex(records: PriceRecord[], cityId: string, area: string = ALL_NEIGHBORHOODS): PriceIndex {
  const index: PriceIndex = new Map()
  for (const r of records) {
    if (r.cityId !== cityId) continue
    if (r.area && r.area !== area) continue
    let byStore = index.get(r.productId)
    if (!byStore) index.set(r.productId, byStore = new Map())
    const existing = byStore.get(r.storeId)
    const moreSpecific = !!r.area && !existing?.area
    const sameScopeNewer = !!existing && !!r.area === !!existing.area && Date.parse(r.updatedAt) >= Date.parse(existing.updatedAt)
    if (!existing || moreSpecific || sameScopeNewer) byStore.set(r.storeId, r)
  }
  return index
}

export function offersFor(index: PriceIndex, productId: string, storeFilter = 'all'): PriceRecord[] {
  const m = index.get(productId)
  if (!m) return []
  return [...m.values()].filter(r => storeFilter === 'all' || r.storeId === storeFilter).sort((a, b) => a.price - b.price)
}

export function bestOffer(index: PriceIndex, productId: string): PriceRecord | undefined {
  return offersFor(index, productId)[0]
}

export function latestUpdate(records: Iterable<PriceRecord>): string | undefined {
  let best: string | undefined
  for (const r of records) if (!best || Date.parse(r.updatedAt) > Date.parse(best)) best = r.updatedAt
  return best
}

/** Chains that have at least one price in this index (i.e. present in the city/area). */
export function storesInIndex(index: PriceIndex): string[] {
  const s = new Set<string>()
  for (const m of index.values()) for (const id of m.keys()) s.add(id)
  return [...s]
}

export type BasketLine = {productId: string; qty: number}
export type StoreBasket = {
  storeId: string
  total: number
  available: string[]
  missing: string[]
  complete: boolean
  latest?: string
}
export type BasketComparison = {
  complete: StoreBasket[]
  partial: StoreBasket[]
  cheapestComplete?: StoreBasket
  /** Buying every product at its cheapest store in the city. */
  bestMix: {total: number; unavailable: string[]}
}

export function compareBasket(lines: BasketLine[], index: PriceIndex, storeIds: string[] = storesInIndex(index)): BasketComparison {
  const baskets: StoreBasket[] = storeIds.map(storeId => {
    const available: string[] = []
    const missing: string[] = []
    const used: PriceRecord[] = []
    let total = 0
    for (const l of lines) {
      const r = index.get(l.productId)?.get(storeId)
      if (r) { total += r.price * l.qty; available.push(l.productId); used.push(r) } else missing.push(l.productId)
    }
    return {storeId, total: round2(total), available, missing, complete: lines.length > 0 && missing.length === 0, latest: latestUpdate(used)}
  }).filter(b => b.available.length > 0)

  const complete = baskets.filter(b => b.complete).sort((a, b) => a.total - b.total)
  const partial = baskets.filter(b => !b.complete).sort((a, b) => b.available.length - a.available.length || a.total - b.total)
  let mix = 0
  const unavailable: string[] = []
  for (const l of lines) {
    const best = bestOffer(index, l.productId)
    if (best) mix += best.price * l.qty; else unavailable.push(l.productId)
  }
  return {complete, partial, cheapestComplete: complete[0], bestMix: {total: round2(mix), unavailable}}
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function upsertPrice(records: PriceRecord[], r: PriceRecord): PriceRecord[] {
  const same = (x: PriceRecord) => x.productId === r.productId && x.storeId === r.storeId && x.cityId === r.cityId && (x.area || '') === (r.area || '')
  return [...records.filter(x => !same(x)), r]
}

/* ------------------------------- CSV ------------------------------- */

export const CSV_HEADER = ['product_id', 'name_ar', 'name_fr', 'category', 'unit', 'store_id', 'price_mad', 'city', 'area', 'updated_at', 'status']

const esc = (v: string) => `"${v.replaceAll('"', '""')}"`

export function toCSV(products: Product[], records: PriceRecord[]): string {
  const byId = new Map(products.map(p => [p.id, p]))
  const rows = records
    .filter(r => byId.has(r.productId))
    .map(r => {
      const p = byId.get(r.productId)!
      return [p.id, p.name, p.nameFr, p.category, p.unit, r.storeId, String(r.price), r.cityId, r.area || '', r.updatedAt, r.status]
    })
  return [CSV_HEADER, ...rows].map(r => r.map(v => esc(String(v))).join(',')).join('\n')
}

/** RFC-4180-ish parser (quoted fields, escaped quotes, commas/newlines inside quotes). */
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else q = false } else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(v => v.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(v => v.trim() !== '')) rows.push(row)
  return rows
}

export type ImportResult = {products: Product[]; records: PriceRecord[]; imported: number; skipped: number}

/**
 * Imports both the new format (with area/updated_at/status) and the legacy
 * 8-column format. Rows whose city cannot be identified are skipped — prices
 * are never assigned to a guessed city.
 */
export function importCSV(text: string, products: Product[], records: PriceRecord[], now = new Date()): ImportResult {
  const rows = parseCSVRows(text)
  if (!rows.length) return {products, records, imported: 0, skipped: 0}
  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = (name: string, fallback: number) => { const i = header.indexOf(name); return i >= 0 ? i : (header.includes('product_id') ? -1 : fallback) }
  const C = {
    id: col('product_id', 0), ar: col('name_ar', 1), fr: col('name_fr', 2), cat: col('category', 3), unit: col('unit', 4),
    store: col('store_id', 5), price: col('price_mad', 6), city: col('city', 7), area: col('area', 8), date: col('updated_at', 9), status: col('status', 10),
  }
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '') : '').trim()
  const prodMap = new Map(products.map(p => [p.id, p]))
  let out = records
  let imported = 0, skipped = 0
  const today = now.toISOString().slice(0, 10)
  for (const r of rows.slice(1)) {
    const id = get(r, C.id), store = get(r, C.store), price = Number(get(r, C.price).replace(',', '.'))
    const city = matchCity(get(r, C.city))
    if (!id || !store || !Number.isFinite(price) || price <= 0 || !city) { skipped++; continue }
    if (!prodMap.has(id)) {
      const name = get(r, C.ar), nameFr = get(r, C.fr)
      if (!name && !nameFr) { skipped++; continue }
      prodMap.set(id, {id, name: name || nameFr, nameFr: nameFr || name, category: get(r, C.cat) || 'grocery', unit: get(r, C.unit)})
    }
    const areaRaw = get(r, C.area)
    const area = areaRaw ? (neighborhoodById(areaRaw)?.city === city.id ? areaRaw : matchNeighborhood(city.id, areaRaw)?.id) : undefined
    const dateRaw = get(r, C.date)
    const updatedAt = dateRaw && Number.isFinite(Date.parse(dateRaw)) ? dateRaw : today
    const status: PriceStatus = get(r, C.status).toLowerCase() === 'verified' ? 'verified' : 'user'
    out = upsertPrice(out, {productId: id, storeId: store, cityId: city.id, area, price, updatedAt, status})
    imported++
  }
  return {products: [...prodMap.values()], records: out, imported, skipped}
}
