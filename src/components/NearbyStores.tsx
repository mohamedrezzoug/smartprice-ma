import {lazy, Suspense, useEffect, useMemo, useState, type CSSProperties} from 'react'
import {AlertTriangle, Crosshair, Crown, MapPin, Navigation, Radar, RefreshCw, ShoppingBasket, Store as StoreIcon, WifiOff} from 'lucide-react'
import {config, providerHosts} from '../config'
import type {Branch, Product} from '../data'
import {stores} from '../data'
import {money, type Lang, type T} from '../i18n'
import {Gps3D} from '../illustrations'
import {distanceKm, formatKm} from '../location/geo'
import {ProviderError, createPlaces, type Place, type PlacesAdapter, type ProviderErrorKind} from '../location/providers'
import {DEFAULT_RADIUS_KM, RADII, type RadiusKm} from '../location/constants'
import {ALL_NEIGHBORHOODS, cityById, neighborhoodById} from '../location/regions'
import {useLocationState} from '../location/state'
import {compareBasket, storesInIndex, type BasketLine, type PriceIndex, type StoreBasket} from '../pricing'
import type {MapMarker} from './StoreMap'

const StoreMap = lazy(() => import('./StoreMap'))

type Item = {
  id: string
  name: string
  chainId?: string
  address?: string
  neighborhoodId?: string
  lat?: number
  lng?: number
  source: 'local' | 'osm'
  distance?: number
}

type Props = {
  t: T
  lang: Lang
  branches: Branch[]
  index: PriceIndex
  products: Product[]
  cart: BasketLine[]
  onOpenLocation: () => void
  places?: PlacesAdapter
}

export function NearbyStores({t, lang, branches, index, products, cart, onOpenLocation, places}: Props) {
  const {loc} = useLocationState()
  const ar = lang === 'ar'
  const hasGps = loc.method === 'gps' && loc.lat !== undefined && loc.lng !== undefined
  const me = hasGps ? {lat: loc.lat!, lng: loc.lng!} : undefined
  const city = cityById(loc.cityId)
  const hosts = providerHosts()
  const adapter = useMemo(() => places ?? createPlaces(), [places])
  const [radius, setRadius] = useState<RadiusKm>(DEFAULT_RADIUS_KM)
  const [selected, setSelected] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [osm, setOsm] = useState<{status: 'idle' | 'loading' | 'done' | 'error'; places: Place[]; error?: ProviderErrorKind}>({status: 'idle', places: []})

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  // New position or city → previous OSM results are no longer relevant.
  useEffect(() => { setOsm({status: 'idle', places: []}); setSelected(null) }, [loc.lat, loc.lng, loc.cityId])

  const searchOsm = async () => {
    if (!me) return
    setOsm({status: 'loading', places: []})
    try {
      const found = await adapter.nearbySupermarkets(me, Math.max(...RADII))
      setOsm({status: 'done', places: found})
    } catch (e) {
      setOsm({status: 'error', places: [], error: e instanceof ProviderError ? e.kind : 'network'})
    }
  }

  const chainName = (id?: string) => { const s = stores.find(x => x.id === id); return s ? (ar ? s.name : s.nameFr) : undefined }
  const chainTint = (id?: string) => stores.find(x => x.id === id)?.tint

  const items: Item[] = useMemo(() => {
    const local: Item[] = branches
      .filter(b => b.cityId === loc.cityId)
      .filter(b => loc.neighborhoodId === ALL_NEIGHBORHOODS || !b.neighborhoodId || b.neighborhoodId === loc.neighborhoodId)
      .map(b => ({id: b.id, name: b.name || chainName(b.storeId) || b.storeId, chainId: b.storeId, address: b.address, neighborhoodId: b.neighborhoodId, lat: b.lat, lng: b.lng, source: 'local'}))
    const fromOsm: Item[] = osm.places.map(p => ({id: p.id, name: p.name, chainId: p.chainId, address: p.address, lat: p.lat, lng: p.lng, source: 'osm'}))
    return [...local, ...fromOsm].map(it => ({
      ...it,
      // Distance ONLY when both points are real coordinates.
      distance: me && it.lat !== undefined && it.lng !== undefined ? distanceKm(me, {lat: it.lat, lng: it.lng}) : undefined,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, osm.places, loc.cityId, loc.neighborhoodId, me?.lat, me?.lng, ar])

  const inRange = items.filter(i => i.distance !== undefined && i.distance <= radius).sort((a, b) => a.distance! - b.distance!)
  const outOfRange = items.filter(i => i.distance !== undefined && i.distance > radius).length
  const withoutDistance = items.filter(i => i.distance === undefined)

  const comparison = useMemo(() => compareBasket(cart, index), [cart, index])
  const basketByChain = useMemo(() => {
    const m = new Map<string, StoreBasket>()
    for (const b of [...comparison.complete, ...comparison.partial]) m.set(b.storeId, b)
    return m
  }, [comparison])
  const availableCount = (chainId?: string) => chainId ? products.filter(p => index.get(p.id)?.has(chainId)).length : 0

  const bestNearby = inRange
    .map(i => ({item: i, basket: i.chainId ? basketByChain.get(i.chainId) : undefined}))
    .filter(x => x.basket?.complete)
    .sort((a, b) => a.basket!.total - b.basket!.total || a.item.distance! - b.item.distance!)[0]

  const chainsWithoutLocation = storesInIndex(index).filter(id => !items.some(i => i.chainId === id && i.lat !== undefined))

  const mapItems = (hasGps ? inRange : items.filter(i => i.lat !== undefined))
  const markers: MapMarker[] = useMemo(() => mapItems.map(i => ({
    id: i.id, lat: i.lat!, lng: i.lng!, title: i.name, tint: chainTint(i.chainId),
    subtitle: [i.address, i.distance !== undefined ? formatKm(i.distance) : undefined].filter(Boolean).join(' · '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [mapItems.map(i => i.id).join('|'), radius])

  const errorText = (k?: ProviderErrorKind) =>
    k === 'disabled' ? t('البحث عن المتاجر غير مفعل في الإعدادات.', 'La recherche de magasins est désactivée dans la configuration.')
      : k === 'http' || k === 'timeout' ? t('خدمة OpenStreetMap مشغولة أو بطيئة حالياً. حاول بعد قليل.', 'Le service OpenStreetMap est saturé ou lent. Réessayez dans un instant.')
        : t('تعذر الاتصال بالخدمة. تحقق من الإنترنت.', 'Connexion au service impossible. Vérifiez votre connexion.')

  const card = (i: Item) => {
    const basket = i.chainId ? basketByChain.get(i.chainId) : undefined
    const count = availableCount(i.chainId)
    const hood = i.neighborhoodId ? neighborhoodById(i.neighborhoodId) : undefined
    return (
      <article key={i.id} className={`near-card glass ${selected === i.id ? 'sel' : ''}`} onClick={() => i.lat !== undefined && setSelected(i.id)}>
        <div className="near-top">
          <span className="near-logo" style={{'--tint': chainTint(i.chainId) || '#94a3b8'} as CSSProperties}><StoreIcon size={18} /></span>
          <div className="near-name">
            <b>{i.name}</b>
            <small>{i.address || (hood ? (ar ? hood.ar : hood.fr) : t('العنوان غير متوفر', 'Adresse non disponible'))}</small>
          </div>
          {i.distance !== undefined
            ? <span className="dist-chip"><Navigation size={13} />{formatKm(i.distance)}</span>
            : <span className="dist-chip muted-chip">{t('المسافة غير معروفة', 'Distance inconnue')}</span>}
        </div>
        <div className="near-meta">
          <span className={`src-badge ${i.source}`}>{i.source === 'osm' ? 'OpenStreetMap' : t('مضاف محلياً', 'Ajout local')}</span>
          {i.chainId && chainName(i.chainId) && i.source === 'osm' && <span className="src-badge chain">{chainName(i.chainId)}</span>}
          <span className="avail">{i.chainId && count > 0
            ? t(`${count}/${products.length} منتج بثمن مسجل`, `${count}/${products.length} produits avec prix`)
            : t('لا توجد أثمنة مسجلة لهذا المتجر', 'Aucun prix enregistré pour ce magasin')}</span>
        </div>
        {cart.length > 0 && <div className={`near-basket ${basket?.complete ? 'full' : basket ? 'part' : 'none'}`}>
          <ShoppingBasket size={15} />
          {basket ? <>
            <span>{basket.complete ? t('القفة كاملة', 'Panier complet') : t(`متوفر ${basket.available.length}/${cart.length}`, `${basket.available.length}/${cart.length} disponibles`)}</span>
            <b>{money(basket.total)}</b>
          </> : <span>{t('غير متوفر', 'Non disponible')}</span>}
        </div>}
      </article>
    )
  }

  return (
    <div className="nearby view">
      <section className="nearby-head glass">
        <Gps3D className="nearby-gps" active={osm.status === 'loading'} />
        <div className="nearby-intro">
          <h2>{t('المتاجر القريبة', 'Magasins à proximité')}</h2>
          <p className="muted">
            {hasGps
              ? t(`موقعك محدد بالـ GPS في ${city?.ar ?? ''}. المسافات محسوبة فقط للمتاجر ذات إحداثيات حقيقية.`, `Position GPS à ${city?.fr ?? ''}. Les distances ne sont calculées que pour les magasins aux coordonnées réelles.`)
              : t('فعّل تحديد الموقع لترتيب المتاجر حسب المسافة. بدون GPS نعرض متاجر المدينة دون مسافات.', 'Activez la localisation pour trier par distance. Sans GPS, les magasins de la ville sont affichés sans distance.')}
          </p>
          <div className="nearby-actions">
            {!hasGps && <button className="primary" onClick={onOpenLocation}><Crosshair size={17} />{t('تحديد موقعي', 'Me localiser')}</button>}
            {hasGps && <button className="primary" onClick={searchOsm} disabled={osm.status === 'loading' || !online || config.placesProvider === 'none'}>
              {osm.status === 'loading' ? <RefreshCw size={17} className="spin" /> : <Radar size={17} />}
              {osm.status === 'done' ? t('تحديث البحث', 'Relancer la recherche') : t('ابحث عن المتاجر القريبة', 'Chercher les magasins proches')}
            </button>}
            {hasGps && <div className="radius" role="radiogroup" aria-label={t('المسافة', 'Distance')}>
              {RADII.map(r => <button key={r} role="radio" aria-checked={radius === r} className={radius === r ? 'on' : ''} onClick={() => setRadius(r)}>{r} km</button>)}
            </div>}
          </div>
          {hasGps && hosts.places && <p className="privacy-note"><MapPin size={13} />{t(`عند البحث تُرسل إحداثيات تقريبية (حوالي 100 م) إلى ${hosts.places} (OpenStreetMap).`, `La recherche envoie des coordonnées arrondies (~100 m) à ${hosts.places} (OpenStreetMap).`)}</p>}
          {!online && <p className="offline-note"><WifiOff size={14} />{t('أنت غير متصل: البحث والخريطة يحتاجان الإنترنت. الأثمنة المحفوظة تبقى متاحة.', 'Hors ligne : la recherche et la carte nécessitent Internet. Les prix enregistrés restent disponibles.')}</p>}
          {osm.status === 'error' && <p className="gps-error inline" role="alert"><AlertTriangle size={16} />{errorText(osm.error)}</p>}
        </div>
      </section>

      {cart.length > 0 && hasGps && <div className={`nearby-best glass ${bestNearby ? '' : 'empty-best'}`}>
        <Crown size={20} />
        {bestNearby
          ? <span>{t('أرخص قفة كاملة قريبة', 'Panier complet le moins cher à proximité')}: <b>{bestNearby.item.name}</b> · {formatKm(bestNearby.item.distance!)} · <b>{money(bestNearby.basket!.total)}</b></span>
          : <span>{t(`لا يوجد متجر قريب (${radius} كم) بأثمنة لكل منتجات قفتك.`, `Aucun magasin à ${radius} km n’a des prix pour tout votre panier.`)}</span>}
      </div>}

      <div className="nearby-grid">
        <div className="nearby-list">
          {hasGps && <>
            <div className="section-head"><div><h2>{t(`ضمن ${radius} كم`, `Dans un rayon de ${radius} km`)}</h2><small>{inRange.length} {t('متجر', 'magasin(s)')}{outOfRange > 0 && ` · ${outOfRange} ${t('أبعد', 'plus loin')}`}</small></div></div>
            {osm.status === 'loading' && <div className="empty glass small-empty" role="status">
              <span className="dots"><i /><i /><i /></span>
              <p>{t('جاري البحث عن المتاجر القريبة في OpenStreetMap…', 'Recherche des magasins proches sur OpenStreetMap…')}</p>
            </div>}
            {inRange.length === 0 && osm.status !== 'loading' && <div className="empty glass small-empty">
              <p>{osm.status === 'idle'
                ? t('اضغط «ابحث عن المتاجر القريبة» لجلب المتاجر الحقيقية من OpenStreetMap.', 'Cliquez « Chercher les magasins proches » pour charger les magasins réels depuis OpenStreetMap.')
                : t('لا توجد متاجر بإحداثيات معروفة في هذا النطاق. جرّب مسافة أكبر.', 'Aucun magasin aux coordonnées connues dans ce rayon. Essayez une distance plus grande.')}</p>
            </div>}
            {inRange.map(card)}
          </>}
          {withoutDistance.length > 0 && <>
            <div className="section-head"><div><h2>{hasGps ? t('متاجر بدون إحداثيات', 'Magasins sans coordonnées') : t(`متاجر مسجلة في ${city?.ar ?? ''}`, `Magasins enregistrés à ${city?.fr ?? ''}`)}</h2></div></div>
            {withoutDistance.map(card)}
          </>}
          {chainsWithoutLocation.length > 0 && <div className="chains-note glass">
            <StoreIcon size={16} />
            <span>{t('سلاسل لها أثمنة في هذه المدينة دون عنوان فرع مسجل', 'Enseignes avec des prix dans cette ville, sans adresse de magasin enregistrée')}: {chainsWithoutLocation.map(chainName).join('، ')}. {t('أضف عنوان الفرع من لوحة الإدارة.', 'Ajoutez l’adresse depuis l’Administration.')}</span>
          </div>}
        </div>

        <div className="nearby-map glass">
          {config.mapTileUrl === 'none'
            ? <div className="map-fallback">{t('الخريطة غير مفعلة.', 'Carte désactivée.')}</div>
            : <Suspense fallback={<div className="map-fallback"><span className="dots"><i /><i /><i /></span></div>}>
              <StoreMap
                t={t}
                center={me ? [me.lat, me.lng] : (city?.center ?? [33.5731, -7.5898])}
                user={me ? {...me, accuracy: loc.accuracy} : undefined}
                radiusKm={hasGps ? radius : undefined}
                markers={markers}
                selectedId={selected}
                onSelect={setSelected}
              />
            </Suspense>}
          {markers.length === 0 && <p className="map-caption">{t('تظهر المتاجر على الخريطة فقط إذا كانت لها إحداثيات صحيحة.', 'Les magasins n’apparaissent que s’ils ont des coordonnées valides.')}</p>}
        </div>
      </div>
    </div>
  )
}
