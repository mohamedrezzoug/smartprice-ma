import {config} from '../config'
import type {PriceRecord} from '../pricing'
import {mergeRemotePrices} from './priceChanges'

const KEY = 'sp-outbox-v1'
export const syncEnabled = () => !!config.syncUrl

export const loadOutbox = (storage: Pick<Storage, 'getItem'> = localStorage): PriceRecord[] => {
  try { const v = JSON.parse(storage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
export const saveOutbox = (q: PriceRecord[], storage: Pick<Storage, 'setItem'> = localStorage) => storage.setItem(KEY, JSON.stringify(q))

/** Adds records to the outbox; a newer record for the same price replaces the older one. */
export function enqueue(records: PriceRecord[], storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  if (!records.length) return loadOutbox(storage)
  const k = (r: PriceRecord) => `${r.cityId}|${r.area || ''}|${r.productId}|${r.storeId}`
  const map = new Map(loadOutbox(storage).map(r => [k(r), r]))
  for (const r of records) map.set(k(r), r)
  const q = [...map.values()]
  saveOutbox(q, storage)
  return q
}

export type SyncResult =
  | {status: 'no-server'}
  | {status: 'offline'}
  | {status: 'ok'; pushed: number; records: PriceRecord[]; changed: number}
  | {status: 'error'; message: string}

/**
 * Server contract (VITE_API_URL):
 *   POST {API}/prices/batch  body {records: PriceRecord[]}  → 2xx
 *   GET  {API}/prices        → PriceRecord[]
 */
export async function syncNow(local: PriceRecord[], fetchFn: typeof fetch = fetch): Promise<SyncResult> {
  const api = config.syncUrl
  if (!api) return {status: 'no-server'}
  if (typeof navigator !== 'undefined' && !navigator.onLine) return {status: 'offline'}
  try {
    const q = loadOutbox()
    if (q.length) {
      const r = await fetchFn(`${api}/prices/batch`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({records: q})})
      if (!r.ok) throw new Error(`POST ${r.status}`)
      saveOutbox([])
    }
    const g = await fetchFn(`${api}/prices`)
    if (!g.ok) throw new Error(`GET ${g.status}`)
    const merged = mergeRemotePrices(local, await g.json())
    return {status: 'ok', pushed: q.length, records: merged.records, changed: merged.changed}
  } catch (e) { return {status: 'error', message: e instanceof Error ? e.message : String(e)} }
}

/** Registers Background Sync (Chrome/Android only; ignored elsewhere). */
export async function registerBackgroundSync() {
  try {
    const reg = (await navigator.serviceWorker?.ready) as (ServiceWorkerRegistration & {sync?: {register(tag: string): Promise<void>}}) | undefined
    await reg?.sync?.register('sp-sync')
  } catch { /* unsupported */ }
}
