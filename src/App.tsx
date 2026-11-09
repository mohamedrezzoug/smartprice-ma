import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode} from 'react'
import {
  Search, ShoppingBasket, MapPin, Plus, Minus, Trash2, Upload, Download, TrendingDown, Languages, Info,
  CheckCircle2, RefreshCw, LayoutGrid, ShieldCheck, Sparkles, Store as StoreIcon, Package, Wallet, Percent,
  Check, X, Crown, ArrowLeft, ArrowRight, WifiOff, Zap, ChevronDown, Navigation, Clock, Users, Building2, CalendarClock,
  ScanLine, Bell, BellOff, Wifi,
} from 'lucide-react'
import {loadCatalog, saveCatalog, seedCatalog, type Catalog} from './catalog'
import {categories, stores, type Branch, type Product, type Store} from './data'
import {formatDate, makeT, money, type Lang, type T} from './i18n'
import {artFor, categoryArt} from './art'
import {Basket3D, MapPin3D, ProductArt} from './illustrations'
import {distanceKm, isValidLatLng} from './location/geo'
import {ALL_NEIGHBORHOODS, cityById, neighborhoodById, neighborhoodsOf} from './location/regions'
import {LocationProvider} from './location/LocationProvider'
import {useLocationState} from './location/state'
import {
  bestOffer, buildPriceIndex, compareBasket, freshness, importCSV, latestUpdate, offersFor, storesInIndex, toCSV, upsertPrice,
  type Freshness, type PriceRecord,
} from './pricing'
import {LocationModal} from './components/LocationModal'
import {NearbyStores} from './components/NearbyStores'
import Scanner from './components/Scanner'
import Splash from './components/Splash'
import {diffPriceRecords} from './lib/priceChanges'
import {askNotifPermission, notifPermission, notifyPriceChanges, showNotification} from './lib/notify'
import {enqueue, loadOutbox, registerBackgroundSync, syncEnabled, syncNow} from './lib/sync'

type CartLine = {productId: string; qty: number}
type Tab = 'products' | 'basket' | 'nearby' | 'admin'

const load = <V,>(key: string, fallback: V): V => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

/* ---------- small UI primitives ---------- */

/** Card that tilts toward the pointer for a subtle 3D parallax. */
function TiltCard({className = '', children, style}: {className?: string; children: ReactNode; style?: CSSProperties}) {
  const ref = useRef<HTMLElement>(null)
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current
    if (!el || window.matchMedia?.('(hover: none), (prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
  }
  const reset = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg') }
  return <article ref={ref} className={`tilt ${className}`} style={style} onMouseMove={onMove} onMouseLeave={reset}>{children}</article>
}

function StatCard({icon, label, value, hint, tone = 'emerald'}: {icon: ReactNode; label: string; value: string; hint?: string; tone?: string}) {
  return (
    <div className={`stat glass tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body"><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>
    </div>
  )
}

function StoreDot({store}: {store?: Store}) {
  return <i className="store-dot" style={{'--tint': store?.tint || '#10b981'} as CSSProperties} />
}

function FreshBadge({f, t, compact}: {f: Freshness; t: T; compact?: boolean}) {
  const map = {
    verified: {icon: <ShieldCheck size={12} />, label: t('موثق', 'Vérifié')},
    user: {icon: <Users size={12} />, label: t('مساهمة', 'Contribution')},
    outdated: {icon: <Clock size={12} />, label: t('قديم', 'Ancien')},
  }[f]
  return <span className={`fresh fresh-${f} ${compact ? 'compact' : ''}`} title={map.label}>{map.icon}{!compact && map.label}</span>
}

/* ---------- app ---------- */

export default function App() {
  return <LocationProvider><Shell /></LocationProvider>
}

function Shell() {
  const {loc} = useLocationState()
  const [lang, setLang] = useState<Lang>(() => load('sp-lang', 'ar'))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [tab, setTab] = useState<Tab>('products')
  const [catalog, setCatalog] = useState<Catalog>(() => loadCatalog())
  const [cart, setCart] = useState<CartLine[]>(() => load('sp-cart', []))
  const [notice, setNotice] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [report, setReport] = useState({productId: 'p1', storeId: 'aswak', price: '', note: '', area: ALL_NEIGHBORHOODS, verified: false})
  const [branchForm, setBranchForm] = useState({storeId: 'marjane', name: '', neighborhoodId: '', address: '', lat: '', lng: ''})
  const [locOpen, setLocOpen] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const ar = lang === 'ar'
  const t = useMemo(() => makeT(lang), [lang])
  const {products, prices, branches} = catalog

  /* ---------- v1.1: offline/sync, notifications, barcode, splash ---------- */
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(() => loadOutbox().length)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [notifOn, setNotifOn] = useState(() => load<boolean>('sp-notif', false) === true && notifPermission() === 'granted')
  const [scanOpen, setScanOpen] = useState(false)
  const [splash, setSplash] = useState(() => import.meta.env.MODE !== 'test' && sessionStorage.getItem('sp-splash') !== '1')
  const doneSplash = useCallback(() => { sessionStorage.setItem('sp-splash', '1'); setSplash(false) }, [])
  const pricesRef = useRef(prices); pricesRef.current = prices
  const productsRef = useRef(products); productsRef.current = products
  const langRef = useRef(lang); langRef.current = lang
  const notifRef = useRef(notifOn); notifRef.current = notifOn

  /** After prices change: queue them for sync (local edits) and send one notification for the changes. */
  const afterPriceChange = useCallback((prev: PriceRecord[], next: PriceRecord[], opts: {enqueue: boolean}, prods?: Product[]) => {
    const changes = diffPriceRecords(prev, next)
    if (!changes.length) return
    if (opts.enqueue) { setPending(enqueue(changes.map(c => c.record)).length); if (syncEnabled()) registerBackgroundSync() }
    if (notifRef.current) notifyPriceChanges(changes, prods ?? productsRef.current, stores, langRef.current === 'ar')
  }, [])

  const runSync = useCallback(async (silent: boolean) => {
    const tt = makeT(langRef.current)
    setSyncing(true)
    const r = await syncNow(pricesRef.current)
    setSyncing(false); setPending(loadOutbox().length)
    if (r.status === 'ok') {
      if (r.changed) { const prev = pricesRef.current; pricesRef.current = r.records; setCatalog(c => ({...c, prices: r.records})); afterPriceChange(prev, r.records, {enqueue: false}) }
      setLastSync(Date.now())
      if (!silent) setNotice(tt('تمت المزامنة بنجاح', 'Synchronisation réussie'))
    } else if (!silent) {
      setNotice(r.status === 'no-server' ? tt('ما كاين حتى سيرفر مربوط (VITE_API_URL). البيانات محفوظة محلياً.', 'Aucun serveur configuré (VITE_API_URL). Données gardées localement.')
        : r.status === 'offline' ? tt('ما كاينش الإنترنت. غادي نمزامنو ملي يرجع.', 'Hors ligne. Synchronisation dès le retour du réseau.')
        : tt('فشلت المزامنة: ', 'Échec de synchronisation : ') + r.message)
    }
  }, [afterPriceChange])

  useEffect(() => {
    const on = () => { setOnline(true); runSync(true) }
    const off = () => setOnline(false)
    const msg = (e: MessageEvent) => { if (e.data?.type === 'sp-sync') runSync(true) }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    navigator.serviceWorker?.addEventListener('message', msg)
    if (navigator.onLine) runSync(true)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); navigator.serviceWorker?.removeEventListener('message', msg) }
  }, [runSync])

  const toggleNotif = async () => {
    if (notifOn) { setNotifOn(false); localStorage.setItem('sp-notif', 'false'); return }
    const p = await askNotifPermission()
    if (p === 'granted') {
      setNotifOn(true); localStorage.setItem('sp-notif', 'true')
      showNotification(t('الإشعارات مفعّلة', 'Notifications activées'), t('غادي نعلمك بالعروض وتغيّر الأثمنة.', 'Vous serez alerté des offres et changements de prix.'))
    } else setNotice(p === 'unsupported' ? t('هاد المتصفح ما كيدعمش الإشعارات.', 'Notifications non prises en charge.') : t('رفضتي إذن الإشعارات.', 'Permission de notification refusée.'))
  }
  const onScan = (code: string) => {
    setScanOpen(false)
    const p = products.find(x => x.barcode === code)
    setTab('products'); setCategory('all'); setQuery(code)
    setNotice(p ? t('لقيت المنتج: ', 'Produit trouvé : ') + (ar ? p.name : p.nameFr) : t('هاد الباركود ماكاينش فالقاعدة: ', 'Code-barres inconnu : ') + code)
  }

  useEffect(() => { saveCatalog(catalog) }, [catalog])
  useEffect(() => { localStorage.setItem('sp-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    localStorage.setItem('sp-lang', JSON.stringify(lang))
    document.documentElement.lang = lang
    document.documentElement.dir = ar ? 'rtl' : 'ltr'
  }, [lang, ar])
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(id)
  }, [notice])
  useEffect(() => {
    if (!justAdded) return
    const id = window.setTimeout(() => setJustAdded(null), 1100)
    return () => window.clearTimeout(id)
  }, [justAdded])
  // City change → admin area & store filter must belong to the new city.
  useEffect(() => { setReport(r => ({...r, area: ALL_NEIGHBORHOODS})); setStoreFilter('all'); setBranchForm(b => ({...b, neighborhoodId: ''})) }, [loc.cityId])

  /* ---------- location-scoped price data ---------- */
  const city = cityById(loc.cityId)
  const cityName = city ? (ar ? city.ar : city.fr) : loc.cityId
  const hood = loc.neighborhoodId !== ALL_NEIGHBORHOODS ? neighborhoodById(loc.neighborhoodId) : undefined
  const hoodName = hood ? (ar ? hood.ar : hood.fr) : undefined
  const placeLabel = hoodName ? `${cityName} · ${hoodName}` : cityName

  const index = useMemo(() => buildPriceIndex(prices, loc.cityId, loc.neighborhoodId), [prices, loc.cityId, loc.neighborhoodId])
  const cityStoreIds = useMemo(() => storesInIndex(index), [index])
  const cityStores = stores.filter(s => cityStoreIds.includes(s.id))
  const cityLatest = useMemo(() => latestUpdate([...index.values()].flatMap(m => [...m.values()])), [index])
  const comparison = useMemo(() => compareBasket(cart, index), [cart, index])

  const storeName = (id: string) => { const s = stores.find(x => x.id === id); return s ? (ar ? s.name : s.nameFr) : id }
  const productName = (id: string) => { const p = products.find(x => x.id === id); return p ? (ar ? p.name : p.nameFr) : id }
  const Arrow = ar ? ArrowLeft : ArrowRight

  const filtered = useMemo(() => products.filter(p =>
    (category === 'all' || p.category === category) &&
    `${p.name} ${p.nameFr} ${p.barcode || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [products, category, query])
  const cartProducts = cart.map(line => ({line, p: products.find(p => p.id === line.productId)})).filter(x => x.p) as {line: CartLine; p: Product}[]
  const cartCount = cart.reduce((s, x) => s + x.qty, 0)
  const pricedInCity = products.filter(p => index.has(p.id)).length

  const avgSpread = useMemo(() => {
    const spreads = [...index.values()].map(m => {
      const v = [...m.values()].map(r => r.price)
      if (v.length < 2) return null
      const max = Math.max(...v)
      return max > 0 ? (max - Math.min(...v)) / max : 0
    }).filter((x): x is number => x !== null)
    return spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length * 100 : 0
  }, [index])
  const cheapestStore = useMemo(() => {
    const wins: Record<string, number> = {}
    for (const pid of index.keys()) { const b = bestOffer(index, pid); if (b) wins[b.storeId] = (wins[b.storeId] || 0) + 1 }
    return Object.entries(wins).sort((a, b) => b[1] - a[1])[0]
  }, [index])

  /* ---------- cart ---------- */
  const add = (id: string) => {
    setCart(old => { const found = old.find(x => x.productId === id); return found ? old.map(x => x.productId === id ? {...x, qty: x.qty + 1} : x) : [...old, {productId: id, qty: 1}] })
    setJustAdded(id); setBump(b => b + 1)
  }
  const changeQty = (id: string, delta: number) => setCart(old => old.map(x => x.productId === id ? {...x, qty: Math.max(1, x.qty + delta)} : x))
  const remove = (id: string) => setCart(old => old.filter(x => x.productId !== id))
  const qtyOf = (id: string) => cart.find(x => x.productId === id)?.qty || 0

  /* ---------- admin ---------- */
  const exportCSV = () => {
    const csv = toCSV(products, prices)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'}))
    a.download = 'smartprice-prices.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const onImport = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const r = importCSV(String(reader.result || ''), products, prices)
        setCatalog(c => ({...c, products: r.products, prices: r.records}))
        afterPriceChange(prices, r.records, {enqueue: true}, r.products)
        setNotice(t(`تم استيراد ${r.imported} ثمن${r.skipped ? ` (تم تجاهل ${r.skipped} سطر بدون مدينة أو ثمن صالح)` : ''}`, `${r.imported} prix importés${r.skipped ? ` (${r.skipped} ligne(s) ignorée(s) : ville ou prix invalide)` : ''}`))
      } catch { setNotice(t('تعذر قراءة الملف. تحقق من CSV.', 'Fichier CSV invalide.')) }
    }
    reader.readAsText(file)
  }
  const submitReport = () => {
    const value = Number(report.price)
    if (!report.price || !Number.isFinite(value) || value <= 0) { setNotice(t('دخل ثمن صحيح', 'Saisissez un prix valide')); return }
    const rec: PriceRecord = {
      productId: report.productId, storeId: report.storeId, cityId: loc.cityId,
      area: report.area !== ALL_NEIGHBORHOODS ? report.area : undefined,
      price: value, updatedAt: new Date().toISOString(), status: report.verified ? 'verified' : 'user',
    }
    setCatalog(c => ({...c, prices: upsertPrice(c.prices, rec)}))
    afterPriceChange(prices, upsertPrice(prices, rec), {enqueue: true})
    if (syncEnabled() && navigator.onLine) runSync(true)
    setNotice(online
      ? t(`تسجل الثمن لـ ${cityName} محلياً. خاصو مراجعة قبل النشر.`, `Prix enregistré pour ${cityName}, à vérifier avant publication.`)
      : t(`تسجل الثمن لـ ${cityName} محلياً، وغادي يتمزامن ملي يرجع الإنترنت.`, `Prix enregistré pour ${cityName}, synchronisation dès le retour du réseau.`))
    setReport(x => ({...x, price: '', note: ''}))
  }
  const addBranch = () => {
    const hasLat = branchForm.lat.trim() !== '', hasLng = branchForm.lng.trim() !== ''
    let lat: number | undefined, lng: number | undefined
    if (hasLat || hasLng) {
      lat = Number(branchForm.lat.replace(',', '.')); lng = Number(branchForm.lng.replace(',', '.'))
      if (!hasLat || !hasLng || !isValidLatLng(lat, lng)) { setNotice(t('إحداثيات غير صالحة. اتركها فارغة إذا لم تكن متأكداً.', 'Coordonnées invalides. Laissez vide si vous n’êtes pas sûr.')); return }
      if (city && distanceKm({lat, lng}, {lat: city.center[0], lng: city.center[1]}) > 60) {
        setNotice(t(`الإحداثيات بعيدة عن ${cityName}. تحقق منها.`, `Coordonnées trop éloignées de ${cityName}. Vérifiez-les.`)); return
      }
    }
    if (!branchForm.address.trim() && lat === undefined) { setNotice(t('أدخل العنوان أو الإحداثيات.', 'Saisissez une adresse ou des coordonnées.')); return }
    const b: Branch = {
      id: `local-${Date.now().toString(36)}`, storeId: branchForm.storeId, cityId: loc.cityId,
      neighborhoodId: branchForm.neighborhoodId || undefined, name: branchForm.name.trim() || undefined,
      address: branchForm.address.trim() || undefined, lat, lng, source: 'local',
    }
    setCatalog(c => ({...c, branches: [...c.branches, b]}))
    setBranchForm(f => ({...f, name: '', address: '', lat: '', lng: ''}))
    setNotice(t('تمت إضافة الفرع.', 'Magasin ajouté.'))
  }

  const tabs: {id: Tab; icon: ReactNode; label: string; badge?: number}[] = [
    {id: 'products', icon: <LayoutGrid size={18} />, label: t('المنتجات', 'Produits')},
    {id: 'basket', icon: <ShoppingBasket size={18} />, label: t('قفة المشتريات', 'Mon panier'), badge: cartCount},
    {id: 'nearby', icon: <Navigation size={18} />, label: t('المتاجر القريبة', 'À proximité')},
    {id: 'admin', icon: <ShieldCheck size={18} />, label: t('إدارة الأثمنة', 'Administration')},
  ]
  const reportProduct = products.find(p => p.id === report.productId)
  const currentRecord = index.get(report.productId)?.get(report.storeId)
  const cityHoods = neighborhoodsOf(loc.cityId)
  const cityBranches = branches.filter(b => b.cityId === loc.cityId)
  const maxComplete = Math.max(1, ...comparison.complete.map(x => x.total), ...comparison.partial.map(x => x.total))
  const completeSaving = comparison.complete.length > 1 ? comparison.complete[comparison.complete.length - 1].total - comparison.complete[0].total : 0

  const locationChip = (extra = '') => (
    <button className={`loc-chip ${extra}`} onClick={() => setLocOpen(true)} aria-label={t('تغيير الموقع', 'Changer de position')}>
      <MapPin3D className="loc-chip-pin" />
      <span className="loc-chip-text"><b>{cityName}</b>{hoodName && <small>{hoodName}</small>}</span>
      {loc.method === 'gps' && <span className="gps-tag">GPS</span>}
      <ChevronDown size={14} className="chev" />
    </button>
  )

  return <div className="app" dir={ar ? 'rtl' : 'ltr'} lang={lang}>
    <div className="bg-orbs" aria-hidden="true"><i /><i /><i /></div>

    {/* ---------------- header ---------------- */}
    <header className="topbar glass">
      <div className="brand">
        <div className="logo"><ShoppingBasket size={22} strokeWidth={2.4} /></div>
        <div><b>SmartPrice <span>MA</span></b><small>{t('قارن ووفر فمشترياتك', 'Comparez et économisez')}</small></div>
      </div>
      <nav className="tabs desktop-only" aria-label={t('التنقل', 'Navigation')}>
        {tabs.map(x => <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => setTab(x.id)}>
          {x.icon}<span>{x.label}</span>{!!x.badge && <b key={bump} className="badge">{x.badge}</b>}
        </button>)}
      </nav>
      <div className="top-actions">
        <span className={`sp-net ${online ? 'on' : 'off'}${online && pending === 0 ? ' quiet' : ''}`} title={online ? t('متصل', 'En ligne') : t('بلا إنترنت', 'Hors ligne')}>
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{online ? t('متصل', 'En ligne') : t('بلا إنترنت', 'Hors ligne')}</span>{pending > 0 && <b>{pending}</b>}
        </span>
        <button className={`sp-hbtn ${notifOn ? 'active' : ''}`} onClick={toggleNotif} aria-pressed={notifOn} title={t('إشعارات العروض وتغيّر الأثمنة', 'Alertes offres et prix')}>
          {notifOn ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
        {locationChip()}
        <button className="lang-toggle" onClick={() => setLang(ar ? 'fr' : 'ar')} title="Language / اللغة">
          <Languages size={16} />
          <span className={ar ? 'on' : ''}>ع</span>
          <span className={!ar ? 'on' : ''}>FR</span>
        </button>
      </div>
    </header>

    <main>
      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} />{t('مشتريات أذكى، ميزانية أحسن', 'DES COURSES PLUS INTELLIGENTES')}</span>
          <h1>{t('نفس القفة، ', 'Le même panier, ')}<em>{t('بثمن أقل.', 'moins cher.')}</em></h1>
          <p>{t('قارن أثمنة المنتجات بين المتاجر، وحضّر لائحة مشترياتك واكتشف فين تقدر توفر.', 'Comparez les prix entre magasins, préparez votre liste et trouvez où économiser.')}</p>
          <div className="hero-search">
            <Search size={20} />
            <input value={query} onChange={e => { setQuery(e.target.value); setTab('products') }} placeholder={t('قلب على منتج أو باركود...', 'Rechercher un produit ou code-barres...')} />
            {query && <button className="clear" onClick={() => setQuery('')} aria-label="clear"><X size={16} /></button>}
            <button className="sp-scan" onClick={() => setScanOpen(true)} aria-label={t('مسح الباركود', 'Scanner un code-barres')}><ScanLine size={18} /><span>{t('مسح الباركود', 'Scanner')}</span></button>
          </div>
          <div className="hero-pills">
            <span><CheckCircle2 size={15} /> {t('مقارنة فورية', 'Comparaison rapide')}</span>
            <span><WifiOff size={15} /> {t('يخدم بلا إنترنت', 'Mode hors ligne')}</span>
            <button className="pill-btn" onClick={() => setLocOpen(true)}><MapPin size={15} /> {placeLabel}</button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="halo" />
          <Basket3D className="basket" />
          <ProductArt kind="oil" className="float f1" />
          <ProductArt kind="milk" className="float f2" />
          <ProductArt kind="tea" className="float f3" />
          <div className="save-bubble glass"><TrendingDown size={18} /><div><small>{t('فرق متوسط', 'Écart moyen')}</small><b>{avgSpread.toFixed(0)}%</b></div></div>
        </div>
      </section>

      {/* ---------------- dashboard ---------------- */}
      <section className="dashboard">
        <StatCard icon={<Package size={20} />} label={t(`منتجات بثمن في ${cityName}`, `Produits avec prix à ${cityName}`)} value={`${pricedInCity}/${products.length}`} hint={cityLatest ? t(`آخر تحديث: ${formatDate(cityLatest, lang)}`, `Mis à jour : ${formatDate(cityLatest, lang)}`) : t('لا توجد أثمنة بعد', 'Aucun prix pour l’instant')} />
        <StatCard tone="sky" icon={<StoreIcon size={20} />} label={t('متاجر بالمدينة', 'Magasins dans la ville')} value={String(cityStores.length)} hint={cheapestStore ? t(`الأرخص غالباً: ${storeName(cheapestStore[0])}`, `Souvent le moins cher : ${storeName(cheapestStore[0])}`) : undefined} />
        <StatCard tone="amber" icon={<Percent size={20} />} label={t('فرق الأثمنة', 'Écart de prix moyen')} value={`${avgSpread.toFixed(1)}%`} hint={t('بين أغلى وأرخص متجر', 'entre le + cher et le – cher')} />
        <StatCard tone="violet" icon={<Wallet size={20} />} label={t('قفتك بأحسن ثمن', 'Votre panier optimisé')} value={money(comparison.bestMix.total)} hint={t(`${cartCount} قطعة`, `${cartCount} article(s)`)} />
      </section>

      <div className="notice"><Info size={17} /><span>
        {t('تنبيه: الأثمنة الموجودة حالياً تجريبية للتوضيح وليست عروضاً حقيقية مؤكدة. حدّثها من لوحة الإدارة أو استورد ملف الأسعار.', 'Attention : les prix affichés sont des données de démonstration, non des offres réelles garanties. Mettez-les à jour depuis Administration ou importez un CSV.')}
        {' '}<b>{t(`الأثمنة المعروضة خاصة بـ ${placeLabel} فقط.`, `Prix affichés uniquement pour ${placeLabel}.`)}</b>
      </span></div>

      {/* ---------------- products ---------------- */}
      {tab === 'products' && <div className="view" key="products">
        <div className="categories" role="tablist">
          {categories.map(c => <button key={c.id} role="tab" aria-selected={category === c.id} className={category === c.id ? 'selected' : ''} onClick={() => setCategory(c.id)}>
            <span className="cat-art"><ProductArt kind={categoryArt(c.id)} /></span>
            <span>{ar ? c.ar : c.fr}</span>
          </button>)}
        </div>

        <div className="section-head">
          <div><h2>{t('المنتجات المتوفرة', 'Produits disponibles')}</h2><small>{filtered.length} {t('منتج', 'produits')} · {placeLabel}{query && <> · “{query}”</>}</small></div>
          <label className="select-pill">
            <StoreIcon size={16} />
            <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} aria-label={t('المتجر', 'Magasin')}>
              <option value="all">{t('جميع المتاجر', 'Tous les magasins')}</option>
              {cityStores.map(s => <option key={s.id} value={s.id}>{ar ? s.name : s.nameFr}</option>)}
            </select>
            <ChevronDown size={14} className="chev" />
          </label>
        </div>

        {pricedInCity === 0 && <div className="city-empty glass">
          <MapPin3D className="city-empty-pin" />
          <div>
            <h3>{t(`لا توجد أثمنة مسجلة في ${cityName} بعد`, `Aucun prix enregistré à ${cityName} pour l’instant`)}</h3>
            <p className="muted">{t('لا نخلط أثمنة المدن. أضف أثمنة هذه المدينة من الإدارة أو استورد ملف CSV، أو اختر مدينة أخرى.', 'Nous ne mélangeons pas les villes. Ajoutez des prix depuis l’Administration, importez un CSV ou choisissez une autre ville.')}</p>
            <div className="row-actions">
              <button className="primary" onClick={() => setTab('admin')}><Plus size={16} />{t('إضافة ثمن', 'Ajouter un prix')}</button>
              <button className="secondary" onClick={() => setLocOpen(true)}><MapPin size={16} />{t('تغيير المدينة', 'Changer de ville')}</button>
            </div>
          </div>
        </div>}

        {filtered.length === 0 ? <div className="empty glass">
          <ProductArt kind="bag" className="empty-art" />
          <h3>{t('ما لقينا حتى منتج', 'Aucun produit trouvé')}</h3>
          <button className="secondary" onClick={() => { setQuery(''); setCategory('all') }}><RefreshCw size={16} />{t('مسح البحث', 'Réinitialiser la recherche')}</button>
        </div> :
        <div className="product-grid">
          {filtered.map((p, i) => {
            const best = bestOffer(index, p.id)
            const offers = offersFor(index, p.id, storeFilter)
            const missingStores = storeFilter === 'all' ? cityStores.filter(s => !index.get(p.id)?.has(s.id)) : (offers.length ? [] : cityStores.filter(s => s.id === storeFilter))
            const maxP = Math.max(1, ...offers.map(o => o.price))
            const inCart = qtyOf(p.id)
            const name = ar ? p.name : p.nameFr
            const latest = latestUpdate(index.get(p.id)?.values() ?? [])
            return <TiltCard className={`product-card glass ${best ? '' : 'unavailable'}`} key={p.id} style={{animationDelay: `${Math.min(i, 12) * 45}ms`}}>
              <div className="product-stage">
                <span className="unit">{p.unit}</span>
                {inCart > 0 && <span className="in-cart"><ShoppingBasket size={13} />{inCart}</span>}
                <div className="pedestal" />
                <ProductArt kind={artFor(p)} className="product-art" label={name} />
              </div>
              <h3>{name}</h3>
              {best ? <div className="best-price">
                <div>
                  <small>{t('أقل ثمن مسجل', 'Meilleur prix relevé')}</small>
                  <strong>{best.price.toFixed(2)}<span> DH</span></strong>
                  <small className="store-line"><StoreDot store={stores.find(s => s.id === best.storeId)} />{storeName(best.storeId)}</small>
                </div>
                <span className="best-label"><Crown size={12} />{t('الأرخص', 'Moins cher')}</span>
              </div> : <div className="best-price na">
                <div><small>{cityName}</small><strong className="na-text">{t('غير متوفر', 'Non disponible')}</strong><small>{t('لا يوجد ثمن مسجل في هذه المدينة', 'Aucun prix enregistré dans cette ville')}</small></div>
              </div>}
              {latest && <div className="updated"><CalendarClock size={13} />{t('آخر تحديث', 'Mis à jour')}: {formatDate(latest, lang)}</div>}
              <div className="price-list">
                {offers.map(o => {
                  const f = freshness(o)
                  return <div key={o.storeId} className={`${o.storeId === best?.storeId ? 'is-best' : ''} ${f === 'outdated' ? 'is-old' : ''}`}>
                    <span className="pl-name"><StoreDot store={stores.find(s => s.id === o.storeId)} />{storeName(o.storeId)}</span>
                    <span className="pl-bar"><i style={{width: `${Math.max(12, o.price / maxP * 100)}%`}} /></span>
                    <b>{money(o.price)}</b>
                    <FreshBadge f={f} t={t} compact />
                  </div>
                })}
                {missingStores.map(s => <div key={s.id} className="is-na">
                  <span className="pl-name"><StoreDot store={s} />{ar ? s.name : s.nameFr}</span>
                  <span className="pl-bar" />
                  <b className="na-text">{t('غير متوفر', 'Non disponible')}</b>
                  <span />
                </div>)}
              </div>
              <button className={`add-btn ${justAdded === p.id ? 'added' : ''}`} onClick={() => add(p.id)}>
                {justAdded === p.id ? <Check size={17} /> : <Plus size={17} />}
                {justAdded === p.id ? t('تزادت!', 'Ajouté !') : t('زيد للقفة', 'Ajouter au panier')}
              </button>
            </TiltCard>
          })}
        </div>}
        <div className="legend">
          <FreshBadge f="verified" t={t} /> <FreshBadge f="user" t={t} /> <FreshBadge f="outdated" t={t} />
        </div>
      </div>}

      {/* ---------------- basket ---------------- */}
      {tab === 'basket' && <div className="view" key="basket">
        {cartProducts.length === 0 ? <section className="empty glass big">
          <Basket3D className="empty-basket" />
          <h3>{t('القفة مازال خاوية', 'Votre panier est vide')}</h3>
          <p className="muted">{t('زيد منتجات باش نقارنو ليك الثمن فكل متجر.', 'Ajoutez des produits pour comparer le total dans chaque magasin.')}</p>
          <button className="primary" onClick={() => setTab('products')}>{t('تصفح المنتجات', 'Voir les produits')}<Arrow size={17} /></button>
        </section> :
        <div className="basket-layout">
          <section className="panel glass">
            <div className="section-head">
              <div><h2>{t('قفة المشتريات ديالك', 'Votre panier')}</h2><small>{cartProducts.length} {t('منتج مختلف', 'produits différents')} · {placeLabel}</small></div>
              <button className="text-btn" onClick={() => setCart([])}><Trash2 size={15} />{t('مسح القفة', 'Vider le panier')}</button>
            </div>
            <div className="basket-lines">
              {cartProducts.map(({line, p}) => {
                const best = bestOffer(index, p.id)
                return <div className={`basket-line ${best ? '' : 'na'}`} key={p.id}>
                  <div className="line-thumb"><ProductArt kind={artFor(p)} /></div>
                  <div className="line-name"><b>{ar ? p.name : p.nameFr}</b><small>{p.unit} · {best ? storeName(best.storeId) : t(`غير متوفر في ${cityName}`, `Non disponible à ${cityName}`)}</small></div>
                  <div className="qty">
                    <button onClick={() => changeQty(p.id, -1)} aria-label="-"><Minus size={14} /></button>
                    <b>{line.qty}</b>
                    <button onClick={() => changeQty(p.id, 1)} aria-label="+"><Plus size={14} /></button>
                  </div>
                  <strong className="line-total">{best ? money(best.price * line.qty) : <span className="na-text">{t('غير متوفر', 'Non disponible')}</span>}</strong>
                  <button className="remove" onClick={() => remove(p.id)} aria-label={t('حذف', 'Supprimer')}><Trash2 size={17} /></button>
                </div>
              })}
            </div>
          </section>

          <aside className="compare-box glass">
            <h3><StoreIcon size={19} />{t('فين تشري القفة؟', 'Où acheter votre panier ?')}</h3>
            <p className="scope-note"><MapPin size={13} />{t(`مقارنة داخل ${placeLabel} فقط`, `Comparaison uniquement à ${placeLabel}`)}</p>

            <h4 className="group-title full"><CheckCircle2 size={15} />{t('متاجر فيها القفة كاملة', 'Magasins avec le panier complet')}</h4>
            {comparison.complete.length === 0 && <p className="muted none-msg">{t(`لا يوجد متجر في ${cityName} بأثمنة لكل منتجات قفتك.`, `Aucun magasin à ${cityName} n’a de prix pour tout votre panier.`)}</p>}
            <div className="store-totals">
              {comparison.complete.map(x => {
                const s = stores.find(z => z.id === x.storeId)
                const win = x === comparison.cheapestComplete
                return <div className={'store-total ' + (win ? 'winner' : '')} key={x.storeId} style={{'--tint': s?.tint} as CSSProperties}>
                  <div className="st-head">
                    <span className="st-name"><StoreDot store={s} />{storeName(x.storeId)}</span>
                    {win && <span className="st-badge"><Crown size={12} />{t('أرخص قفة كاملة', 'Panier complet le − cher')}</span>}
                    <strong>{money(x.total)}</strong>
                  </div>
                  <div className="st-bar"><i style={{width: `${x.total / maxComplete * 100}%`}} /></div>
                  <small>{x.available.length}/{cart.length} {t('منتج متوفر', 'produits disponibles')}{x.latest && ` · ${t('آخر تحديث', 'MAJ')} ${formatDate(x.latest, lang)}`}</small>
                </div>
              })}
            </div>

            {comparison.partial.length > 0 && <>
              <h4 className="group-title part"><Info size={15} />{t('توفر جزئي', 'Disponibilité partielle')}</h4>
              <div className="store-totals">
                {comparison.partial.map(x => {
                  const s = stores.find(z => z.id === x.storeId)
                  return <div className="store-total partial" key={x.storeId} style={{'--tint': s?.tint} as CSSProperties}>
                    <div className="st-head">
                      <span className="st-name"><StoreDot store={s} />{storeName(x.storeId)}</span>
                      <strong>{money(x.total)}</strong>
                    </div>
                    <div className="st-bar"><i style={{width: `${x.total / maxComplete * 100}%`}} /></div>
                    <small>{x.available.length}/{cart.length} {t('منتج متوفر', 'produits disponibles')} — {t('غير متوفر', 'non disponible')}: {x.missing.map(productName).join('، ')}</small>
                  </div>
                })}
              </div>
            </>}

            <div className="mix-total">
              <Zap size={20} />
              <span>{t('المجموع إذا شريتي كل منتج من أرخص متجر', 'Total en choisissant le moins cher par produit')}
                {comparison.bestMix.unavailable.length > 0 && <small>{t('بدون', 'sans')}: {comparison.bestMix.unavailable.map(productName).join('، ')} ({t('غير متوفر', 'non disponible')})</small>}
              </span>
              <b>{money(comparison.bestMix.total)}</b>
            </div>
            {completeSaving > 0 && <p className="saving"><TrendingDown size={16} />{t('يمكنك توفير', 'Économie potentielle')} <b>{money(completeSaving)}</b> {t('باختيار أرخص متجر كامل.', 'en choisissant le magasin complet le moins cher.')}</p>}
            <button className="secondary nearby-cta" onClick={() => setTab('nearby')}><Navigation size={16} />{t('قارن القفة في المتاجر القريبة', 'Comparer dans les magasins proches')}</button>
          </aside>
        </div>}
      </div>}

      {/* ---------------- nearby ---------------- */}
      {tab === 'nearby' && <NearbyStores t={t} lang={lang} branches={branches} index={index} products={products} cart={cart} onOpenLocation={() => setLocOpen(true)} />}

      {/* ---------------- admin ---------------- */}
      {tab === 'admin' && <section className="panel glass view admin" key="admin">
        <div className="admin-head">
          <div>
            <h2>{t('إدارة وتحديث الأثمنة', 'Gestion des prix')}</h2>
            <p className="muted">{t('أضف ثمناً تم التحقق منه أو استورد ملف CSV. كل التعديلات تحفظ محلياً في هذا الجهاز.', 'Ajoutez un prix vérifié ou importez un CSV. Les modifications sont sauvegardées localement sur cet appareil.')}</p>
          </div>
          {locationChip('admin-loc')}
        </div>
        <div className="admin-grid">
          <div className="admin-preview">
            <div className="pedestal" />
            {reportProduct && <ProductArt kind={artFor(reportProduct)} className="product-art" />}
            <b>{reportProduct ? (ar ? reportProduct.name : reportProduct.nameFr) : ''}</b>
            {currentRecord
              ? <small>{t('الثمن الحالي', 'Prix actuel')} ({cityName}): {money(currentRecord.price)} <FreshBadge f={freshness(currentRecord)} t={t} /></small>
              : <small className="na-text">{t(`غير متوفر في ${cityName}`, `Non disponible à ${cityName}`)}</small>}
          </div>
          <div className="admin-form">
            <label>{t('المنتج', 'Produit')}<select value={report.productId} onChange={e => setReport({...report, productId: e.target.value})}>{products.map(p => <option key={p.id} value={p.id}>{ar ? p.name : p.nameFr}</option>)}</select></label>
            <label>{t('المتجر', 'Magasin')}<select value={report.storeId} onChange={e => setReport({...report, storeId: e.target.value})}>{stores.map(s => <option key={s.id} value={s.id}>{ar ? s.name : s.nameFr}</option>)}</select></label>
            <label>{t('الثمن بالدرهم', 'Prix en DH')}<input type="number" min="0.01" step="0.01" value={report.price} onChange={e => setReport({...report, price: e.target.value})} placeholder="0.00" /></label>
            <label>{t('النطاق', 'Zone')}<select value={report.area} onChange={e => setReport({...report, area: e.target.value})}>
              <option value={ALL_NEIGHBORHOODS}>{t(`كل ${cityName}`, `Tout ${cityName}`)}</option>
              {cityHoods.map(h => <option key={h.id} value={h.id}>{ar ? h.ar : h.fr}</option>)}
            </select></label>
            <label className="span2">{t('ملاحظة (اختياري)', 'Note (facultative)')}<input value={report.note} onChange={e => setReport({...report, note: e.target.value})} placeholder={t('مثلاً: ثمن من فاتورة اليوم', 'Ex. prix relevé sur ticket du jour')} /></label>
            <label className="check span2"><input type="checkbox" checked={report.verified} onChange={e => setReport({...report, verified: e.target.checked})} /><span>{t('ثمن موثق (تم التحقق من الفاتورة/الرف)', 'Prix vérifié (ticket ou étiquette contrôlé)')}</span></label>
            <button className="primary" onClick={submitReport}><Plus size={17} />{t(`حفظ الثمن لـ ${cityName}`, `Enregistrer pour ${cityName}`)}</button>
          </div>
        </div>
        <div className="admin-actions">
          <button className="secondary" onClick={exportCSV}><Download size={17} />{t('تصدير CSV', 'Exporter CSV')}</button>
          <label className="secondary upload"><Upload size={17} />{t('استيراد CSV', 'Importer CSV')}<input type="file" accept=".csv,text/csv" onChange={e => { onImport(e.target.files?.[0]); e.target.value = '' }} /></label>
          <button className="secondary" onClick={() => { setCatalog(seedCatalog()); setCart([]); setNotice(t('تمت استعادة بيانات العرض التجريبية', 'Données de démonstration restaurées')) }}><RefreshCw size={17} />{t('استعادة بيانات العرض', 'Réinitialiser la démo')}</button>
        </div>

        <div className="branch-admin">
          <h3><Building2 size={18} />{t(`فروع المتاجر في ${cityName}`, `Magasins à ${cityName}`)}</h3>
          <p className="muted">{t('أدخل الإحداثيات فقط من مصدر موثوق (مثلاً openstreetmap.org). بدون إحداثيات لن تظهر المسافة ولا الموقع على الخريطة.', 'Saisissez les coordonnées uniquement depuis une source fiable (ex. openstreetmap.org). Sans coordonnées, ni distance ni position sur la carte.')}</p>
          <div className="admin-form branch-form">
            <label>{t('السلسلة', 'Enseigne')}<select value={branchForm.storeId} onChange={e => setBranchForm({...branchForm, storeId: e.target.value})}>{stores.map(s => <option key={s.id} value={s.id}>{ar ? s.name : s.nameFr}</option>)}</select></label>
            <label>{t('اسم الفرع (اختياري)', 'Nom du magasin (facultatif)')}<input value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} /></label>
            <label>{t('الحي', 'Quartier')}<select value={branchForm.neighborhoodId} onChange={e => setBranchForm({...branchForm, neighborhoodId: e.target.value})}>
              <option value="">—</option>{cityHoods.map(h => <option key={h.id} value={h.id}>{ar ? h.ar : h.fr}</option>)}
            </select></label>
            <label>{t('العنوان', 'Adresse')}<input value={branchForm.address} onChange={e => setBranchForm({...branchForm, address: e.target.value})} /></label>
            <label>{t('خط العرض (اختياري)', 'Latitude (facultatif)')}<input inputMode="decimal" value={branchForm.lat} onChange={e => setBranchForm({...branchForm, lat: e.target.value})} placeholder="33.5…" /></label>
            <label>{t('خط الطول (اختياري)', 'Longitude (facultatif)')}<input inputMode="decimal" value={branchForm.lng} onChange={e => setBranchForm({...branchForm, lng: e.target.value})} placeholder="-7.6…" /></label>
            <button className="primary" onClick={addBranch}><Plus size={17} />{t('إضافة الفرع', 'Ajouter le magasin')}</button>
          </div>
          {cityBranches.length > 0 && <ul className="branch-list">
            {cityBranches.map(b => <li key={b.id}>
              <StoreDot store={stores.find(s => s.id === b.storeId)} />
              <span><b>{b.name || storeName(b.storeId)}</b><small>{[b.address, b.neighborhoodId && (ar ? neighborhoodById(b.neighborhoodId)?.ar : neighborhoodById(b.neighborhoodId)?.fr), b.lat !== undefined ? `${b.lat.toFixed(4)}, ${b.lng!.toFixed(4)}` : t('بدون إحداثيات', 'sans coordonnées')].filter(Boolean).join(' · ')}</small></span>
              <button className="remove" onClick={() => setCatalog(c => ({...c, branches: c.branches.filter(x => x.id !== b.id)}))} aria-label={t('حذف', 'Supprimer')}><Trash2 size={16} /></button>
            </li>)}
          </ul>}
        </div>

        <div className="sp-sync-box">
          <div><b>{t('المزامنة', 'Synchronisation')}</b>
            <small>{online ? t('متصل', 'En ligne') : t('بلا إنترنت', 'Hors ligne')} · {pending} {t('تغيير فالانتظار', 'modification(s) en attente')}{lastSync ? ` · ${new Date(lastSync).toLocaleTimeString()}` : ''}{syncEnabled() ? '' : t(' · ما كاين سيرفر مربوط (VITE_API_URL)', ' · aucun serveur (VITE_API_URL)')}</small></div>
          <button className="secondary" onClick={() => runSync(false)} disabled={syncing || !online}><RefreshCw size={17} />{syncing ? t('كنمزامنو...', 'Synchronisation...') : t('مزامنة الآن', 'Synchroniser')}</button>
        </div>

        <div className="data-tip"><Info size={17} />{t('لا تنشر الأثمنة التي يرسلها المستخدمون مباشرة. خاص مراجعة المتجر، التاريخ، الحجم، والصورة أو الفاتورة قبل اعتمادها.', 'Ne publiez pas automatiquement les prix soumis. Vérifiez le magasin, la date, le format et une preuve avant validation.')}</div>
      </section>}

      {notice && <div className="toast glass" role="status" onClick={() => setNotice('')}><CheckCircle2 size={18} /><span>{notice}</span><X size={16} /></div>}
    </main>

    <footer>
      <div className="footer-brand"><span className="logo sm"><ShoppingBasket size={15} /></span>SmartPrice MA</div>
      <span>{t('نسخة أولية تجريبية • الأثمنة بالدرهم المغربي', 'Version MVP • Prix en dirham marocain')}</span>
      <span>© 2026</span>
    </footer>

    {/* ---------------- mobile bottom nav ---------------- */}
    <nav className="bottom-nav glass mobile-only" aria-label={t('التنقل', 'Navigation')}>
      {tabs.map(x => <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => setTab(x.id)}>
        <span className="bn-icon">{x.icon}{!!x.badge && <b key={bump} className="badge">{x.badge}</b>}</span>
        <span>{x.label}</span>
      </button>)}
    </nav>

    <LocationModal open={locOpen} onClose={() => setLocOpen(false)} t={t} lang={lang} />
    {scanOpen && <Scanner t={t} onResult={onScan} onClose={() => setScanOpen(false)} />}
    {splash && <Splash t={t} onDone={doneSplash} />}
  </div>
}
