import {describe, expect, it, vi} from 'vitest'
import {diffPriceRecords, mergeRemotePrices} from './priceChanges'
import {enqueue, loadOutbox} from './sync'
import type {PriceRecord} from '../pricing'

const rec = (over: Partial<PriceRecord> = {}): PriceRecord => ({productId: 'p1', storeId: 'aswak', cityId: 'casablanca', price: 10, updatedAt: '2026-11-01', status: 'user', ...over})
const mem = () => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v)} }

describe('diffPriceRecords', () => {
  it('detects new, dropped and unchanged prices', () => {
    const before = [rec(), rec({storeId: 'marjane', price: 12})]
    const after = [rec({price: 9}), rec({storeId: 'marjane', price: 12}), rec({storeId: 'bim', price: 8})]
    const d = diffPriceRecords(before, after)
    expect(d).toHaveLength(2)
    expect(d.find(x => x.record.storeId === 'aswak')).toMatchObject({old: 10, next: 9})
    expect(d.find(x => x.record.storeId === 'bim')?.old).toBeUndefined()
    expect(diffPriceRecords(before, before)).toEqual([])
  })
  it('does not mix cities or neighborhoods', () => {
    expect(diffPriceRecords([rec()], [rec({cityId: 'rabat'})])).toHaveLength(1)
    expect(diffPriceRecords([rec()], [rec({area: 'maarif'})])).toHaveLength(1)
  })
})

describe('mergeRemotePrices', () => {
  it('keeps the most recent price and ignores invalid rows', () => {
    const local = [rec({price: 10, updatedAt: '2026-11-05'})]
    const out = mergeRemotePrices(local, [
      rec({price: 8, updatedAt: '2026-11-01'}),          // أقدم: يتجاهل
      rec({storeId: 'bim', price: 7, updatedAt: '2026-11-07'}), // جديد
      {productId: 'p1', price: -1}, null, 'x',          // غير صالح
    ])
    expect(out.changed).toBe(1)
    expect(out.records.find(r => r.storeId === 'aswak')?.price).toBe(10)
    expect(out.records.find(r => r.storeId === 'bim')?.price).toBe(7)
    expect(mergeRemotePrices(local, 'nope')).toEqual({records: local, changed: 0})
  })
  it('lets a newer server price override the local one', () => {
    const out = mergeRemotePrices([rec({price: 10, updatedAt: '2026-11-01'})], [rec({price: 9, updatedAt: '2026-11-08'})])
    expect(out.records[0].price).toBe(9)
  })
})

describe('outbox', () => {
  it('queues records and replaces the same price instead of duplicating', () => {
    const s = mem()
    enqueue([rec({price: 10})], s); enqueue([rec({price: 9}), rec({storeId: 'bim'})], s)
    const q = loadOutbox(s)
    expect(q).toHaveLength(2)
    expect(q.find(r => r.storeId === 'aswak')?.price).toBe(9)
    expect(vi.isMockFunction(enqueue)).toBe(false)
  })
})
