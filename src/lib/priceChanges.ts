import type {PriceRecord} from '../pricing'

export type PriceChange = {record: PriceRecord; old?: number; next: number}

export const priceKey = (r: Pick<PriceRecord, 'productId' | 'storeId' | 'cityId' | 'area'>) =>
  `${r.cityId}|${r.area || ''}|${r.productId}|${r.storeId}`

/** Prices that are new or whose value changed between two snapshots. */
export function diffPriceRecords(before: PriceRecord[], after: PriceRecord[]): PriceChange[] {
  const old = new Map(before.map(r => [priceKey(r), r.price]))
  const out: PriceChange[] = []
  for (const r of after) {
    const prev = old.get(priceKey(r))
    if (prev !== r.price) out.push({record: r, old: prev, next: r.price})
  }
  return out
}

const validRemote = (r: unknown): r is PriceRecord => {
  const x = r as Partial<PriceRecord> | null
  return !!x && typeof x.productId === 'string' && typeof x.storeId === 'string' && typeof x.cityId === 'string'
    && typeof x.price === 'number' && Number.isFinite(x.price) && x.price > 0
    && typeof x.updatedAt === 'string' && Number.isFinite(Date.parse(x.updatedAt))
    && (x.status === 'verified' || x.status === 'user')
}

/** Merges server prices into local ones: the most recent updatedAt wins; invalid server rows are ignored. */
export function mergeRemotePrices(local: PriceRecord[], remote: unknown): {records: PriceRecord[]; changed: number} {
  if (!Array.isArray(remote)) return {records: local, changed: 0}
  const map = new Map(local.map(r => [priceKey(r), r]))
  let changed = 0
  for (const r of remote) {
    if (!validRemote(r)) continue
    const mine = map.get(priceKey(r))
    if (!mine || Date.parse(r.updatedAt) > Date.parse(mine.updatedAt)) {
      if (!mine || mine.price !== r.price || mine.status !== r.status) changed++
      map.set(priceKey(r), r)
    }
  }
  return {records: changed ? [...map.values()] : local, changed}
}
