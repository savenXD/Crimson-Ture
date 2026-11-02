import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import '../connect.css'

/** Toolbar button: shows a QR code and link so a phone on the same Wi-Fi can open this app. */
export default function ConnectPhone() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || url) return
    fetch('/api/connect').then((r) => r.json()).then((d) => {
      setUrl(d.url)
      QRCode.toDataURL(d.url, { margin: 1, width: 360, color: { dark: '#0f1115', light: '#ffffff' } }).then(setQr)
    }).catch(() => setUrl(''))
  }, [open, url])
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', on)
    return () => window.removeEventListener('mousedown', on)
  }, [open])

  return (
    <div className="cp-wrap" ref={box}>
      <button className={open ? 'on' : ''} onClick={() => setOpen(!open)} aria-label="Open on your phone" title="Open on your phone">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="4.5" y="1.5" width="7" height="13" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 12.4h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
      <div className={`cp-pop card ${open ? 'on' : ''}`}>
        <b>Open on your phone</b>
        <p>Connect the phone to the <b>same Wi-Fi</b> as this computer, then scan.</p>
        {qr ? <img src={qr} alt="QR code to open NOx on your phone" width={180} height={180} /> : <div className="cp-ph" />}
        <code>{url || '…'}</code>
        <button className="cp-copy" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400) }}>{copied ? 'Copied' : 'Copy link'}</button>
        <small>It loads the same live forecast from this computer. Install-as-app and offline mode need https; on plain Wi-Fi it opens as a normal web page.</small>
      </div>
    </div>
  )
}
