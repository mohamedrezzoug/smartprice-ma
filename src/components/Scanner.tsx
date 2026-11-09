import {useEffect, useRef, useState} from 'react'
import {X} from 'lucide-react'
import type {T} from '../i18n'

type Props = {t: T; onResult: (code: string) => void; onClose: () => void}
type DetectorCtor = new (o?: {formats?: string[]}) => {detect(v: HTMLVideoElement): Promise<{rawValue: string}[]>}

/** Camera barcode scanner: native BarcodeDetector when available, @zxing/browser otherwise. Needs HTTPS or localhost. */
export default function Scanner({t, onResult, onClose}: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopZxing: (() => void) | undefined
    const done = (code: string) => { if (stopped) return; stopped = true; navigator.vibrate?.(80); onResult(code) }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError(t('الكاميرا غير متوفرة هنا (خاص HTTPS أو localhost).', 'Caméra indisponible ici (HTTPS ou localhost requis).')); return }
      const Native = (window as unknown as {BarcodeDetector?: DetectorCtor}).BarcodeDetector
      const constraints: MediaStreamConstraints = {video: {facingMode: {ideal: 'environment'}}, audio: false}
      try {
        if (Native) {
          const detector = new Native({formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']})
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          if (stopped) { stream.getTracks().forEach(x => x.stop()); return }
          const v = video.current!; v.srcObject = stream; await v.play()
          timer = window.setInterval(async () => {
            try { const found = await detector.detect(v); if (found[0]) done(found[0].rawValue) } catch { /* empty frame */ }
          }, 300)
        } else {
          const {BrowserMultiFormatReader} = await import('@zxing/browser')
          const controls = await new BrowserMultiFormatReader().decodeFromConstraints(constraints, video.current!, result => { if (result) done(result.getText()) })
          stopZxing = () => controls.stop()
          if (stopped) controls.stop()
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setError(name === 'NotAllowedError' ? t('رفضتي إذن الكاميرا. فعّلو من إعدادات المتصفح.', 'Accès caméra refusé. Autorisez-le dans les réglages.')
          : name === 'NotFoundError' ? t('ما لقيت حتى كاميرا.', 'Aucune caméra trouvée.')
          : t('تعذر تشغيل الكاميرا.', 'Impossible de démarrer la caméra.'))
      }
    }
    start()
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      stopZxing?.()
      stream?.getTracks().forEach(x => x.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="sp-scanner-backdrop" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="sp-scanner glass">
      <div className="sp-scanner-head"><b>{t('مسح الباركود', 'Scanner un code-barres')}</b><button className="sp-hbtn" onClick={onClose} aria-label={t('إغلاق', 'Fermer')}><X size={18} /></button></div>
      <div className="sp-scanner-view"><video ref={video} playsInline muted /><span className="sp-scan-line" /></div>
      {error && <p className="sp-scanner-error">{error}</p>}
      <form className="sp-scanner-manual" onSubmit={e => { e.preventDefault(); if (manual.trim()) onResult(manual.trim()) }}>
        <input inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} placeholder={t('ولا كتب رقم الباركود...', 'Ou saisissez le code-barres...')} />
        <button className="primary" type="submit">{t('بحث', 'Chercher')}</button>
      </form>
    </div>
  </div>
}
