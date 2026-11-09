import type {PriceChange} from './priceChanges'
import type {Product, Store} from '../data'

export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window
export const notifPermission = (): NotificationPermission | 'unsupported' => canNotify() ? Notification.permission : 'unsupported'
export const askNotifPermission = async () => canNotify() ? Notification.requestPermission() : ('unsupported' as const)

/** URL of a file in /public, valid under any base path. */
const asset = (p: string) => new URL(p, document.baseURI).href

export async function showNotification(title: string, body: string, tag = 'sp-price') {
  if (notifPermission() !== 'granted') return false
  const opts: NotificationOptions = {body, tag, icon: asset('icons/icon-192.png'), badge: asset('icons/icon-192.png'), dir: 'auto'}
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, opts); return true }
  } catch { /* fall back below */ }
  try { new Notification(title, opts); return true } catch { return false }
}

/** One summary notification for a batch of price changes (offer = a price that went down). */
export async function notifyPriceChanges(changes: PriceChange[], products: Product[], stores: Store[], ar: boolean) {
  if (!changes.length) return false
  const pName = (id: string) => { const p = products.find(x => x.id === id); return p ? (ar ? p.name : p.nameFr) : id }
  const sName = (id: string) => { const s = stores.find(x => x.id === id); return s ? (ar ? s.name : s.nameFr) : id }
  const drops = changes.filter(c => c.old !== undefined && c.next < c.old)
  const lines = changes.slice(0, 3).map(c =>
    `${pName(c.record.productId)} • ${sName(c.record.storeId)}: ${c.old === undefined ? '' : `${c.old.toFixed(2)} → `}${c.next.toFixed(2)} DH`)
  const more = changes.length > 3 ? ` (+${changes.length - 3})` : ''
  const title = drops.length ? (ar ? '🔻 عرض: نقص الثمن' : '🔻 Offre : prix en baisse') : (ar ? 'تحديث فالأثمنة' : 'Mise à jour des prix')
  return showNotification(title, lines.join('\n') + more)
}
