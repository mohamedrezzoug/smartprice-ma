import {useEffect, useRef, useState} from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {config} from '../config'
import type {T} from '../i18n'

export type MapMarker = {id: string; lat: number; lng: number; title: string; subtitle?: string; tint?: string}

type Props = {
  center: [number, number]
  /** User position — only passed when the user granted GPS. */
  user?: {lat: number; lng: number; accuracy?: number}
  markers: MapMarker[]
  radiusKm?: number
  selectedId?: string | null
  onSelect?: (id: string) => void
  t: T
}

const pinIcon = (L: typeof Leaflet, tint = '#10b981', selected = false) => L.divIcon({
  className: 'pin3d-wrap',
  html: `<div class="pin3d${selected ? ' sel' : ''}" style="--tint:${/^#[0-9a-f]{3,8}$/i.test(tint) ? tint : '#10b981'}"><span></span></div>`,
  iconSize: [34, 44], iconAnchor: [17, 42], popupAnchor: [0, -38],
})

/** Builds popup content with textContent (no HTML injection from OSM names). */
const popupNode = (title: string, subtitle?: string) => {
  const el = document.createElement('div')
  el.className = 'map-pop'
  const b = document.createElement('b'); b.textContent = title; el.appendChild(b)
  if (subtitle) { const s = document.createElement('small'); s.textContent = subtitle; el.appendChild(s) }
  return el
}

/** OpenStreetMap + Leaflet map. Leaflet is loaded lazily so it does not weigh on the main bundle. */
export default function StoreMap({center, user, markers, radiusKm, selectedId, onSelect, t}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const layer = useRef<Leaflet.LayerGroup | null>(null)
  const lib = useRef<typeof Leaflet | null>(null)
  const refs = useRef(new Map<string, Leaflet.Marker>())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('leaflet').then(mod => {
      if (cancelled || !el.current) return
      const L = (mod as unknown as {default?: typeof Leaflet}).default ?? (mod as unknown as typeof Leaflet)
      lib.current = L
      const m = L.map(el.current, {zoomControl: true, scrollWheelZoom: false}).setView(center, 12)
      L.tileLayer(config.mapTileUrl, {attribution: config.mapAttribution, maxZoom: 19}).addTo(m)
      layer.current = L.layerGroup().addTo(m)
      map.current = m
      setReady(true)
    }).catch(() => setFailed(true))
    return () => { cancelled = true; map.current?.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw markers whenever data changes.
  useEffect(() => {
    const L = lib.current, m = map.current, g = layer.current
    if (!ready || !L || !m || !g) return
    g.clearLayers()
    refs.current.clear()
    const pts: Leaflet.LatLngExpression[] = []
    if (user) {
      if (user.accuracy) L.circle([user.lat, user.lng], {radius: user.accuracy, color: '#10b981', weight: 1, fillOpacity: .08}).addTo(g)
      if (radiusKm) L.circle([user.lat, user.lng], {radius: radiusKm * 1000, color: '#047857', weight: 1.5, dashArray: '6 6', fill: false}).addTo(g)
      L.marker([user.lat, user.lng], {
        icon: L.divIcon({className: 'me-wrap', html: '<div class="me-dot"><i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11]}),
        title: t('موقعي', 'Ma position'), zIndexOffset: 1000,
      }).bindPopup(popupNode(t('موقعي', 'Ma position'))).addTo(g)
      pts.push([user.lat, user.lng])
    }
    for (const mk of markers) {
      const marker = L.marker([mk.lat, mk.lng], {icon: pinIcon(L, mk.tint, mk.id === selectedId), title: mk.title})
        .bindPopup(popupNode(mk.title, mk.subtitle))
        .on('click', () => onSelect?.(mk.id))
        .addTo(g)
      refs.current.set(mk.id, marker)
      pts.push([mk.lat, mk.lng])
    }
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), {padding: [36, 36], maxZoom: 15})
    else if (pts.length === 1) m.setView(pts[0], 14)
    else m.setView(center, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.lat, user?.lng, user?.accuracy, markers, radiusKm, center[0], center[1]])

  useEffect(() => {
    if (!ready || !selectedId) return
    const mk = refs.current.get(selectedId)
    if (mk && map.current) { map.current.flyTo(mk.getLatLng(), Math.max(map.current.getZoom(), 15), {duration: .6}); mk.openPopup() }
  }, [selectedId, ready])

  if (failed) return <div className="map-fallback">{t('تعذر تحميل الخريطة.', 'Impossible de charger la carte.')}</div>
  return <div className="store-map" ref={el} role="region" aria-label={t('خريطة المتاجر', 'Carte des magasins')}>
    {!ready && <div className="map-loading"><span className="dots"><i /><i /><i /></span></div>}
  </div>
}
