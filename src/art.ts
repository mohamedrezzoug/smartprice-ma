/* ------------------------------------------------------------------ *
 * Non-component helpers for the 3D illustrations. Kept out of
 * illustrations.tsx so that file exports only React components
 * (required for Vite / React Fast Refresh).
 * ------------------------------------------------------------------ */

export type ArtKind =
  | 'oil' | 'sugar' | 'milk' | 'flour' | 'rice' | 'pasta' | 'tea'
  | 'cleaner' | 'detergent' | 'diapers' | 'water' | 'towels' | 'bag'

const KEYWORDS: [ArtKind, RegExp][] = [
  ['oil', /huile|oil|زيت/i], ['sugar', /sucre|sugar|سكر/i], ['milk', /lait|milk|حليب|yaourt|لبن/i],
  ['flour', /farine|flour|دقيق|طحين/i], ['rice', /riz|rice|أرز|رز/i], ['pasta', /p[aâ]tes|pasta|معكرونة|شعرية/i],
  ['tea', /th[eé]|tea|شاي|caf[eé]|قهوة/i], ['detergent', /lessive|détergent|غسيل/i],
  ['cleaner', /nettoyant|javel|منظف|جافيل/i], ['diapers', /couche|حفاض/i],
  ['towels', /essuie|papier|ورق|mouchoir/i], ['water', /\beau\b|water|ماء|soda|\bjus\b|عصير/i],
]

const CATEGORY_ART: Record<string, ArtKind> = {
  grocery: 'bag', dairy: 'milk', cleaning: 'cleaner', baby: 'diapers', drinks: 'water', all: 'bag',
}

/** Picks the best illustration for a product, by name first then category. */
export function artFor(p: {name: string; nameFr: string; category: string}): ArtKind {
  const text = `${p.nameFr} ${p.name}`
  for (const [kind, re] of KEYWORDS) if (re.test(text)) return kind
  return CATEGORY_ART[p.category] || 'bag'
}

export function categoryArt(id: string): ArtKind {
  return CATEGORY_ART[id] || 'bag'
}
