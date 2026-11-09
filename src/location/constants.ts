/** Shared location constants (kept out of component files for React Fast Refresh). */

/** Distance filters (km) offered in the nearby-stores view. */
export const RADII = [2, 5, 10, 20] as const
export type RadiusKm = (typeof RADII)[number]

/** Default distance filter (km). */
export const DEFAULT_RADIUS_KM: RadiusKm = 5
