import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {AlertTriangle, Building2, CheckCircle2, Crosshair, Home, Lock, MapPin, RotateCcw, ShieldCheck, X} from 'lucide-react'
import {config, providerHosts} from '../config'
import {formatDateTime, type Lang, type T} from '../i18n'
import {Gps3D, MapPin3D} from '../illustrations'
import {formatKm, normalize, searchCities, searchNeighborhoods} from '../location/geo'
import {GpsError, getCurrentPosition, resolveLocation, type GpsErrorCode} from '../location/geolocate'
import {ProviderError, createGeocoder, type GeocoderAdapter} from '../location/providers'
import {ALL_NEIGHBORHOODS, cityById, moroccanCities, neighborhoodsOf, regions} from '../location/regions'
import {useLocationState} from '../location/state'
import {Combobox, type ComboItem} from './Combobox'

type Phase = 'idle' | 'locating' | 'geocoding' | 'done' | 'error'
type ErrCode = GpsErrorCode | 'outside' | 'nocity'

type Props = {
  open: boolean
  onClose: () => void
  t: T
  lang: Lang
  /** Injected for tests; defaults to the configured provider. */
  geocoder?: GeocoderAdapter
  locate?: (timeoutMs: number) => Promise<{lat: number; lng: number; accuracy: number}>
}

export function LocationModal({open, onClose, t, lang, geocoder, locate}: Props) {
  const {loc, dispatch} = useLocationState()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<ErrCode | null>(null)
  const [lookupNote, setLookupNote] = useState<'failed' | 'disabled' | 'approx' | null>(null)
  const abort = useRef<AbortController | null>(null)
  const cityInput = useRef<HTMLInputElement>(null)
  const ar = lang === 'ar'
  const hosts = providerHosts()
  const geo = useMemo(() => geocoder ?? createGeocoder(), [geocoder])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => () => abort.current?.abort(), [])

  const cityItems: ComboItem[] = useMemo(() => {
    const regionName = (id: string) => { const r = regions.find(x => x.id === id); return r ? (ar ? r.ar : r.fr) : '' }
    return moroccanCities.map(c => ({id: c.id, label: ar ? c.ar : c.fr, sub: ar ? c.fr : c.ar, group: regionName(c.region)}))
  }, [ar])
  // Browsing: grouped by region. Searching: ranked flat list (best match first).
  const filterCities = useCallback((q: string) => {
    if (!q.trim()) return cityItems
    const byId = new Map(cityItems.map(i => [i.id, i]))
    return searchCities(q).map(c => ({...byId.get(c.id)!, group: undefined}))
  }, [cityItems])

  const hoods = neighborhoodsOf(loc.cityId)
  const hoodItems: ComboItem[] = useMemo(() => [
    {id: ALL_NEIGHBORHOODS, label: t('جميع الأحياء', 'Tous les quartiers')},
    ...hoods.map(h => ({id: h.id, label: ar ? h.ar : h.fr, sub: ar ? h.fr : h.ar})),
  ], [hoods, ar, t])
  const filterHoods = useCallback((q: string) => {
    if (!q.trim()) return hoodItems
    const ids = new Set(searchNeighborhoods(q, hoods).map(h => h.id))
    const nq = normalize(q)
    // "All neighborhoods" stays searchable in both languages.
    if (['جميع الأحياء', 'Tous les quartiers', 'all'].some(l => normalize(l).includes(nq))) ids.add(ALL_NEIGHBORHOODS)
    return hoodItems.filter(i => ids.has(i.id))
  }, [hoodItems, hoods])

  const runGps = async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setError(null); setLookupNote(null); setPhase('locating')
    let fix
    try {
      fix = await (locate ?? ((ms: number) => getCurrentPosition(ms)))(config.gpsTimeoutMs)
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof GpsError ? e.code : 'unavailable'); setPhase('error')
      return
    }
    if (ctrl.signal.aborted) return
    setPhase('geocoding')
    try {
      const r = await resolveLocation(fix, geo, lang, ctrl.signal)
      if (ctrl.signal.aborted) return
      if (r.outside) { setError('outside'); setPhase('error'); return }
      if (!r.cityId) { setError('nocity'); setPhase('error'); return }
      dispatch({type: 'setGps', lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, cityId: r.cityId, neighborhoodId: r.neighborhoodId, address: r.address, approximate: r.approximate})
      setLookupNote(r.lookup === 'failed' ? 'failed' : r.lookup === 'disabled' ? 'disabled' : r.approximate ? 'approx' : null)
      setPhase('done')
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'aborted') return
      setError('nocity'); setPhase('error')
    }
  }

  const cancelGps = () => { abort.current?.abort(); setPhase('idle') }
  const chooseManually = () => { setPhase('idle'); setError(null); cityInput.current?.focus() }

  const errorText: Record<ErrCode, string> = {
    unsupported: t('متصفحك لا يدعم تحديد الموقع. اختر مدينتك يدوياً.', 'Votre navigateur ne prend pas en charge la géolocalisation. Choisissez votre ville manuellement.'),
    insecure: t('تحديد الموقع يتطلب اتصالاً آمناً (HTTPS) أو localhost. اختر مدينتك يدوياً.', 'La géolocalisation exige une connexion sécurisée (HTTPS) ou localhost. Choisissez votre ville manuellement.'),
    denied: t('تم رفض إذن الموقع. يمكنك السماح به من إعدادات المتصفح، أو اختيار مدينتك يدوياً.', "L'autorisation de localisation a été refusée. Autorisez-la dans les réglages du navigateur ou choisissez votre ville manuellement."),
    unavailable: t('تعذر تحديد موقعك حالياً (GPS غير متوفر). حاول لاحقاً أو اختر يدوياً.', 'Position indisponible (GPS inaccessible). Réessayez plus tard ou choisissez manuellement.'),
    timeout: t('انتهت مهلة تحديد الموقع. حاول مجدداً في مكان مفتوح أو اختر يدوياً.', 'Délai de localisation dépassé. Réessayez à découvert ou choisissez manuellement.'),
    outside: t('يبدو أن موقعك خارج المغرب. اختر مدينة مغربية يدوياً.', 'Votre position semble hors du Maroc. Choisissez une ville marocaine manuellement.'),
    nocity: t('لم نتمكن من تحديد مدينتك. اختر مدينتك يدوياً.', "Impossible d'identifier votre ville. Choisissez-la manuellement."),
  }

  if (!open) return null
  const city = cityById(loc.cityId)
  const busy = phase === 'locating' || phase === 'geocoding'

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal glass location-modal" role="dialog" aria-modal="true" aria-labelledby="loc-title">
        <header className="modal-head">
          <MapPin3D className="modal-pin" />
          <div>
            <h2 id="loc-title">{t('حدد موقعك', 'Choisissez votre position')}</h2>
            <p className="muted">{t('نقارن الأثمنة داخل مدينتك وحيك فقط.', 'Les prix sont comparés uniquement dans votre ville et votre quartier.')}</p>
          </div>
          <button className="icon-close" onClick={onClose} aria-label={t('إغلاق', 'Fermer')}><X size={20} /></button>
        </header>

        <div className="modal-body">
          {/* ---------------- GPS ---------------- */}
          <div className={`gps-card ${phase}`}>
            <div className="gps-visual">
              <Gps3D className="gps-icon" active={busy} />
              {busy && <span className="radar" aria-hidden="true"><i /><i /><i /></span>}
            </div>
            <div className="gps-content">
              <h3><Crosshair size={17} />{t('تحديد تلقائي بالـ GPS', 'Localisation automatique (GPS)')}</h3>
              <ul className="gps-explain">
                <li><Lock size={14} />{t('عند الضغط على «تحديد موقعي» سيطلب المتصفح إذنك. لا نطلبه تلقائياً أبداً.', 'Au clic sur « Me localiser », le navigateur vous demandera l’autorisation. Jamais automatiquement.')}</li>
                <li><ShieldCheck size={14} />{t('يتطلب اتصالاً آمناً (HTTPS).', 'Nécessite une connexion sécurisée (HTTPS).')}</li>
                {hosts.geocoder && <li><MapPin size={14} />{t(`لمعرفة المدينة والحي، تُرسل إحداثياتك إلى ${hosts.geocoder} (OpenStreetMap).`, `Pour trouver ville et quartier, vos coordonnées sont envoyées à ${hosts.geocoder} (OpenStreetMap).`)}</li>}
              </ul>

              {phase === 'idle' && <button className="primary gps-btn" onClick={runGps}><Crosshair size={18} />{t('تحديد موقعي', 'Me localiser')}</button>}
              {busy && <div className="gps-loading" role="status" aria-live="polite">
                <span className="dots"><i /><i /><i /></span>
                {phase === 'locating' ? t('في انتظار إذن المتصفح وإشارة GPS…', 'En attente de l’autorisation et du signal GPS…') : t('جاري تحديد المدينة والحي…', 'Recherche de la ville et du quartier…')}
                <button className="text-link" onClick={cancelGps}>{t('إلغاء', 'Annuler')}</button>
              </div>}
              {phase === 'error' && error && <div className="gps-error" role="alert">
                <AlertTriangle size={18} /><span>{errorText[error]}</span>
                <div className="gps-error-actions">
                  <button className="secondary" onClick={runGps}>{t('إعادة المحاولة', 'Réessayer')}</button>
                  <button className="primary" onClick={chooseManually}>{t('اختيار يدوي', 'Choisir manuellement')}</button>
                </div>
              </div>}
              {phase === 'done' && loc.method === 'gps' && <div className="gps-success" role="status">
                <CheckCircle2 size={18} />
                <div>
                  <b>{city ? (ar ? city.ar : city.fr) : ''}{loc.neighborhoodId !== ALL_NEIGHBORHOODS && hoods.find(h => h.id === loc.neighborhoodId) ? ` · ${ar ? hoods.find(h => h.id === loc.neighborhoodId)!.ar : hoods.find(h => h.id === loc.neighborhoodId)!.fr}` : ''}</b>
                  {loc.address && <small>{loc.address}</small>}
                  {loc.accuracy !== undefined && <small>{t('الدقة', 'Précision')}: <bdi dir="ltr">± {formatKm(loc.accuracy / 1000)}</bdi></small>}
                  {lookupNote === 'failed' && <small className="warn">{t('تعذر جلب العنوان (لا يوجد اتصال؟). تم تقدير أقرب مدينة — تأكد منها أدناه.', 'Adresse introuvable (hors ligne ?). Ville la plus proche estimée — vérifiez ci-dessous.')}</small>}
                  {lookupNote === 'disabled' && <small className="warn">{t('خدمة العناوين غير مفعلة. تم تقدير أقرب مدينة.', 'Service d’adresse désactivé. Ville la plus proche estimée.')}</small>}
                  {lookupNote === 'approx' && <small className="warn">{t('المدينة مقدرة تقريبياً — تأكد منها أدناه.', 'Ville estimée approximativement — vérifiez ci-dessous.')}</small>}
                </div>
                <button className="text-link" onClick={runGps}>{t('تحديث', 'Actualiser')}</button>
              </div>}

              <label className="check">
                <input type="checkbox" checked={loc.rememberGps} onChange={e => dispatch({type: 'setRememberGps', value: e.target.checked})} />
                <span>{t('تذكر موقع GPS على هذا الجهاز (اختياري). بدون موافقتك يُحذف عند إغلاق الصفحة.', 'Mémoriser ma position GPS sur cet appareil (facultatif). Sinon elle est oubliée à la fermeture.')}</span>
              </label>
            </div>
          </div>

          <div className="or-sep"><span>{t('أو اختر يدوياً', 'ou choisissez manuellement')}</span></div>

          {/* ---------------- Manual ---------------- */}
          <div className="manual-grid">
            <Combobox
              testId="city-combo"
              inputRef={cityInput}
              label={t('المدينة', 'Ville')}
              icon={<Building2 size={17} />}
              items={cityItems}
              value={loc.cityId}
              onChange={id => { dispatch({type: 'setCity', cityId: id}); setPhase('idle'); setLookupNote(null) }}
              filter={filterCities}
              placeholder={t('ابحث بالعربية أو الفرنسية…', 'Rechercher en arabe ou en français…')}
              emptyText={t('لا توجد مدينة بهذا الاسم', 'Aucune ville trouvée')}
            />
            <Combobox
              testId="hood-combo"
              label={t('الحي', 'Quartier')}
              icon={<Home size={17} />}
              items={hoodItems}
              value={loc.neighborhoodId}
              onChange={id => dispatch({type: 'setNeighborhood', neighborhoodId: id})}
              filter={filterHoods}
              placeholder={t('ابحث عن حي…', 'Rechercher un quartier…')}
              emptyText={t('لا يوجد حي بهذا الاسم', 'Aucun quartier trouvé')}
            />
            {hoods.length === 0 && <p className="muted hood-note">{t('لا توجد أحياء مسجلة لهذه المدينة بعد — سيتم استعمال المدينة كاملة.', 'Pas encore de quartiers pour cette ville — toute la ville sera utilisée.')}</p>}
          </div>

          <div className="loc-summary">
            <span className={`method-badge ${loc.method}`}>{loc.method === 'gps' ? 'GPS' : t('يدوي', 'Manuel')}</span>
            <span>{t('آخر تحديث', 'Mis à jour')}: {formatDateTime(loc.updatedAt, lang)}</span>
            {loc.method === 'gps' && !loc.rememberGps && <span className="muted">{t('الإحداثيات غير محفوظة', 'Coordonnées non enregistrées')}</span>}
          </div>
        </div>

        <footer className="modal-foot">
          <button className="text-btn" onClick={() => { abort.current?.abort(); dispatch({type: 'reset'}); setPhase('idle'); setError(null); setLookupNote(null) }}>
            <RotateCcw size={15} />{t('إعادة تعيين الموقع', 'Réinitialiser la position')}
          </button>
          {loc.method === 'gps' && <button className="secondary" onClick={() => { dispatch({type: 'clearGps'}); setPhase('idle') }}>{t('مسح إحداثيات GPS', 'Effacer les coordonnées GPS')}</button>}
          <button className="primary" onClick={onClose}>{t('تم', 'Terminé')}</button>
        </footer>
      </section>
    </div>
  )
}
