/**
 * Runtime configuration. Override any value with a Vite env variable
 * (e.g. in `.env.local`) — see `.env.example` and the README.
 */
const env = import.meta.env

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

export const config = {
  /** Reverse geocoding provider: 'nominatim' (OpenStreetMap, no key) or 'none'. */
  geocoderProvider: str(env.VITE_GEOCODER_PROVIDER, 'nominatim') as 'nominatim' | 'none',
  geocoderUrl: str(env.VITE_GEOCODER_URL, 'https://nominatim.openstreetmap.org'),
  /** Nearby supermarket discovery: 'overpass' (OpenStreetMap, no key) or 'none'. */
  placesProvider: str(env.VITE_PLACES_PROVIDER, 'overpass') as 'overpass' | 'none',
  placesUrl: str(env.VITE_OVERPASS_URL, 'https://overpass-api.de/api/interpreter'),
  /** Map tiles (Leaflet). Set VITE_MAP_TILE_URL='none' to disable the map. */
  mapTileUrl: str(env.VITE_MAP_TILE_URL, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  mapAttribution: str(env.VITE_MAP_ATTRIBUTION, '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'),
  /** A price older than this many days is shown as "outdated". */
  outdatedDays: Number(env.VITE_PRICE_OUTDATED_DAYS) > 0 ? Number(env.VITE_PRICE_OUTDATED_DAYS) : 30,
  /** Optional price-sync server (see src/lib/sync.ts). Empty = data stays on this device. */
  syncUrl: str(env.VITE_API_URL, '').replace(/\/$/, ''),
  /** GPS request timeout (ms). */
  gpsTimeoutMs: Number(env.VITE_GPS_TIMEOUT_MS) > 0 ? Number(env.VITE_GPS_TIMEOUT_MS) : 15000,
}

export type AppConfig = typeof config

/** Human-readable host names of third parties that may receive coordinates. */
export const providerHosts = () => {
  const host = (u: string) => { try { return new URL(u).host } catch { return u } }
  return {
    geocoder: config.geocoderProvider === 'none' ? null : host(config.geocoderUrl),
    places: config.placesProvider === 'none' ? null : host(config.placesUrl),
    tiles: config.mapTileUrl === 'none' ? null : host(config.mapTileUrl.replace(/\{s\}\./, '')),
  }
}
