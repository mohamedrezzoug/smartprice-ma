import {useEffect, useReducer, type ReactNode} from 'react'
import {LocationContext, STORAGE_KEY, initialLocation, loadLocation, locationReducer, serializeLocation} from './state'

/**
 * Provides the centralized location state to the app and persists it.
 * Only manual preferences are stored; GPS coordinates only with consent
 * (see serializeLocation in ./state).
 */
export function LocationProvider({children, storage}: {children: ReactNode; storage?: Storage}) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
  const [loc, dispatch] = useReducer(locationReducer, undefined, () => store ? loadLocation(store) : {...initialLocation})
  useEffect(() => { store?.setItem(STORAGE_KEY, serializeLocation(loc)) }, [loc, store])
  return <LocationContext.Provider value={{loc, dispatch}}>{children}</LocationContext.Provider>
}
