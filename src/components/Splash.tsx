import {useEffect, useState} from 'react'
import type {T} from '../i18n'

/** 3D splash screen: a spinning cube in pure CSS (no library). */
export default function Splash({t, onDone}: {t: T; onDone: () => void}) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const a = window.setTimeout(() => setLeaving(true), reduce ? 300 : 1900)
    const b = window.setTimeout(onDone, reduce ? 600 : 2300)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [onDone])
  return <div className={'sp-splash' + (leaving ? ' leaving' : '')} aria-hidden="true">
    <div className="sp-scene"><div className="sp-cube">
      {['front', 'back', 'right', 'left', 'top', 'bottom'].map(f => <div key={f} className={'sp-face ' + f}>{f === 'top' || f === 'bottom' ? '' : 'SP'}</div>)}
    </div></div>
    <b className="sp-splash-title">SmartPrice <span>MA</span></b>
    <small>{t('قارن ووفر فمشترياتك', 'Comparez et économisez')}</small>
  </div>
}
