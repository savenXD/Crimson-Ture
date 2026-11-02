import { useCallback, useEffect, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { cellToLatLng, latLngToCell } from 'h3-js'
import { BANDS } from './aqi'
import { Detail, Hotspot, Meta, Metrics, Stage, getHex, getHotspots, getMeta, getMetrics, getStatus } from './api'
import { at } from './format'
import { useDebounced, useFrames } from './hooks'
import DetailView from './components/DetailView'
import Loading, { Offline } from './components/Loading'
import ApiConsole from './components/ApiConsole'
import ConnectPhone from './components/ConnectPhone'
import MapKey from './components/MapKey'
import MapView, { panelPad } from './components/MapView'
import ModelView from './components/ModelView'
import Overview from './components/Overview'
import Timeline from './components/Timeline'
import Clock from './components/Clock'
import { Icon, Logo, Skeleton } from './components/ui'

export default function App() {
  const [meta, setMeta] = useState<Meta>()
  const [offline, setOffline] = useState(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [metrics, setMetrics] = useState<Metrics>({})
  const [t, setT] = useState(0)
  const [play, setPlay] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [sel, setSel] = useState<string | null>(() => new URLSearchParams(location.search).get('area'))
  const [detail, setDetail] = useState<Detail>()
  const [detailBusy, setDetailBusy] = useState(false)
  const [spots, setSpots] = useState<Hotspot[]>([])
  const [tab, setTab] = useState<'overview' | 'model'>('overview')
  const [extrude, setExtrude] = useState(false)
  const [toast, setToast] = useState('')
  const [help, setHelp] = useState(false)
  const [apiOpen, setApiOpen] = useState(() => localStorage.getItem('nox.api') === '1')
  useEffect(() => { localStorage.setItem('nox.api', apiOpen ? '1' : '0') }, [apiOpen])
  const map = useRef<maplibregl.Map | null>(null)
  const dt = useDebounced(t, play ? 0 : 90)
  const { base, frame, stats, loaded, failed } = useFrames(meta, t)

  // meta: retry while the API is down, poll while the pipeline runs
  const fetchMeta = useCallback(() => getMeta().then((m) => {
    setOffline(false)
    setMeta((old) => {
      if (!old || (!old.ready && m.ready)) setT(Math.max(0, Math.round(m.diwali_t)))
      return m
    })
  }).catch(() => setOffline(true)), [])
  useEffect(() => { fetchMeta(); getMetrics().then(setMetrics).catch(() => {}) }, [fetchMeta])
  useEffect(() => {
    if (meta?.ready) return
    const tick = () => {
      fetchMeta()
      if (meta) { getStatus().then((r) => setStages(r.stages)).catch(() => {}); getMetrics().then(setMetrics).catch(() => {}) }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [meta?.ready, !!meta, fetchMeta])
  useEffect(() => { if (meta?.ready) getMetrics().then(setMetrics).catch(() => {}) }, [meta?.ready])

  useEffect(() => { if (meta?.ready) getHotspots(dt).then(setSpots).catch(() => {}) }, [meta?.ready, dt])
  useEffect(() => {
    if (!sel) { setDetail(undefined); return }
    let live = true
    setDetailBusy(true)
    getHex(sel, dt).then((d) => { if (live) setDetail(d) }).catch(() => live && setToast('Could not load this area')).finally(() => live && setDetailBusy(false))
    return () => { live = false }
  }, [sel, dt])

  useEffect(() => {
    if (!play || !meta) return
    const id = setInterval(() => setT((x) => (x + 1 >= meta.hours ? 0 : x + 1)), 180 / speed)
    return () => clearInterval(id)
  }, [play, meta, speed])

  useEffect(() => { if (toast) { const h = setTimeout(() => setToast(''), 3200); return () => clearTimeout(h) } }, [toast])
  useEffect(() => { if (failed) setToast('Some forecast hours failed to load') }, [failed])

  const focus = useCallback((id: string, lat?: number, lon?: number) => {
    setSel(id)
    setTab('overview')
    if (lat == null || lon == null) [lat, lon] = cellToLatLng(id)
    map.current?.flyTo({ center: [lon, lat], zoom: Math.max(map.current.getZoom(), 12), speed: 1.1, padding: panelPad(), essential: true })
  }, [])

  const locate = () => {
    if (!navigator.geolocation) return setToast('Location is not available in this browser')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const id = latLngToCell(p.coords.latitude, p.coords.longitude, 8)
        if (base?.index.has(id)) focus(id, p.coords.latitude, p.coords.longitude)
        else setToast(`You appear to be outside the ${meta?.city ?? ''} coverage area`)
      },
      () => setToast('Could not get your location'),
    )
  }

  // keyboard: space play, arrows step an hour (shift: a day), esc closes
  useEffect(() => {
    if (!meta?.ready) return
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select') && e.key !== 'Escape') return
      const step = e.shiftKey ? 24 : 1
      if (e.key === ' ') { e.preventDefault(); setPlay((p) => !p) }
      else if (e.key === 'ArrowRight') { setPlay(false); setT((x) => Math.min(meta.hours - 1, x + step)) }
      else if (e.key === 'ArrowLeft') { setPlay(false); setT((x) => Math.max(0, x - step)) }
      else if (e.key === 'Escape') { setSel(null); setHelp(false) }
      else if (e.key === 'd' || e.key === 'D') { setPlay(false); setT(Math.round(meta.diwali_t)) }
      else if (e.key === '3') setExtrude((v) => !v)
      else if (e.key === '?') setHelp((v) => !v)
      else if (e.key === 'a' || e.key === 'A') setApiOpen((v) => !v)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [meta?.ready, meta?.hours, meta?.diwali_t])

  if (offline && !meta) return <Offline onRetry={fetchMeta} />
  if (!meta) return <div className="empty"><div className="boot"><Logo size={34} /></div></div>
  if (!meta.ready) return <Loading stages={stages} metrics={metrics} />

  const range = `${at(meta, 0, { day: 'numeric', month: 'short' })} – ${at(meta, meta.hours - 1, { day: 'numeric', month: 'short' })}`

  return (
    <>
      <MapView meta={meta} base={base} frame={frame} sel={sel} onSelect={(id) => focus(id)} extrude={extrude} onMap={(m) => { map.current = m }} />
      <div className="vignette" aria-hidden />

      <header className="topbar card dock">
        <Logo />
        <b>NOx</b>
        <span className="sep" />
        <span className="city">{meta.city}</span>
        <span className="live"><i />Forecast {range}</span>
        <span className="sep" />
        <span className="meta-s"><Icon n="sensor" size={14} />{meta.stations.length} stations</span>
      </header>

      <Clock meta={meta} t={t} aqi={stats[t]?.mean} />

      <div className="legend card">
        <span className="legend-t">AQI</span>
        {BANDS.map((b, i) => (
          <div key={b.name} title={`${i ? BANDS[i - 1].max + 1 : 0}${b.max === Infinity ? '+' : `–${b.max}`}`}>
            <i style={{ background: b.color }} />{b.name}
          </div>
        ))}
      </div>

      <div className="tools card">
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">+</button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">−</button>
        <span className="tools-sep" />
        <MapKey />
        <button className={extrude ? 'on' : ''} onClick={() => setExtrude(!extrude)} aria-label="3D view" title="3D view (3)"><Icon n="cube" /></button>
        <button onClick={locate} aria-label="My location" title="My location"><Icon n="locate" /></button>
        <ConnectPhone />
        <button className={apiOpen ? 'on' : ''} onClick={() => setApiOpen(!apiOpen)} aria-label="Backend API panel" title="Backend API (A)" style={{ fontSize: 11, fontWeight: 700 }}>{'{ }'}</button>
        <button onClick={() => setHelp(!help)} aria-label="Keyboard shortcuts" title="Shortcuts (?)"><Icon n="keyboard" /></button>
      </div>

      {help && (
        <div className="help card" onClick={() => setHelp(false)}>
          <h4>Shortcuts</h4>
          {[['Space', 'Play / pause'], ['← →', 'Step one hour'], ['Shift + ← →', 'Step one day'], ['D', 'Jump to Diwali night'], ['3', 'Toggle 3D'], ['A', 'Backend API panel'], ['Esc', 'Close area']].map(([k, v]) => (
            <div key={k}><kbd>{k}</kbd><span>{v}</span></div>
          ))}
        </div>
      )}

      <ApiConsole open={apiOpen} onClose={() => setApiOpen(false)} t={dt} hex={sel} />

      {toast && <div className="toast card" key={toast}>{toast}</div>}

      <aside className="side card dock">
        {!sel && (
          <nav className="tabs">
            <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
            <button className={tab === 'model' ? 'on' : ''} onClick={() => setTab('model')}>Model accuracy</button>
            <span className="tabs-ink" style={{ transform: `translateX(${tab === 'overview' ? 0 : 100}%)` }} />
          </nav>
        )}
        <div className="side-body">
          {sel ? (
            detail ? (
              <DetailView key={detail.h3}meta={meta} d={detail} t={dt} loading={detailBusy && detail.h3 !== sel}
                onBack={() => setSel(null)} onSeek={(x) => { setPlay(false); setT(x) }} toast={setToast} />
            ) : <div className="view"><Skeleton h={90} /><Skeleton h={60} /><Skeleton h={190} /><Skeleton h={140} /></div>
          ) : tab === 'overview' ? (
            <Overview meta={meta} base={base} frame={frame} stats={stats} loaded={loaded} t={t} spots={spots}
              onSeek={(x) => { setPlay(false); setT(x) }} onFocus={(s) => focus(s.h3, s.lat, s.lon)} />
          ) : <ModelView m={metrics} />}
        </div>
      </aside>

      <Timeline meta={meta} t={t} setT={setT} play={play} setPlay={setPlay} speed={speed} setSpeed={setSpeed} stats={stats} />
    </>
  )
}
