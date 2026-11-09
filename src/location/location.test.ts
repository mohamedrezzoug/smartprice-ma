import {describe, it, expect, vi} from 'vitest'
import {distanceKm, matchCity, matchNeighborhood, nearestCity, searchCities, searchNeighborhoods} from './geo'
import {GpsError, getCurrentPosition, resolveLocation} from './geolocate'
import {PROVIDER_TIMEOUT_MS, ProviderError, createOverpassPlaces, matchChain, parseNominatim, parseOverpass, type GeocoderAdapter} from './providers'
import {moroccanCities, neighborhoods, neighborhoodsOf, regions} from './regions'
import {initialLocation, loadLocation, locationReducer, serializeLocation, STORAGE_KEY, type LocationState} from './state'

describe('regions & cities', () => {
  it('covers the 12 administrative regions, each with cities', () => {
    expect(regions).toHaveLength(12)
    for (const r of regions) expect(moroccanCities.some(c => c.region === r.id)).toBe(true)
    expect(new Set(moroccanCities.map(c => c.id)).size).toBe(moroccanCities.length)
  })
  it('has starter neighborhoods for the 10 main cities', () => {
    for (const id of ['casablanca', 'rabat', 'sale', 'fes', 'marrakech', 'tanger', 'oujda', 'agadir', 'meknes', 'kenitra']) {
      expect(neighborhoodsOf(id).length).toBeGreaterThanOrEqual(5)
    }
    expect(new Set(neighborhoods.map(n => n.id)).size).toBe(neighborhoods.length)
  })
})

describe('manual city search (Arabic & French)', () => {
  it('finds cities by French name, accent-insensitive', () => {
    expect(searchCities('fes')[0].id).toBe('fes')
    expect(searchCities('Meknes')[0].id).toBe('meknes')
    expect(searchCities('kenit')[0].id).toBe('kenitra')
    expect(searchCities('tangier')[0].id).toBe('tanger')
  })
  it('finds cities by Arabic name, hamza-insensitive', () => {
    expect(searchCities('الرباط')[0].id).toBe('rabat')
    expect(searchCities('اكادير')[0].id).toBe('agadir')
    expect(searchCities('مراك')[0].id).toBe('marrakech')
  })
  it('returns nothing for unknown names', () => {
    expect(searchCities('Atlantis')).toEqual([])
  })
  it('searches neighborhoods within a city', () => {
    const casa = neighborhoodsOf('casablanca')
    expect(searchNeighborhoods('maarif', casa).map(n => n.id)).toEqual(['casablanca:maarif'])
    expect(searchNeighborhoods('المعاريف', casa).map(n => n.id)).toEqual(['casablanca:maarif'])
  })
  it('matches geocoder names to known cities and neighborhoods', () => {
    expect(matchCity('Casablanca')?.id).toBe('casablanca')
    expect(matchCity('الدار البيضاء')?.id).toBe('casablanca')
    expect(matchCity('Préfecture de Rabat')?.id).toBe('rabat')
    expect(matchCity('Nowhere')).toBeUndefined()
    expect(matchNeighborhood('casablanca', 'Maârif Extension')?.id).toBe('casablanca:maarif')
  })
})

describe('geometry', () => {
  it('computes realistic distances (Casablanca → Rabat ≈ 87 km)', () => {
    const d = distanceKm({lat: 33.5731, lng: -7.5898}, {lat: 34.0209, lng: -6.8416})
    expect(d).toBeGreaterThan(80)
    expect(d).toBeLessThan(95)
  })
  it('finds the nearest city centre', () => {
    expect(nearestCity({lat: 33.58, lng: -7.62}).city.id).toBe('casablanca')
  })
})

describe('location state', () => {
  const s0: LocationState = {...initialLocation}
  it('selects a city manually and resets the neighborhood', () => {
    const s1 = locationReducer({...s0, neighborhoodId: 'casablanca:maarif'}, {type: 'setCity', cityId: 'rabat', now: 1})
    expect(s1).toMatchObject({cityId: 'rabat', neighborhoodId: 'all', method: 'manual', updatedAt: 1})
  })
  it('ignores unknown cities', () => {
    expect(locationReducer(s0, {type: 'setCity', cityId: 'atlantis'})).toBe(s0)
  })
  it('selects a neighborhood of the current city only', () => {
    const s1 = locationReducer(s0, {type: 'setNeighborhood', neighborhoodId: 'casablanca:anfa', now: 2})
    expect(s1.neighborhoodId).toBe('casablanca:anfa')
    expect(locationReducer(s0, {type: 'setNeighborhood', neighborhoodId: 'rabat:agdal'})).toBe(s0)
    expect(locationReducer(s1, {type: 'setNeighborhood', neighborhoodId: 'all'}).neighborhoodId).toBe('all')
  })
  it('stores GPS results and drops them when switching city (no area mixing)', () => {
    const gps = locationReducer(s0, {type: 'setGps', lat: 34.02, lng: -6.84, accuracy: 25, cityId: 'rabat', neighborhoodId: 'rabat:agdal', now: 3})
    expect(gps).toMatchObject({method: 'gps', cityId: 'rabat', neighborhoodId: 'rabat:agdal', lat: 34.02, accuracy: 25, updatedAt: 3})
    const switched = locationReducer(gps, {type: 'setCity', cityId: 'fes'})
    expect(switched.lat).toBeUndefined()
    expect(switched.method).toBe('manual')
  })
  it('clears GPS or resets everything', () => {
    const gps = locationReducer(s0, {type: 'setGps', lat: 33.6, lng: -7.6, accuracy: 10, cityId: 'casablanca'})
    const cleared = locationReducer(gps, {type: 'clearGps'})
    expect(cleared).toMatchObject({method: 'manual', cityId: 'casablanca'})
    expect('lat' in cleared || 'lng' in cleared || 'accuracy' in cleared).toBe(false)
    expect(locationReducer(gps, {type: 'reset'})).toEqual(initialLocation)
  })
  it('persists coordinates ONLY with consent', () => {
    const gps = locationReducer(s0, {type: 'setGps', lat: 33.6, lng: -7.6, accuracy: 10, cityId: 'casablanca'})
    const noConsent = JSON.parse(serializeLocation(gps))
    expect(noConsent.lat).toBeUndefined()
    expect(noConsent.method).toBe('manual')
    const withConsent = JSON.parse(serializeLocation({...gps, rememberGps: true}))
    expect(withConsent).toMatchObject({lat: 33.6, lng: -7.6, method: 'gps'})
  })
  it('loads saved preferences and migrates the legacy city', () => {
    const mem = (o: Record<string, string>) => ({getItem: (k: string) => o[k] ?? null})
    expect(loadLocation(mem({[STORAGE_KEY]: serializeLocation({...s0, cityId: 'oujda', neighborhoodId: 'oujda:lazaret'})}))).toMatchObject({cityId: 'oujda', neighborhoodId: 'oujda:lazaret'})
    expect(loadLocation(mem({'sp-city': JSON.stringify('مراكش')})).cityId).toBe('marrakech')
    expect(loadLocation(mem({[STORAGE_KEY]: '{bad json'})).cityId).toBe('casablanca')
  })
})

describe('GPS', () => {
  const fakeGeo = (impl: (ok: PositionCallback, err: PositionErrorCallback) => void) =>
    ({getCurrentPosition: vi.fn((ok: PositionCallback, err: PositionErrorCallback) => impl(ok, err))} as unknown as Geolocation)
  const pos = (lat: number, lng: number, accuracy: number) => ({coords: {latitude: lat, longitude: lng, accuracy}} as GeolocationPosition)
  const posErr = (code: number) => ({code} as GeolocationPositionError)

  it('returns coordinates when permission is granted', async () => {
    const fix = await getCurrentPosition(1000, {geolocation: fakeGeo(ok => ok(pos(33.59, -7.63, 12))), secure: true})
    expect(fix).toEqual({lat: 33.59, lng: -7.63, accuracy: 12})
  })
  it('reports denied permission', async () => {
    await expect(getCurrentPosition(1000, {geolocation: fakeGeo((_, err) => err(posErr(1))), secure: true})).rejects.toMatchObject({code: 'denied'})
  })
  it('reports timeout from the browser', async () => {
    await expect(getCurrentPosition(1000, {geolocation: fakeGeo((_, err) => err(posErr(3))), secure: true})).rejects.toMatchObject({code: 'timeout'})
  })
  it('enforces its own timeout when the browser never answers', async () => {
    vi.useFakeTimers()
    const p = getCurrentPosition(500, {geolocation: fakeGeo(() => { /* never answers */ }), secure: true})
    vi.advanceTimersByTime(3000)
    await expect(p).rejects.toMatchObject({code: 'timeout'})
    vi.useRealTimers()
  })
  it('reports unavailable position, insecure context and missing API', async () => {
    await expect(getCurrentPosition(1000, {geolocation: fakeGeo((_, err) => err(posErr(2))), secure: true})).rejects.toMatchObject({code: 'unavailable'})
    await expect(getCurrentPosition(1000, {geolocation: fakeGeo(ok => ok(pos(1, 1, 1))), secure: false})).rejects.toBeInstanceOf(GpsError)
    await expect(getCurrentPosition(1000, {geolocation: undefined, secure: true})).rejects.toMatchObject({code: 'unsupported'})
  })
})

describe('reverse geocoding resolution', () => {
  const fix = {lat: 33.589, lng: -7.632, accuracy: 20}
  it('uses the geocoder result (city + neighborhood + address)', async () => {
    const geo: GeocoderAdapter = {name: 'mock', reverse: async () => parseNominatim({city: 'Casablanca', suburb: 'Maârif', road: 'Boulevard Zerktouni', country_code: 'ma'})}
    const r = await resolveLocation(fix, geo, 'fr')
    expect(r).toMatchObject({cityId: 'casablanca', neighborhoodId: 'casablanca:maarif', approximate: false, lookup: 'ok', outside: false})
    expect(r.address).toContain('Zerktouni')
  })
  it('falls back to the nearest city when offline (network error)', async () => {
    const geo: GeocoderAdapter = {name: 'mock', reverse: async () => { throw new ProviderError('network') }}
    const r = await resolveLocation(fix, geo, 'ar')
    expect(r).toMatchObject({cityId: 'casablanca', approximate: true, lookup: 'failed'})
    expect(r.neighborhoodId).toBeUndefined()
  })
  it('detects positions outside Morocco', async () => {
    const geo: GeocoderAdapter = {name: 'mock', reverse: async () => parseNominatim({city: 'Paris', country_code: 'fr'})}
    expect((await resolveLocation({lat: 48.85, lng: 2.35, accuracy: 10}, geo, 'fr')).outside).toBe(true)
    const offline: GeocoderAdapter = {name: 'mock', reverse: async () => { throw new ProviderError('network') }}
    const r = await resolveLocation({lat: 48.85, lng: 2.35, accuracy: 10}, offline, 'fr')
    expect(r.cityId).toBeUndefined()
    expect(r.outside).toBe(true)
  })
})

describe('nearby store parsing', () => {
  it('keeps only elements with real coordinates and matches chains', () => {
    const places = parseOverpass([
      {type: 'node', id: 1, lat: 33.59, lon: -7.63, tags: {shop: 'supermarket', name: 'Marjane Market', 'addr:street': 'Bd Zerktouni'}},
      {type: 'way', id: 2, center: {lat: 33.6, lon: -7.6}, tags: {shop: 'supermarket', brand: 'BIM', name: 'BIM Maarif'}},
      {type: 'node', id: 3, tags: {shop: 'supermarket', name: 'No coords'}},
      {type: 'node', id: 4, lat: 0, lon: 0, tags: {shop: 'supermarket', name: 'Null island'}},
      {type: 'node', id: 5, lat: 33.61, lon: -7.61, tags: {shop: 'supermarket', name: 'Épicerie du coin'}},
    ])
    expect(places.map(p => p.id)).toEqual(['osm:node/1', 'osm:way/2', 'osm:node/5'])
    expect(places.map(p => p.chainId)).toEqual(['marjane', 'bim', undefined])
  })
  it('matches chain names in Arabic and French', () => {
    expect(matchChain('أسواق السلام')).toBe('aswak')
    expect(matchChain('Carrefour Market')).toBe('carrefour')
    expect(matchChain('Bimbo bakery')).toBeUndefined()
  })
})

describe('provider network errors', () => {
  const hanging = () => vi.fn((_: string, init: RequestInit) => new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  }))
  it('times out slow services instead of hanging forever', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hanging())
    const p = createOverpassPlaces('https://example.test/api').nearbySupermarkets({lat: 33.5, lng: -7.6}, 5)
    const check = expect(p).rejects.toMatchObject({kind: 'timeout'})
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS + 10)
    await check
    vi.useRealTimers(); vi.unstubAllGlobals()
  })
  it('reports offline network errors and HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(createOverpassPlaces('https://example.test/api').nearbySupermarkets({lat: 33.5, lng: -7.6}, 5)).rejects.toMatchObject({kind: 'network'})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', {status: 429})))
    await expect(createOverpassPlaces('https://example.test/api').nearbySupermarkets({lat: 33.5, lng: -7.6}, 5)).rejects.toMatchObject({kind: 'http'})
    vi.unstubAllGlobals()
  })
})
