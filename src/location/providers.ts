import {config, type AppConfig} from '../config'
import {isValidLatLng, type LatLng} from './geo'

/* ------------------------------------------------------------------ *
 * Provider adapters. Each adapter is a small interface so the app can
 * swap OpenStreetMap services for a commercial provider or a backend
 * proxy without touching UI code.
 * ------------------------------------------------------------------ */

export type ProviderErrorKind = 'network' | 'http' | 'disabled' | 'aborted' | 'invalid' | 'timeout'
export class ProviderError extends Error {
  constructor(public kind: ProviderErrorKind, message: string = kind) { super(message) }
}

export type ReverseGeocodeResult = {
  city?: string
  /** Additional names that may identify the city (county, municipality...). */
  cityCandidates: string[]
  neighborhood?: string
  neighborhoodCandidates: string[]
  address?: string
  countryCode?: string
}

export interface GeocoderAdapter {
  readonly name: string
  reverse(p: LatLng, lang: 'ar' | 'fr', signal?: AbortSignal): Promise<ReverseGeocodeResult>
}

export type Place = {
  id: string
  name: string
  chainId?: string
  address?: string
  lat: number
  lng: number
  source: 'osm' | 'local'
}

export interface PlacesAdapter {
  readonly name: string
  nearbySupermarkets(p: LatLng, radiusKm: number, signal?: AbortSignal): Promise<Place[]>
}

export const PROVIDER_TIMEOUT_MS = 30_000

/** fetch with a hard timeout and typed errors. Coordinates are never logged. */
async function safeFetch(input: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; ctrl.abort() }, timeoutMs)
  const outer = init.signal
  const onAbort = () => ctrl.abort()
  if (outer) { if (outer.aborted) ctrl.abort(); else outer.addEventListener('abort', onAbort, {once: true}) }
  let res: Response
  try {
    res = await fetch(input, {...init, signal: ctrl.signal})
  } catch {
    if (timedOut) throw new ProviderError('timeout')
    if (outer?.aborted) throw new ProviderError('aborted')
    throw new ProviderError('network')
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
  if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`)
  return res
}

/* --------------------------- Nominatim --------------------------- */

type NominatimAddress = Record<string, string | undefined>

export function createNominatimGeocoder(baseUrl: string): GeocoderAdapter {
  return {
    name: 'OpenStreetMap Nominatim',
    async reverse(p, lang, signal) {
      const url = `${baseUrl.replace(/\/$/, '')}/reverse?format=jsonv2&addressdetails=1&zoom=17` +
        `&lat=${p.lat.toFixed(6)}&lon=${p.lng.toFixed(6)}&accept-language=${lang},fr,ar`
      const res = await safeFetch(url, {signal, headers: {Accept: 'application/json'}, referrerPolicy: 'strict-origin-when-cross-origin'})
      let json: {address?: NominatimAddress; display_name?: string; error?: string}
      try { json = await res.json() } catch { throw new ProviderError('invalid') }
      if (json.error || !json.address) throw new ProviderError('invalid', json.error)
      return parseNominatim(json.address, json.display_name)
    },
  }
}

export function parseNominatim(a: NominatimAddress, displayName?: string): ReverseGeocodeResult {
  const cityCandidates = [a.city, a.town, a.village, a.municipality, a.county, a.state_district]
    .filter((x): x is string => !!x)
  const neighborhoodCandidates = [a.neighbourhood, a.suburb, a.quarter, a.city_district, a.residential, a.hamlet]
    .filter((x): x is string => !!x)
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const address = [street, neighborhoodCandidates[0], cityCandidates[0]].filter(Boolean).join('، ') || displayName
  return {
    city: cityCandidates[0],
    cityCandidates,
    neighborhood: neighborhoodCandidates[0],
    neighborhoodCandidates,
    address,
    countryCode: a.country_code,
  }
}

/* ---------------------------- Overpass ---------------------------- */

/** Known chains — matched against OSM `brand`/`name` tags. */
const CHAIN_PATTERNS: [string, RegExp][] = [
  ['aswak', /aswak|assalam|اسواق السلام|أسواق السلام/i],
  ['marjane', /marjane|مرجان/i],
  ['carrefour', /carrefour|كارفور/i],
  ['bim', /(^|\s)bim(\s|$)|بيم/i],
  ['atacadao', /atacad|أتقداو|اتقداو/i],
  ['kazyon', /kazyon|كازيون/i],
]

export function matchChain(...names: (string | undefined)[]): string | undefined {
  const text = names.filter(Boolean).join(' ')
  return CHAIN_PATTERNS.find(([, re]) => re.test(text))?.[0]
}

type OverpassElement = {type: string; id: number; lat?: number; lon?: number; center?: {lat: number; lon: number}; tags?: Record<string, string>}

export function parseOverpass(elements: OverpassElement[]): Place[] {
  const out: Place[] = []
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!isValidLatLng(lat, lng)) continue // never invent coordinates
    const t = el.tags || {}
    const name = t.name || t['name:fr'] || t['name:ar'] || t.brand
    if (!name) continue
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
    const address = [street, t['addr:suburb'] || t['addr:district'], t['addr:city']].filter(Boolean).join('، ') || undefined
    out.push({
      id: `osm:${el.type}/${el.id}`,
      name,
      chainId: matchChain(t.brand, t['brand:fr'], t.name, t['name:fr'], t['name:ar']),
      address,
      lat: lat as number,
      lng: lng as number,
      source: 'osm',
    })
  }
  return out
}

export function createOverpassPlaces(url: string): PlacesAdapter {
  return {
    name: 'OpenStreetMap Overpass',
    async nearbySupermarkets(p, radiusKm, signal) {
      const r = Math.round(Math.min(Math.max(radiusKm, 0.5), 25) * 1000)
      const q = `[out:json][timeout:25];` +
        `nwr["shop"~"^(supermarket|wholesale|department_store)$"](around:${r},${p.lat.toFixed(3)},${p.lng.toFixed(3)});` +
        `out center tags 120;`
      const res = await safeFetch(url, {
        method: 'POST', signal,
        headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
        body: 'data=' + encodeURIComponent(q),
      })
      let json: {elements?: OverpassElement[]}
      try { json = await res.json() } catch { throw new ProviderError('invalid') }
      return parseOverpass(json.elements || [])
    },
  }
}

/* ----------------------------- factory ---------------------------- */

const disabledGeocoder: GeocoderAdapter = {name: 'none', reverse: async () => { throw new ProviderError('disabled') }}
const disabledPlaces: PlacesAdapter = {name: 'none', nearbySupermarkets: async () => { throw new ProviderError('disabled') }}

export function createGeocoder(cfg: AppConfig = config): GeocoderAdapter {
  return cfg.geocoderProvider === 'nominatim' ? createNominatimGeocoder(cfg.geocoderUrl) : disabledGeocoder
}

export function createPlaces(cfg: AppConfig = config): PlacesAdapter {
  return cfg.placesProvider === 'overpass' ? createOverpassPlaces(cfg.placesUrl) : disabledPlaces
}
