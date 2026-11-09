export type Lang = 'ar' | 'fr'
/** Picks the Arabic or French string. */
export type T = (ar: string, fr: string) => string

export const makeT = (lang: Lang): T => (ar, fr) => lang === 'ar' ? ar : fr

export function formatDate(iso: string | number | undefined | null, lang: Lang): string {
  if (iso === undefined || iso === null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', {day: 'numeric', month: 'short', year: 'numeric'})
}

export function formatDateTime(ts: number | null | undefined, lang: Lang): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-MA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})
}

export const money = (n: number) => `${n.toFixed(2)} DH`
