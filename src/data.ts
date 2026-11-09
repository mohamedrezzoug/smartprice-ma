import type {PriceRecord} from './pricing'

/** A retail chain. Prices are attached per city through PriceRecord. */
export type Store = {id: string; name: string; nameFr: string; tint: string}
export type Product = {id: string; name: string; nameFr: string; category: string; unit: string; barcode?: string}

/**
 * A physical branch of a chain. Coordinates are OPTIONAL and must come from a real
 * source (admin entry from a verified address, or OpenStreetMap). Never invent them.
 */
export type Branch = {
  id: string
  storeId: string
  cityId: string
  neighborhoodId?: string
  name?: string
  address?: string
  lat?: number
  lng?: number
  source: 'local' | 'osm'
}

export const stores: Store[] = [
  {id: 'aswak', name: 'أسواق السلام', nameFr: 'Aswak Assalam', tint: '#10b981'},
  {id: 'marjane', name: 'مرجان', nameFr: 'Marjane', tint: '#0ea5e9'},
  {id: 'carrefour', name: 'كارفور', nameFr: 'Carrefour', tint: '#6366f1'},
  {id: 'bim', name: 'بيم', nameFr: 'BIM', tint: '#f43f5e'},
  {id: 'atacadao', name: 'أتقداو', nameFr: 'Atacadão', tint: '#f59e0b'},
  {id: 'kazyon', name: 'كازيون', nameFr: 'Kazyon', tint: '#8b5cf6'},
]

export const seedProducts: Product[] = [
  {id: 'p1', name: 'زيت المائدة 1 لتر', nameFr: 'Huile de table 1 L', category: 'grocery', unit: '1 L', barcode: '611100000001'},
  {id: 'p2', name: 'سكر سنيدة 1 كلغ', nameFr: 'Sucre granulé 1 kg', category: 'grocery', unit: '1 kg', barcode: '611100000002'},
  {id: 'p3', name: 'حليب UHT 1 لتر', nameFr: 'Lait UHT 1 L', category: 'dairy', unit: '1 L', barcode: '611100000003'},
  {id: 'p4', name: 'دقيق القمح 1 كلغ', nameFr: 'Farine de blé 1 kg', category: 'grocery', unit: '1 kg', barcode: '611100000004'},
  {id: 'p5', name: 'أرز 1 كلغ', nameFr: 'Riz 1 kg', category: 'grocery', unit: '1 kg', barcode: '611100000005'},
  {id: 'p6', name: 'معكرونة 500 غ', nameFr: 'Pâtes 500 g', category: 'grocery', unit: '500 g', barcode: '611100000006'},
  {id: 'p7', name: 'شاي أخضر 200 غ', nameFr: 'Thé vert 200 g', category: 'grocery', unit: '200 g', barcode: '611100000007'},
  {id: 'p8', name: 'منظف أرضيات 1 لتر', nameFr: 'Nettoyant sol 1 L', category: 'cleaning', unit: '1 L', barcode: '611100000008'},
  {id: 'p9', name: 'مسحوق الغسيل 1 كلغ', nameFr: 'Lessive poudre 1 kg', category: 'cleaning', unit: '1 kg', barcode: '611100000009'},
  {id: 'p10', name: 'حفاضات أطفال - حجم 4', nameFr: 'Couches bébé - taille 4', category: 'baby', unit: 'paquet', barcode: '611100000010'},
  {id: 'p11', name: 'ماء معدني 5 لتر', nameFr: 'Eau minérale 5 L', category: 'drinks', unit: '5 L', barcode: '611100000011'},
  {id: 'p12', name: 'ورق المطبخ - 2 رول', nameFr: 'Essuie-tout - 2 rouleaux', category: 'cleaning', unit: '2 rouleaux', barcode: '611100000012'},
]

/* ---------------------------------------------------------------------------
 * DEMO prices (illustrative, NOT real offers). Status 'user' = unverified.
 * Casablanca keeps the original MVP sample prices; Rabat has a smaller,
 * independent sample to demonstrate that cities are never mixed.
 * ------------------------------------------------------------------------- */
const rec = (cityId: string, updatedAt: string, productId: string, prices: Record<string, number>, area?: string): PriceRecord[] =>
  Object.entries(prices).map(([storeId, price]) => ({productId, storeId, cityId, area, price, updatedAt, status: 'user' as const}))

export const seedPrices: PriceRecord[] = [
  // Casablanca
  ...rec('casablanca', '2026-11-04', 'p1', {aswak: 16.95, marjane: 17.5, carrefour: 18.2, atacadao: 16.7}),
  ...rec('casablanca', '2026-11-04', 'p2', {aswak: 6.15, marjane: 6.5, carrefour: 6.9, bim: 6.25}),
  ...rec('casablanca', '2026-11-03', 'p3', {aswak: 9.9, marjane: 10.2, carrefour: 9.95, kazyon: 9.8}),
  ...rec('casablanca', '2026-11-03', 'p4', {aswak: 7.2, marjane: 7.1, carrefour: 7.5, atacadao: 6}),
  ...rec('casablanca', '2026-11-02', 'p5', {aswak: 13.6, marjane: 14.2, carrefour: 14.95, bim: 13.9}),
  ...rec('casablanca', '2026-11-02', 'p6', {aswak: 9.75, marjane: 10.5, carrefour: 15.8}),
  ...rec('casablanca', '2026-09-18', 'p7', {aswak: 13.95, marjane: 15.5, carrefour: 16.95}),
  ...rec('casablanca', '2026-11-01', 'p8', {aswak: 18.9, marjane: 19.5, carrefour: 17.9, bim: 16.9}),
  ...rec('casablanca', '2026-11-01', 'p9', {aswak: 22.95, marjane: 24.9, carrefour: 23.5}),
  ...rec('casablanca', '2026-09-25', 'p10', {aswak: 89.9, marjane: 94.5, carrefour: 91.9}),
  ...rec('casablanca', '2026-11-05', 'p11', {aswak: 10.95, marjane: 10.5, carrefour: 10.9, atacadao: 9.25}),
  ...rec('casablanca', '2026-11-05', 'p12', {aswak: 19.9, marjane: 21.5, bim: 18.9}),
  // Rabat (independent sample)
  ...rec('rabat', '2026-11-06', 'p1', {aswak: 17.2, marjane: 17.4, carrefour: 18.5}),
  ...rec('rabat', '2026-11-06', 'p2', {aswak: 6.3, marjane: 6.45, bim: 6.2}),
  ...rec('rabat', '2026-11-06', 'p3', {marjane: 10.1, carrefour: 10.3, bim: 9.95}),
  ...rec('rabat', '2026-11-05', 'p5', {aswak: 13.9, marjane: 14.1, carrefour: 14.6}),
  ...rec('rabat', '2026-11-05', 'p11', {aswak: 10.8, marjane: 10.6, carrefour: 11.2, bim: 10.4}),
  ...rec('rabat', '2026-10-01', 'p8', {marjane: 19.9, carrefour: 18.4}),
]

/** No seed branches: real addresses/coordinates must be added by an admin or found on OpenStreetMap. */
export const seedBranches: Branch[] = []

export const categories = [
  {id: 'all', ar: 'جميع المنتجات', fr: 'Tous'},
  {id: 'grocery', ar: 'مواد غذائية', fr: 'Épicerie'},
  {id: 'dairy', ar: 'الحليب ومشتقاته', fr: 'Produits laitiers'},
  {id: 'cleaning', ar: 'مواد التنظيف', fr: 'Entretien'},
  {id: 'baby', ar: 'مستلزمات الأطفال', fr: 'Bébé'},
  {id: 'drinks', ar: 'الماء والمشروبات', fr: 'Boissons'},
]
