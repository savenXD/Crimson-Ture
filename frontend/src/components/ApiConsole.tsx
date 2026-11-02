import { useEffect, useMemo, useState } from 'react'
import '../api-console.css'
import { Icon } from './ui'

type Ep = { path: string; desc: string; params?: ('t' | 'h3')[] }
const EPS: Ep[] = [
  { path: '/api/health', desc: 'Is the server up, and is a forecast loaded?' },
  { path: '/api/meta', desc: 'City, forecast window, and every station with its latest real reading' },
  { path: '/api/hexes', desc: 'Forecast PM2.5 and AQI for all hexagons at one hour', params: ['t'] },
  { path: '/api/hex/{h3}', desc: 'One hexagon: range, 6-day series, causes, advice, alert text', params: ['h3', 't'] },
  { path: '/api/hotspots', desc: 'Worst-hit areas at one hour', params: ['t'] },
  { path: '/api/model', desc: 'Which model runs, its settings, machine and data freshness' },
  { path: '/api/model/live', desc: 'Runs the real model now for one hexagon and hour', params: ['h3', 't'] },
  { path: '/api/metrics', desc: 'Test results: hidden-sensor and unseen-Diwali tests' },
  { path: '/api/proof', desc: 'Past-Diwali replay, latest real readings, file fingerprints' },
  { path: '/api/status', desc: 'Pipeline progress' },
]

/** Shorten long arrays so a 2,000-item response stays readable. */
function trunc(v: unknown, d = 0): unknown {
  if (Array.isArray(v)) {
    const head = v.slice(0, 3).map((x) => trunc(x, d + 1))
    return v.length > 3 ? [...head, `… ${v.length - 3} more`] : head
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trunc(x, d + 1)]))
  return v
}

type Res = { url: string; status: number; ms: number; bytes: number; body: string }

export default function ApiConsole({ open, onClose, t, hex }: { open: boolean; onClose: () => void; t: number; hex: string | null }) {
  const [i, setI] = useState(2)
  const [pt, setPt] = useState(t)
  const [ph, setPh] = useState(hex ?? '')
  const [res, setRes] = useState<Res>()
  const [busy, setBusy] = useState(false)
  const [full, setFull] = useState(false)
  const [board, setBoard] = useState<{ path: string; status: number; ms: number }[]>([])
  const [copied, setCopied] = useState(false)
  const ep = EPS[i]

  useEffect(() => { setPt(t) }, [t])
  useEffect(() => { if (hex) setPh(hex) }, [hex])

  const url = useMemo(() => {
    let u = ep.path.replace('{h3}', ph || '<h3>')
    const q: string[] = []
    if (ep.params?.includes('t')) q.push(`t=${pt}`)
    if (ep.path === '/api/model/live') q.push(`h3=${ph}`)
    return q.length ? `${u}?${q.join('&')}` : u
  }, [ep, pt, ph])

  const call = async (u: string) => {
    const t0 = performance.now()
    const r = await fetch(u)
    const txt = await r.text()
    return { url: u, status: r.status, ms: Math.round(performance.now() - t0), bytes: txt.length, body: txt }
  }
  const send = async () => { setBusy(true); setFull(false); try { setRes(await call(url)) } finally { setBusy(false) } }
  const runAll = async () => {
    setBoard([])
    const h = ph || hex || ''
    for (const e of EPS) {
      const u = e.path.replace('{h3}', h) + (e.params?.includes('t') ? `?t=${t}` : '') + (e.path === '/api/model/live' ? `${e.params?.includes('t') ? '&' : '?'}h3=${h}` : '')
      const r = await call(u).catch(() => ({ status: 0, ms: 0 }))
      setBoard((b) => [...b, { path: e.path, status: r.status, ms: r.ms }])
    }
  }
  const curl = `curl "${location.origin}${url}"`
  const shown = useMemo(() => {
    if (!res) return ''
    try { const j = JSON.parse(res.body); return JSON.stringify(full ? j : trunc(j), null, 2) } catch { return res.body }
  }, [res, full])

  return (
    <aside className={`api card ${open ? 'on' : ''}`} aria-hidden={!open}>
      <header className="api-h">
        <div><b>Backend API</b><span>{location.origin}</span></div>
        <div className="api-hb">
          <a href="/docs" target="_blank" rel="noreferrer">Swagger docs ↗</a>
          <button onClick={onClose} aria-label="Hide API panel">✕</button>
        </div>
      </header>

      <div className="api-eps">
        {EPS.map((e, k) => (
          <button key={e.path} className={k === i ? 'on' : ''} onClick={() => { setI(k); setRes(undefined) }}>
            <span className="m">GET</span><span className="p">{e.path}</span>
          </button>
        ))}
      </div>

      <p className="api-d">{ep.desc}</p>
      <div className="api-params">
        {ep.params?.includes('h3') && <label>h3<input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="pick an area on the map" /></label>}
        {ep.params?.includes('t') && <label>t (hour)<input type="number" min={0} max={143} value={pt} onChange={(e) => setPt(+e.target.value)} /></label>}
      </div>
      <div className="api-url"><code>{url}</code><button onClick={() => { navigator.clipboard?.writeText(curl); setCopied(true); setTimeout(() => setCopied(false), 1400) }} title="Copy as curl">{copied ? <Icon n="check" size={14} /> : <Icon n="copy" size={14} />}</button></div>
      <div className="api-actions">
        <button className="go" onClick={send} disabled={busy || (ep.params?.includes('h3') && !ph)}>{busy ? 'Calling…' : 'Send request'}</button>
        <button onClick={runAll}>Test all endpoints</button>
      </div>

      {board.length > 0 && (
        <div className="api-board">
          {board.map((b) => (
            <div key={b.path}><i className={b.status === 200 ? 'ok' : 'bad'} /><span>{b.path}</span><b>{b.status || 'ERR'}</b><em>{b.ms} ms</em></div>
          ))}
        </div>
      )}

      {res && (
        <div className="api-res">
          <div className="api-meta">
            <span className={res.status === 200 ? 'ok' : 'bad'}>{res.status}</span><span>{res.ms} ms</span><span>{(res.bytes / 1024).toFixed(1)} KB</span>
            <button onClick={() => setFull(!full)}>{full ? 'Shorten' : 'Show full'}</button>
          </div>
          <pre>{shown}</pre>
        </div>
      )}
    </aside>
  )
}
