import {describe, it, expect} from 'vitest'
import {seedPrices, seedProducts} from './data'
import {migrateLegacy, loadCatalog, CATALOG_KEY} from './catalog'
import {
  bestOffer, buildPriceIndex, compareBasket, freshness, importCSV, offersFor, parseCSVRows, storesInIndex, toCSV, upsertPrice,
  type PriceRecord,
} from './pricing'

const NOW = Date.parse('2026-11-09T12:00:00Z')

describe('sample price catalogue', () => {
  it('has products with stable ids and positive city-scoped prices', () => {
    expect(seedProducts.length).toBeGreaterThan(5)
    expect(new Set(seedProducts.map(p => p.id)).size).toBe(seedProducts.length)
    for (const r of seedPrices) {
      expect(r.price).toBeGreaterThan(0)
      expect(r.cityId).toBeTruthy()
      expect(Number.isFinite(Date.parse(r.updatedAt))).toBe(true)
    }
  })
  it('identifies the cheapest store for the first product in Casablanca', () => {
    const idx = buildPriceIndex(seedPrices, 'casablanca')
    expect(bestOffer(idx, 'p1')?.storeId).toBe('atacadao')
  })
})

describe('price isolation between cities', () => {
  it('never mixes Casablanca and Rabat prices', () => {
    const casa = buildPriceIndex(seedPrices, 'casablanca')
    const rabat = buildPriceIndex(seedPrices, 'rabat')
    expect(bestOffer(casa, 'p1')?.price).toBe(16.7)
    expect(bestOffer(rabat, 'p1')?.price).toBe(17.2)
    for (const m of rabat.values()) for (const r of m.values()) expect(r.cityId).toBe('rabat')
    for (const m of casa.values()) for (const r of m.values()) expect(r.cityId).toBe('casablanca')
    // Atacadão has a Casablanca price for oil, but none in Rabat.
    expect(rabat.get('p1')?.has('atacadao')).toBe(false)
  })
  it('returns nothing for a city without prices (shown as "غير متوفر")', () => {
    const fes = buildPriceIndex(seedPrices, 'fes')
    expect(fes.size).toBe(0)
    expect(bestOffer(fes, 'p1')).toBeUndefined()
    expect(offersFor(fes, 'p1')).toEqual([])
  })
  it('neighborhood prices override city-wide prices only in that neighborhood', () => {
    const recs: PriceRecord[] = [
      {productId: 'p1', storeId: 'aswak', cityId: 'casablanca', price: 17, updatedAt: '2026-11-01', status: 'user'},
      {productId: 'p1', storeId: 'aswak', cityId: 'casablanca', area: 'casablanca:maarif', price: 18, updatedAt: '2026-10-01', status: 'verified'},
    ]
    expect(buildPriceIndex(recs, 'casablanca').get('p1')?.get('aswak')?.price).toBe(17)
    expect(buildPriceIndex(recs, 'casablanca', 'casablanca:maarif').get('p1')?.get('aswak')?.price).toBe(18)
    expect(buildPriceIndex(recs, 'casablanca', 'casablanca:anfa').get('p1')?.get('aswak')?.price).toBe(17)
  })
})

describe('freshness', () => {
  const base: PriceRecord = {productId: 'p1', storeId: 'aswak', cityId: 'casablanca', price: 10, updatedAt: '2026-11-05', status: 'verified'}
  it('marks verified, user-submitted and outdated prices', () => {
    expect(freshness(base, NOW, 30)).toBe('verified')
    expect(freshness({...base, status: 'user'}, NOW, 30)).toBe('user')
    expect(freshness({...base, updatedAt: '2026-09-01'}, NOW, 30)).toBe('outdated')
    expect(freshness({...base, updatedAt: 'not a date'}, NOW, 30)).toBe('outdated')
  })
})

describe('basket comparison', () => {
  const idx = buildPriceIndex(seedPrices, 'casablanca')
  it('separates complete and partial stores and finds the cheapest complete basket', () => {
    const cmp = compareBasket([{productId: 'p1', qty: 2}, {productId: 'p2', qty: 1}], idx)
    // p1 + p2 both priced at aswak, marjane, carrefour
    expect(cmp.complete.map(x => x.storeId).sort()).toEqual(['aswak', 'carrefour', 'marjane'])
    expect(cmp.cheapestComplete?.storeId).toBe('aswak')
    expect(cmp.cheapestComplete?.total).toBe(40.05)
    // atacadao has p1 only, bim has p2 only → partial
    expect(cmp.partial.map(x => x.storeId).sort()).toEqual(['atacadao', 'bim'])
    expect(cmp.partial.find(x => x.storeId === 'bim')?.missing).toEqual(['p1'])
    // best mix: p1 @ atacadao 16.7*2 + p2 @ aswak 6.15
    expect(cmp.bestMix.total).toBe(39.55)
  })
  it('reports products unavailable in the city instead of inventing prices', () => {
    const rabat = buildPriceIndex(seedPrices, 'rabat')
    const cmp = compareBasket([{productId: 'p1', qty: 1}, {productId: 'p10', qty: 1}], rabat)
    expect(cmp.complete).toEqual([])
    expect(cmp.cheapestComplete).toBeUndefined()
    expect(cmp.bestMix.unavailable).toEqual(['p10'])
    expect(cmp.bestMix.total).toBe(17.2)
  })
  it('lists stores present in a city', () => {
    expect(storesInIndex(buildPriceIndex(seedPrices, 'rabat')).sort()).toEqual(['aswak', 'bim', 'carrefour', 'marjane'])
  })
})

describe('CSV import / export', () => {
  it('round-trips city, area, date and status', () => {
    const recs = upsertPrice(seedPrices, {productId: 'p3', storeId: 'bim', cityId: 'fes', area: 'fes:saiss', price: 9.5, updatedAt: '2026-11-08', status: 'verified'})
    const csv = toCSV(seedProducts, recs)
    const r = importCSV(csv, seedProducts, [])
    expect(r.skipped).toBe(0)
    expect(r.records.length).toBe(recs.length)
    const fes = r.records.find(x => x.cityId === 'fes')
    expect(fes).toMatchObject({area: 'fes:saiss', price: 9.5, status: 'verified', updatedAt: '2026-11-08'})
  })
  it('imports the legacy 8-column format with Arabic city names', () => {
    const csv = 'product_id,name_ar,name_fr,category,unit,store_id,price_mad,city\np1,زيت المائدة 1 لتر,Huile de table 1 L,grocery,1 L,aswak,17.25,الرباط'
    const r = importCSV(csv, seedProducts, [], new Date('2026-11-09'))
    expect(r.imported).toBe(1)
    expect(r.records[0]).toMatchObject({cityId: 'rabat', price: 17.25, status: 'user', updatedAt: '2026-11-09'})
  })
  it('skips rows whose city cannot be identified (never guesses a city)', () => {
    const csv = 'product_id,name_ar,name_fr,category,unit,store_id,price_mad,city\np1,x,x,grocery,1 L,aswak,17,Atlantis'
    const r = importCSV(csv, seedProducts, [])
    expect(r.imported).toBe(0)
    expect(r.skipped).toBe(1)
  })
  it('parses quoted fields with commas and quotes', () => {
    expect(parseCSVRows('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']])
  })
})

describe('catalog persistence', () => {
  it('migrates the v1 localStorage format into Casablanca records', () => {
    const legacy = [{id: 'p1', name: 'x', nameFr: 'x', category: 'grocery', unit: '1 L', prices: {aswak: 16.95, marjane: 99}}]
    const c = migrateLegacy(legacy, '2026-11-09')
    expect(c.prices).toHaveLength(2)
    expect(c.prices.every(r => r.cityId === 'casablanca')).toBe(true)
    expect(c.prices.find(r => r.storeId === 'marjane')).toMatchObject({price: 99, updatedAt: '2026-11-09', status: 'user'})
  })
  it('drops invalid branch coordinates instead of keeping fake positions', () => {
    const store = {getItem: (k: string) => k === CATALOG_KEY ? JSON.stringify({products: [], prices: [], branches: [{id: 'b', storeId: 'bim', cityId: 'fes', lat: 999, lng: 5, source: 'local'}]}) : null}
    const c = loadCatalog(store)
    expect(c.branches[0].lat).toBeUndefined()
    expect(c.branches[0].lng).toBeUndefined()
  })
})
