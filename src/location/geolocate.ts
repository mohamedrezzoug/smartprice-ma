import {matchCity, matchNeighborhood, nearestCity, type LatLng} from './geo'
import {ProviderError, type GeocoderAdapter} from './providers'

export type GpsErrorCode = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout'
export class GpsError extends Error {
  constructor(public code: GpsErrorCode) { super(code) }
}

export type GpsFix = LatLng & {accuracy: number}

type Env = {geolocation?: Geolocation; secure?: boolean}

/**
 * Wraps navigator.geolocation.getCurrentPosition in a promise with typed errors.
 * MUST only be called from an explicit user action (it triggers the browser prompt).
 */
export function getCurrentPosition(timeoutMs: number, env: Env = {}): Promise<GpsFix> {
  const geo = 'geolocation' in env ? env.geolocation : (typeof navigator !== 'undefined' ? navigator.geolocation : undefined)
  const secure = env.secure ?? (typeof window === 'undefined' ? true : window.isSecureContext !== false)
  if (!secure) return Promise.reject(new GpsError('insecure'))
  if (!geo) return Promise.reject(new GpsError('unsupported'))
  return new Promise((resolve, reject) => {
    let settled = false
    // Some browsers never call back when the prompt is dismissed; enforce our own deadline.
    const guard = setTimeout(() => { if (!settled) { settled = true; reject(new GpsError('timeout')) } }, timeoutMs + 2000)
    geo.getCurrentPosition(
      pos => {
        if (settled) return
        settled = true; clearTimeout(guard)
        resolve({lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy})
      },
      err => {
        if (settled) return
        settled = true; clearTimeout(guard)
        reject(new GpsError(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'))
      },
      {enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000},
    )
  })
}

export type ResolvedLocation = {
  cityId?: string
  neighborhoodId?: string
  address?: string
  /** true when the city was estimated from the nearest city centre (no address lookup). */
  approximate: boolean
  lookup: 'ok' | 'failed' | 'disabled'
  /** true when the position appears to be outside Morocco. */
  outside: boolean
}

const NEAREST_MAX_KM = 40

/** Turns a GPS fix into a city / neighborhood / address using the geocoder, with an offline fallback. */
export async function resolveLocation(fix: GpsFix, geocoder: GeocoderAdapter, lang: 'ar' | 'fr', signal?: AbortSignal): Promise<ResolvedLocation> {
  const near = nearestCity(fix)
  try {
    const r = await geocoder.reverse(fix, lang, signal)
    if (r.countryCode && !['ma', 'eh'].includes(r.countryCode.toLowerCase())) {
      return {approximate: false, lookup: 'ok', outside: true, address: r.address}
    }
    const city = r.cityCandidates.map(matchCity).find(Boolean) || (near.km <= NEAREST_MAX_KM ? near.city : undefined)
    const hood = city ? matchNeighborhood(city.id, ...r.neighborhoodCandidates) : undefined
    return {
      cityId: city?.id,
      neighborhoodId: hood?.id,
      address: r.address,
      approximate: !r.cityCandidates.some(c => matchCity(c)),
      lookup: 'ok',
      outside: false,
    }
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'aborted') throw e
    const lookup = e instanceof ProviderError && e.kind === 'disabled' ? 'disabled' : 'failed'
    if (near.km <= NEAREST_MAX_KM) return {cityId: near.city.id, approximate: true, lookup, outside: false}
    return {approximate: true, lookup, outside: near.km > 150}
  }
}
