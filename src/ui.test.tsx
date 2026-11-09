// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import App from './App'

vi.mock('./components/StoreMap', () => ({default: () => null}))

type GeoImpl = (ok: PositionCallback, err: PositionErrorCallback) => void
const setGeo = (impl?: GeoImpl) => Object.defineProperty(navigator, 'geolocation', {
  configurable: true,
  value: impl ? {getCurrentPosition: (ok: PositionCallback, err: PositionErrorCallback) => impl(ok, err)} : undefined,
})
const granted: GeoImpl = ok => ok({coords: {latitude: 33.589, longitude: -7.632, accuracy: 18}} as GeolocationPosition)
const errorCode = (code: number): GeoImpl => (_, err) => err({code} as GeolocationPositionError)

const nominatim = {address: {city: 'Casablanca', suburb: 'Maârif', road: 'Boulevard Zerktouni', country_code: 'ma'}, display_name: 'Casablanca'}
const overpass = {elements: [
  {type: 'node', id: 1, lat: 33.592, lon: -7.635, tags: {shop: 'supermarket', name: 'Marjane Market Maarif', brand: 'Marjane'}},
  {type: 'node', id: 2, tags: {shop: 'supermarket', name: 'Sans coordonnées'}},
  {type: 'node', id: 3, lat: 33.70, lon: -7.40, tags: {shop: 'supermarket', name: 'Loin du centre'}},
]}
const mockFetch = (mode: 'ok' | 'offline' = 'ok') => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  if (mode === 'offline') throw new TypeError('Failed to fetch')
  const body = String(url).includes('overpass') ? overpass : nominatim
  return new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}})
}))

const body = () => document.body.textContent || ''
const dialog = () => screen.getByRole('dialog')
const openLocation = () => fireEvent.click(screen.getAllByRole('button', {name: /تغيير الموقع|Changer de position/})[0])
const pickFromCombo = (index: number, text: string) => {
  const input = within(dialog()).getAllByRole('combobox')[index]
  fireEvent.focus(input)
  fireEvent.change(input, {target: {value: text}})
  fireEvent.mouseDown(within(dialog()).getAllByRole('option')[0])
}

beforeEach(() => { localStorage.clear(); setGeo(undefined); mockFetch() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Arabic / French interface', () => {
  it('starts in Arabic RTL and switches to French LTR', () => {
    render(<App />)
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getAllByText('المتاجر القريبة').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTitle('Language / اللغة'))
    expect(document.documentElement.dir).toBe('ltr')
    expect(screen.getAllByText('À proximité').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Casablanca').length).toBeGreaterThan(0)
  })
})

describe('manual location', () => {
  it('selects a city by Arabic search and isolates prices by city', () => {
    render(<App />)
    expect(body()).toContain('16.70 DH') // Casablanca: oil @ Atacadão
    openLocation()
    pickFromCombo(0, 'فاس')
    expect(body()).toContain('لا توجد أثمنة مسجلة في فاس بعد')
    expect(body()).not.toContain('16.70 DH')
    expect(body()).toContain('غير متوفر')
    pickFromCombo(0, 'Rabat')
    expect(body()).toContain('17.20 DH')
    expect(body()).not.toContain('16.70 DH') // never shows Casablanca prices in Rabat
    expect(JSON.parse(localStorage.getItem('sp-location')!).cityId).toBe('rabat')
  })

  it('selects and clears a neighborhood', () => {
    render(<App />)
    openLocation()
    pickFromCombo(1, 'معاريف')
    expect(JSON.parse(localStorage.getItem('sp-location')!).neighborhoodId).toBe('casablanca:maarif')
    expect(body()).toContain('الدار البيضاء · المعاريف')
    pickFromCombo(1, 'جميع')
    expect(JSON.parse(localStorage.getItem('sp-location')!).neighborhoodId).toBe('all')
  })

  it('resets the location', () => {
    render(<App />)
    openLocation()
    pickFromCombo(0, 'Oujda')
    fireEvent.click(within(dialog()).getByText('إعادة تعيين الموقع'))
    expect(JSON.parse(localStorage.getItem('sp-location')!).cityId).toBe('casablanca')
  })
})

describe('GPS location', () => {
  it('never requests GPS on page load', () => {
    const spy = vi.fn()
    setGeo(spy)
    render(<App />)
    openLocation()
    expect(spy).not.toHaveBeenCalled()
  })

  it('locates the user after an explicit click (permission granted)', async () => {
    setGeo(granted)
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    expect(await within(dialog()).findByText('الدار البيضاء · المعاريف')).toBeTruthy()
    expect(body()).toContain('Zerktouni')
    expect(screen.getAllByText('GPS').length).toBeGreaterThan(0)
    // No consent → coordinates are not written to storage.
    const saved = JSON.parse(localStorage.getItem('sp-location')!)
    expect(saved.lat).toBeUndefined()
    expect(saved.neighborhoodId).toBe('casablanca:maarif')
  })

  it('stores coordinates only when the user opts in', async () => {
    setGeo(granted)
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByRole('checkbox'))
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    await within(dialog()).findByText('الدار البيضاء · المعاريف')
    expect(JSON.parse(localStorage.getItem('sp-location')!)).toMatchObject({lat: 33.589, lng: -7.632, method: 'gps'})
  })

  it('handles denied permission with a manual fallback', async () => {
    setGeo(errorCode(1))
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    const alert = await within(dialog()).findByRole('alert')
    expect(alert.textContent).toContain('تم رفض إذن الموقع')
    fireEvent.click(within(alert).getByText('اختيار يدوي'))
    expect(within(dialog()).queryByRole('alert')).toBeNull()
  })

  it('handles GPS timeout', async () => {
    setGeo(errorCode(3))
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    expect((await within(dialog()).findByRole('alert')).textContent).toContain('انتهت مهلة')
  })

  it('handles unsupported browsers', async () => {
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    expect((await within(dialog()).findByRole('alert')).textContent).toContain('لا يدعم')
  })

  it('works offline: estimates the nearest city when the address lookup fails', async () => {
    setGeo(granted)
    mockFetch('offline')
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    expect(await within(dialog()).findByText(/تعذر جلب العنوان/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('sp-location')!).cityId).toBe('casablanca')
    // Stored prices remain usable offline.
    expect(body()).toContain('16.70 DH')
  })

  it('switching city manually drops GPS coordinates', async () => {
    setGeo(granted)
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    await within(dialog()).findByText('الدار البيضاء · المعاريف')
    pickFromCombo(0, 'Rabat')
    expect(screen.queryAllByText('GPS').filter(e => e.classList.contains('gps-tag'))).toHaveLength(0)
  })
})

describe('nearby stores', () => {
  it('shows distances only for stores with real coordinates and filters by radius', async () => {
    setGeo(granted)
    render(<App />)
    openLocation()
    fireEvent.click(within(dialog()).getByText('تحديد موقعي'))
    await within(dialog()).findByText('الدار البيضاء · المعاريف')
    fireEvent.click(within(dialog()).getByText('تم'))
    fireEvent.click(screen.getAllByText('المتاجر القريبة')[0])
    fireEvent.click(screen.getByText('ابحث عن المتاجر القريبة'))
    expect(await screen.findByText('Marjane Market Maarif')).toBeTruthy()
    expect(body()).not.toContain('Sans coordonnées') // no coordinates → not invented
    expect(body()).not.toContain('Loin du centre') // ~25 km → outside the 5 km radius
    fireEvent.click(screen.getByRole('radio', {name: '20 km'}))
    expect(screen.queryByText('Loin du centre')).toBeNull() // still > 20 km
    // Overpass received rounded coordinates only.
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(c => String(c[0]).includes('overpass'))!
    expect(decodeURIComponent(String((call[1] as RequestInit).body))).toContain('33.589,-7.632')
  })

  it('without GPS, asks the user to locate instead of inventing distances', () => {
    render(<App />)
    fireEvent.click(screen.getAllByText('المتاجر القريبة')[0])
    expect(body()).toContain('فعّل تحديد الموقع')
    expect(document.querySelectorAll('.dist-chip:not(.muted-chip)')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})
