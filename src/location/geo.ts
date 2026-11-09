import {moroccanCities, neighborhoods, type City, type Neighborhood} from './regions'

export type LatLng = {lat: number; lng: number}

/** Lower-case, strip Latin diacritics, Arabic tashkeel/tatweel and unify common Arabic letter variants. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/['’`\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const keys = (x: {ar: string; fr: string; id: string; aliases?: string[]}) =>
  [x.ar, x.fr, x.id, ...(x.aliases || [])].map(normalize)

/** Search cities by Arabic or French name (prefix and substring). */
export function searchCities(query: string, list: City[] = moroccanCities): City[] {
  const q = normalize(query)
  if (!q) return list
  const scored = list
    .map(city => {
      const k = keys(city)
      const score = k.some(v => v === q) ? 0 : k.some(v => v.startsWith(q)) ? 1 : k.some(v => v.includes(q)) ? 2 : 9
      return {city, score}
    })
    .filter(x => x.score < 9)
  return scored.sort((a, b) => a.score - b.score).map(x => x.city)
}

export function searchNeighborhoods(query: string, list: Neighborhood[]): Neighborhood[] {
  const q = normalize(query)
  if (!q) return list
  return list.filter(x => [x.ar, x.fr].map(normalize).some(v => v.includes(q)))
}

/** Exact match of a free-text place name (from a geocoder, CSV...) to a known city. */
export function matchCity(name?: string | null): City | undefined {
  if (!name) return undefined
  const q = normalize(name)
  if (!q) return undefined
  return moroccanCities.find(city => keys(city).includes(q))
    // geocoders sometimes return "Casablanca Anfa", "Préfecture de Rabat"...
    || moroccanCities.find(city => keys(city).some(k => k.length > 3 && (q.split(' ').includes(k) || q.includes(` ${k}`) || q.startsWith(`${k} `))))
}

export function matchNeighborhood(cityId: string, ...names: (string | undefined | null)[]): Neighborhood | undefined {
  const list = neighborhoods.filter(x => x.city === cityId)
  for (const name of names) {
    if (!name) continue
    const q = normalize(name)
    const hit = list.find(x => [x.ar, x.fr].map(normalize).some(v => v === q || q.includes(v) || v.includes(q)))
    if (hit) return hit
  }
  return undefined
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const rad = (d: number) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Nearest known city centre. Used only as an approximate fallback (e.g. offline). */
export function nearestCity(p: LatLng): {city: City; km: number} {
  let best = moroccanCities[0]
  let bestKm = Infinity
  for (const city of moroccanCities) {
    const km = distanceKm(p, {lat: city.center[0], lng: city.center[1]})
    if (km < bestKm) { best = city; bestKm = km }
  }
  return {city: best, km: bestKm}
}

export const isValidLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)

export const formatKm = (km: number) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`
