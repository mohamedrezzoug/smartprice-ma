import {createContext, useContext, type Dispatch} from 'react'
import {matchCity} from './geo'
import {ALL_NEIGHBORHOODS, DEFAULT_CITY, cityById, neighborhoodById} from './regions'

/* ------------------------------------------------------------------ *
 * Centralized location state.
 * - Manual preferences (city, neighborhood) are persisted locally.
 * - GPS coordinates are persisted ONLY when the user opted in
 *   (`rememberGps`). Otherwise they live in memory for the session.
 * ------------------------------------------------------------------ */

export type LocationMethod = 'manual' | 'gps'

export type LocationState = {
  cityId: string
  neighborhoodId: string
  lat?: number
  lng?: number
  accuracy?: number
  address?: string
  approximate?: boolean
  method: LocationMethod
  updatedAt: number | null
  rememberGps: boolean
}

export type LocationAction =
  | {type: 'setCity'; cityId: string; now?: number}
  | {type: 'setNeighborhood'; neighborhoodId: string; now?: number}
  | {type: 'setGps'; lat: number; lng: number; accuracy: number; cityId?: string; neighborhoodId?: string; address?: string; approximate?: boolean; now?: number}
  | {type: 'setRememberGps'; value: boolean}
  | {type: 'clearGps'}
  | {type: 'reset'}

export const STORAGE_KEY = 'sp-location'

export const initialLocation: LocationState = {
  cityId: DEFAULT_CITY,
  neighborhoodId: ALL_NEIGHBORHOODS,
  method: 'manual',
  updatedAt: null,
  rememberGps: false,
}

const withoutGps = (s: LocationState): LocationState => {
  const {lat: _a, lng: _b, accuracy: _c, address: _d, approximate: _e, ...rest} = s
  return {...rest, method: 'manual'}
}

export function locationReducer(state: LocationState, action: LocationAction): LocationState {
  const now = 'now' in action && action.now ? action.now : Date.now()
  switch (action.type) {
    case 'setCity': {
      if (!cityById(action.cityId)) return state
      if (action.cityId === state.cityId) return {...state, updatedAt: state.updatedAt ?? now}
      // Switching city: GPS position belongs to another city → drop it to avoid mixing areas.
      return {...withoutGps(state), cityId: action.cityId, neighborhoodId: ALL_NEIGHBORHOODS, updatedAt: now}
    }
    case 'setNeighborhood': {
      const ok = action.neighborhoodId === ALL_NEIGHBORHOODS || neighborhoodById(action.neighborhoodId)?.city === state.cityId
      return ok ? {...state, neighborhoodId: action.neighborhoodId, updatedAt: now} : state
    }
    case 'setGps': {
      const cityId = action.cityId && cityById(action.cityId) ? action.cityId : state.cityId
      const hood = action.neighborhoodId && neighborhoodById(action.neighborhoodId)?.city === cityId
        ? action.neighborhoodId : (cityId === state.cityId ? state.neighborhoodId : ALL_NEIGHBORHOODS)
      return {
        ...state, cityId, neighborhoodId: hood, method: 'gps', updatedAt: now,
        lat: action.lat, lng: action.lng, accuracy: action.accuracy, address: action.address, approximate: action.approximate,
      }
    }
    case 'setRememberGps':
      return {...state, rememberGps: action.value}
    case 'clearGps':
      return {...withoutGps(state), updatedAt: now}
    case 'reset':
      return {...initialLocation}
  }
}

/** What is written to localStorage. Coordinates only with explicit consent. */
export function serializeLocation(s: LocationState): string {
  const base = {cityId: s.cityId, neighborhoodId: s.neighborhoodId, updatedAt: s.updatedAt, rememberGps: s.rememberGps, method: 'manual' as LocationMethod}
  if (s.rememberGps && s.method === 'gps' && s.lat !== undefined && s.lng !== undefined) {
    return JSON.stringify({...base, method: 'gps', lat: s.lat, lng: s.lng, accuracy: s.accuracy, address: s.address, approximate: s.approximate})
  }
  return JSON.stringify(base)
}

export function loadLocation(storage: Pick<Storage, 'getItem'> = localStorage): LocationState {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<LocationState>
      const cityId = p.cityId && cityById(p.cityId) ? p.cityId : DEFAULT_CITY
      const hood = p.neighborhoodId && (p.neighborhoodId === ALL_NEIGHBORHOODS || neighborhoodById(p.neighborhoodId)?.city === cityId)
        ? p.neighborhoodId : ALL_NEIGHBORHOODS
      const state: LocationState = {...initialLocation, cityId, neighborhoodId: hood, updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : null, rememberGps: !!p.rememberGps}
      if (p.rememberGps && p.method === 'gps' && typeof p.lat === 'number' && typeof p.lng === 'number') {
        return {...state, method: 'gps', lat: p.lat, lng: p.lng, accuracy: p.accuracy, address: p.address, approximate: p.approximate}
      }
      return state
    }
    // Migrate the legacy `sp-city` preference (Arabic city name).
    const legacy = storage.getItem('sp-city')
    if (legacy) {
      const city = matchCity(JSON.parse(legacy))
      if (city) return {...initialLocation, cityId: city.id}
    }
  } catch { /* corrupted storage → defaults */ }
  return {...initialLocation}
}

/* ------------------------------ React ------------------------------ */
// The context and hook live here (not in LocationProvider.tsx) so that the
// provider file exports only a component, as React Fast Refresh requires.

export type LocationContextValue = {loc: LocationState; dispatch: Dispatch<LocationAction>}
export const LocationContext = createContext<LocationContextValue | null>(null)

export function useLocationState(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationState must be used inside <LocationProvider>')
  return ctx
}
