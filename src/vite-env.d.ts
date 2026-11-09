/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEOCODER_PROVIDER?: string
  readonly VITE_GEOCODER_URL?: string
  readonly VITE_PLACES_PROVIDER?: string
  readonly VITE_OVERPASS_URL?: string
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_ATTRIBUTION?: string
  readonly VITE_PRICE_OUTDATED_DAYS?: string
  readonly VITE_GPS_TIMEOUT_MS?: string
  readonly VITE_API_URL?: string
}
