import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { latLngToCell } from 'h3-js'
import './mobile.css'
import { BANDS, band, pmToAqi } from '../aqi'
import { Detail, Meta, Metrics, Stage, getHex, getMeta, getMetrics, getStatus } from '../api'
import { at, fullLabel, hourLabel, phaseOf } from '../format'
import { useCountUp, useDebounced, useFrames } from '../hooks'
import { AlertPreview, currentSub, disableAlerts, enableAlerts, getPreview, pushSupported, sendNow } from '../push'
import { CAUSE_COLORS, ForecastChart } from '../components/charts'
import Loading from '../components/Loading'
import MapView from '../components/MapView'
import ModelView from '../components/ModelView'
import { Gauge } from '../components/Overview'
import { Chip, Icon, Logo, Skeleton } from '../components/ui'

type Tab = 'home' | 'map' | 'forecast' | 'alerts' | 'trust'
type Lang = 'en' | 'hi'
const qp = new URLSearchParams(location.search)
const RULES0 = { headsup: true, daybefore: true, severe: true }
const stored = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } }

const I: Record<Tab, ReactElement> = {
  home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  map: <><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" /><path d="M9 4v13M15 6.5v13" /></>,
  forecast: <path d="M3 17l5-6 4 3 6-8 3 3M3 21h18" />,
  alerts: <><path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15z" /><path d="M10 21h4" /></>,
  trust: <><path d="M12 3l8 3v6c0 4.5-3.3 7.6-8 9-4.7-1.4-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
}
const LABEL: Record<Tab, string> = { home: 'Home', map: 'Map', forecast: 'Forecast', alerts: 'Alerts', trust: 'Trust' }

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

export default function MobileApp() {
  const [meta, setMeta] = useState<Meta>()
  const [stages, setStages] = useState<Stage[]>([])
  const [metrics, setMetrics] = useState<Metrics>({})
  const [tab, setTab] = useState<Tab>(() => (['home', 'map', 'forecast', 'alerts', 'trust'].includes(qp.get('tab') ?? '') ? (qp.get('tab') as Tab) : 'home'))
  const [area, setArea] = useState<string | null>(() => qp.get('area') || localStorage.getItem('nox.area'))
  const [t, setT] = useState(-1)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('nox.lang') as Lang) || 'en')
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState('')
  const [d, setD] = useState<Detail>()
  const [subbed, setSubbed] = useState(false)
  const dt = useDebounced(t, 80)
  const { base, frame, loaded } = useFrames(meta, Math.max(0, t))
  const map = useRef<maplibregl.Map | null>(null)

  // meta: poll while the pipeline is still running
  useEffect(() => {
    let live = true
    const tick = () => getMeta().then((m) => {
      if (!live) return
      setMeta((old) => {
        if (!old?.ready && m.ready) {
          const nowT = (Date.now() - new Date(m.start).getTime()) / 3600e3
          const want = Number(qp.get('t'))
          setT(qp.get('t') && Number.isFinite(want) ? want : nowT >= 0 && nowT < m.hours ? Math.floor(nowT) : Math.round(m.diwali_t))
        }
        return m
      })
      if (!m.ready) { getStatus().then((r) => live && setStages(r.stages)).catch(() => {}); getMetrics().then(setMetrics).catch(() => {}) }
    }).catch(() => {})
    tick()
    const id = setInterval(() => { if (!meta?.ready) tick() }, 3000)
    getMetrics().then(setMetrics).catch(() => {})
    return () => { live = false; clearInterval(id) }
  }, [meta?.ready])

  useEffect(() => { if (area) localStorage.setItem('nox.area', area) }, [area])
  useEffect(() => { localStorage.setItem('nox.lang', lang) }, [lang])
  useEffect(() => { if (meta?.ready && area && dt >= 0) getHex(area, dt).then(setD).catch(() => {}) }, [meta?.ready, area, dt])
  useEffect(() => { currentSub().then((s) => setSubbed(!!s)).catch(() => {}) }, [])
  useEffect(() => { if (toast) { const h = setTimeout(() => setToast(''), 3200); return () => clearTimeout(h) } }, [toast])

  const places = useMemo(() => {
    if (!meta) return []
    const seen = new Set<string>()
    return meta.stations.map((s) => ({ name: s.name, h3: latLngToCell(s.lat, s.lon, 8), last: s.last }))
      .filter((p) => !seen.has(p.name) && seen.add(p.name) && (!base || base.index.has(p.h3)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [meta, base])

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setToast('Location is not available here. Choose your area from the list.')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const id = latLngToCell(p.coords.latitude, p.coords.longitude, 8)
        if (base?.index.has(id)) { setArea(id); setSheet(false) } else setToast('You appear to be outside the Delhi coverage area')
      },
      () => setToast('Could not get your location. Choose your area from the list.'),
    )
  }, [base])

  if (!meta) return <div className="empty"><div className="boot"><Logo size={34} /></div></div>
  if (!meta.ready) return <Loading stages={stages} metrics={metrics} />

  const ready = t >= 0
  const diw = Math.round(meta.diwali_t)

  return (
    <div className="m-app">
      {tab !== 'map' && (
        <header className="m-top">
          <Logo size={22} /><b>NOx</b>
          <button className="m-area" onClick={() => setSheet(true)} aria-label="Change area">
            <Icon n="locate" size={14} /><span>{d && area ? `Near ${d.nearest_station}` : 'Choose area'}</span>
          </button>
        </header>
      )}

      {tab === 'map' ? (
        <MapTab meta={meta} base={base} frame={frame} loaded={loaded} area={area} d={d} t={t} setT={setT} onPick={setArea}
          open={() => setTab('home')} onMap={(m) => { map.current = m }} />
      ) : (
        <main className="m-main" key={tab}>
          {tab === 'home' && <Home meta={meta} d={d} t={t} setT={setT} area={area} lang={lang} setLang={setLang} diw={diw} ready={ready}
            choose={() => setSheet(true)} locate={locate} go={setTab} subbed={subbed} />}
          {tab === 'forecast' && <Forecast meta={meta} d={d} t={t} setT={setT} go={setTab} choose={() => setSheet(true)} />}
          {tab === 'alerts' && <Alerts area={area} lang={lang} setLang={setLang} subbed={subbed} setSubbed={setSubbed} toast={setToast} choose={() => setSheet(true)} />}
          {tab === 'trust' && (
            <>
              <div className="m-pagehead"><h2>Can you trust this?</h2><p>Every number comes from real data and a model tested on past Diwalis. Here is the evidence, including where it falls short.</p></div>
              <ModelView m={metrics} />
            </>
          )}
        </main>
      )}

      <nav className="m-nav" aria-label="Main">
        {(Object.keys(I) as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{I[k]}</svg>
            {LABEL[k]}
          </button>
        ))}
      </nav>

      {sheet && (
        <>
          <div className="m-sheet-bg" onClick={() => setSheet(false)} />
          <AreaSheet places={places} locate={locate} pick={(h) => { setArea(h); setSheet(false) }} />
        </>
      )}
      {toast && <div className="toast card" key={toast}>{toast}</div>}
    </div>
  )
}

/* ---------------- area picker ---------------- */
function AreaSheet({ places, locate, pick }: { places: { name: string; h3: string; last?: number | null }[]; locate: () => void; pick: (h: string) => void }) {
  const [q, setQ] = useState('')
  const rows = places.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="m-sheet" role="dialog" aria-label="Choose your area">
      <div className="grab" />
      <b style={{ fontSize: 17 }}>Where are you?</b>
      <button className="m-btn dark block" style={{ marginTop: 12 }} onClick={locate}><Icon n="locate" size={16} />Use my location</button>
      <input type="search" placeholder="Or search an area, e.g. Rohini" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="m-list">
        {rows.map((p) => <button key={p.name} onClick={() => pick(p.h3)}>{p.name}<small>{p.last != null ? 'real sensor' : ''}</small></button>)}
        {!rows.length && <p className="m-sub" style={{ padding: 8 }}>No match. Try the map tab and tap an area.</p>}
      </div>
    </div>
  )
}

/* ---------------- home ---------------- */
function hod(m: Meta, h: number) { return (+at(m, h, { hour: 'numeric', hour12: false })) % 24 }

function Home({ meta, d, t, setT, area, lang, setLang, diw, ready, choose, locate, go, subbed }: {
  meta: Meta; d?: Detail; t: number; setT: (t: number) => void; area: string | null; lang: Lang; setLang: (l: Lang) => void; diw: number
  ready: boolean; choose: () => void; locate: () => void; go: (t: Tab) => void; subbed: boolean
}) {
  const aqi = useCountUp(d?.aqi ?? 0)
  const ph = phaseOf(meta, Math.max(0, t))
  const chips = [['Day before', diw - 24], ['Diwali night', diw], ['Next morning', diw + 12]] as const

  const win = useMemo(() => {
    if (!d) return null
    const day = at(meta, t, { day: 'numeric', month: 'numeric' })
    const idx = d.series.map((p) => p.t).filter((h) => at(meta, h, { day: 'numeric', month: 'numeric' }) === day && hod(meta, h) >= 6 && hod(meta, h) <= 21)
    if (idx.length < 3) return null
    let best = 0, worst = 0, bv = 1e9, wv = -1
    for (let i = 0; i + 2 < idx.length; i++) {
      const v = (d.series[idx[i]].aqi + d.series[idx[i + 1]].aqi + d.series[idx[i + 2]].aqi) / 3
      if (v < bv) { bv = v; best = i }
      if (v > wv) { wv = v; worst = i }
    }
    const lab = (i: number) => `${hourLabel(meta, idx[i])} – ${hourLabel(meta, idx[i] + 3)}`
    return { best: lab(best), bestV: Math.round(bv), worst: lab(worst), worstV: Math.round(wv) }
  }, [d, meta, t])

  if (!area) {
    return (
      <div className="m-card m-hero">
        <div className="when">WELCOME</div>
        <h2 style={{ fontSize: 26, letterSpacing: '-.03em', margin: '10px 0 6px' }}>Know your street's Diwali air before it happens.</h2>
        <p className="m-sub">Tell us where you are and we'll show the forecast for your neighbourhood, what to do, and warn you before the air turns bad.</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <button className="m-btn dark block" onClick={locate}><Icon n="locate" size={16} />Use my location</button>
          <button className="m-btn block" onClick={choose}>Choose my area</button>
        </div>
      </div>
    )
  }
  if (!d || !ready) return <><div className="m-card"><Skeleton h={200} /></div><div className="m-card"><Skeleton h={90} /></div></>

  const strip = d.series.slice(t, Math.min(d.series.length, t + 24))
  const max = 500

  return (
    <>
      <div className="m-card m-hero">
        <div className="m-chips">
          {chips.map(([n, h]) => <button key={n} className={Math.abs(t - h) <= 1 ? 'on' : ''} onClick={() => setT(h)}>{n}</button>)}
        </div>
        <div className="when">{fullLabel(meta, t).toUpperCase()} · {ph.name.toUpperCase()}</div>
        <div className="m-big">
          <div className="n">{aqi}</div>
          <Chip aqi={d.aqi} label={d.category} />
        </div>
        <Gauge value={d.aqi} lo={Math.round(pmToAqi(d.p10))} hi={Math.round(pmToAqi(d.p90))} />
        <p className="m-sub">PM2.5 {d.pm25} µg/m³, likely {Math.round(d.p10)}–{Math.round(d.p90)}. {d.dist_km < 1.5 ? 'A real sensor is nearby.' : `The nearest real sensor is ${d.dist_km} km away, so this is an estimate.`}</p>
        <input className="m-scrub" type="range" min={0} max={meta.hours - 1} value={t} onChange={(e) => setT(+e.target.value)} aria-label="Hour" />
      </div>

      <div className="m-card">
        <h4>WHAT TO DO <span className="m-seg"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button><button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिं</button></span></h4>
        <p className="m-advice">{d.advice[lang]}</p>
        <a className="m-btn block" style={{ marginTop: 12 }} href={`https://wa.me/?text=${encodeURIComponent(d.alert[lang])}`} target="_blank" rel="noreferrer"><Icon n="share" size={16} />Share this on WhatsApp</a>
      </div>

      {win && (
        <div className="m-card">
          <h4>TIME OF DAY <em>{at(meta, t, { weekday: 'short', day: 'numeric', month: 'short' })}, 6 AM – 10 PM</em></h4>
          <div className="m-win">
            <div><small>Best time to go out</small><b>{win.best}</b><em>AQI about {win.bestV}</em></div>
            <div><small>Worst time</small><b>{win.worst}</b><em>AQI about {win.worstV}</em></div>
          </div>
        </div>
      )}

      <div className="m-card">
        <h4>NEXT 24 HOURS <em>tap an hour</em></h4>
        <div className="m-strip">
          {strip.map((p, i) => (
            <button key={p.t} className={i === 0 ? 'on' : ''} onClick={() => setT(p.t)} aria-label={`${hourLabel(meta, p.t)} AQI ${p.aqi}`}>
              <i style={{ height: `${Math.max(8, (Math.min(p.aqi, max) / max) * 72)}px`, background: band(p.aqi).color }} />
              <span>{i % 3 === 0 ? at(meta, p.t, { hour: 'numeric', hour12: true }).replace(' ', '').toLowerCase() : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {d.causes && (
        <div className="m-card">
          <h4>WHAT IS CAUSING IT</h4>
          {d.causes.map((c) => (
            <div className="m-cause" key={c.name}>
              <span>{c.name}</span><b>{Math.round(c.share * 100)}%</b>
              <div className="bar"><i style={{ width: `${c.share * 100}%`, background: CAUSE_COLORS[c.name] ?? '#0f1115' }} /></div>
            </div>
          ))}
        </div>
      )}

      <button className="m-card" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => go('alerts')}>
        <Icon n="alert" size={20} />
        <span style={{ flex: 1 }}><b style={{ fontSize: 14.5 }}>{subbed ? 'Alerts are on' : 'Get warned before it gets bad'}</b><span className="m-sub" style={{ display: 'block', marginTop: 2 }}>{subbed ? 'We will notify you for this area.' : 'Turn on alerts for this area.'}</span></span>
        <span style={{ color: 'var(--muted)' }}>›</span>
      </button>
    </>
  )
}

/* ---------------- forecast ---------------- */
function Forecast({ meta, d, t, setT, go, choose }: { meta: Meta; d?: Detail; t: number; setT: (t: number) => void; go: (t: Tab) => void; choose: () => void }) {
  if (!d) return <div className="m-card"><p className="m-sub">Choose your area to see its forecast.</p><button className="m-btn dark block" style={{ marginTop: 10 }} onClick={choose}>Choose my area</button></div>
  const days = Array.from({ length: Math.ceil(meta.hours / 24) }, (_, k) => {
    const s = d.series.slice(k * 24, k * 24 + 24)
    const pk = s.reduce((a, b) => (b.aqi > a.aqi ? b : a), s[0])
    return { k, pk, avg: Math.round(s.reduce((a, b) => a + b.aqi, 0) / s.length), label: at(meta, k * 24, { weekday: 'short', day: 'numeric', month: 'short' }) }
  })
  return (
    <>
      <div className="m-pagehead"><h2>6-day forecast</h2><p>Near {d.nearest_station}. AQI from PM2.5, hour by hour.</p></div>
      <div className="m-card"><ForecastChart meta={meta} series={d.series} t={t} peak={d.peak_t} onSeek={setT} /></div>
      <div className="m-card">
        <h4>DAY BY DAY <em>peak of the day</em></h4>
        {days.map((x) => (
          <button className="m-day" key={x.k} onClick={() => { setT(x.pk.t); go('home') }}>
            <span className="d">{x.label}<small>peak {hourLabel(meta, x.pk.t)} · average {x.avg}</small></span>
            <span className="p" style={{ background: band(x.pk.aqi).color, color: band(x.pk.aqi).ink }}>{x.pk.aqi}</span>
          </button>
        ))}
      </div>
      <p className="m-sub" style={{ padding: '0 4px' }}>The forecast is a floor on Diwali night: past tests show the model tends to under-call the sharpest peak.</p>
    </>
  )
}

/* ---------------- map ---------------- */
function MapTab({ meta, base, frame, loaded, area, d, t, setT, onPick, open, onMap }: {
  meta: Meta; base: ReturnType<typeof useFrames>['base']; frame: ReturnType<typeof useFrames>['frame']; loaded: number; area: string | null
  d?: Detail; t: number; setT: (t: number) => void; onPick: (h: string) => void; open: () => void; onMap: (m: maplibregl.Map) => void
}) {
  return (
    <>
      <div className="m-mapwrap" style={{ position: 'absolute', inset: 0, bottom: 'calc(var(--nav) + env(safe-area-inset-bottom))' }}>
        <MapView meta={meta} base={base} frame={frame} sel={area} onSelect={onPick} extrude={false} onMap={onMap} />
      </div>
      <div className="m-leg" aria-hidden>{BANDS.map((b) => <i key={b.name} style={{ background: b.color }} />)}</div>
      <div className="m-mapcard">
        {d && area ? (
          <div className="r">
            <div className="n" style={{ color: band(d.aqi).color }}>{d.aqi}</div>
            <div className="x"><b>{d.category}</b><small>Near {d.nearest_station} · {d.dist_km} km to a real sensor</small></div>
            <button className="m-btn dark" onClick={open}>Details</button>
          </div>
        ) : <div className="m-sub" style={{ margin: 0 }}>Tap any hexagon to see its air quality. Circles are real sensors.</div>}
        <div>
          <div className="r" style={{ justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)' }}>
            <span>{fullLabel(meta, Math.max(0, t))}</span>
            <button style={{ fontWeight: 700, color: 'var(--ink)' }} onClick={() => setT(Math.round(meta.diwali_t))}>Diwali night</button>
          </div>
          <input className="m-scrub" style={{ margin: '8px 0 0' }} type="range" min={0} max={meta.hours - 1} value={Math.max(0, t)} onChange={(e) => setT(+e.target.value)} aria-label="Hour" />
          {loaded < meta.hours * 0.02 && <span className="m-sub">Loading map…</span>}
        </div>
      </div>
    </>
  )
}

/* ---------------- alerts ---------------- */
function Alerts({ area, lang, setLang, subbed, setSubbed, toast, choose }: {
  area: string | null; lang: Lang; setLang: (l: Lang) => void; subbed: boolean; setSubbed: (b: boolean) => void; toast: (s: string) => void; choose: () => void
}) {
  const [rules, setRules] = useState(() => stored('nox.rules', RULES0))
  const [list, setList] = useState<AlertPreview[]>([])
  const [busy, setBusy] = useState(false)
  const [install, setInstall] = useState<Event & { prompt?: () => void } | null>(null)
  const can = pushSupported()

  useEffect(() => { localStorage.setItem('nox.rules', JSON.stringify(rules)) }, [rules])
  useEffect(() => { if (area) getPreview(area, lang).then((r) => setList(r.alerts)).catch(() => {}) }, [area, lang])
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setInstall(e as Event & { prompt?: () => void }) }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const toggle = async () => {
    if (!area) return choose()
    setBusy(true)
    try {
      if (subbed) { await disableAlerts(); setSubbed(false); toast('Alerts turned off') }
      else { await enableAlerts(area, lang, rules); setSubbed(true); toast('Alerts are on. Check your notifications.') }
    } catch (e) {
      const m = (e as Error).message
      toast(m === 'denied' ? 'Notifications are blocked. Allow them in your browser settings.' : m === 'unsupported' ? 'This connection can’t send notifications. See the note below.' : 'Could not change alerts. Try again.')
    } finally { setBusy(false) }
  }
  const test = (k: 'test' | 'daybefore' | 'headsup' | 'severe') => sendNow(k).then(() => toast('Sent. Look at your notifications.')).catch(() => toast('Turn alerts on first'))

  return (
    <>
      <div className="m-pagehead"><h2>Alerts</h2><p>We notify you when the air around you is about to turn bad, so you can act before it does.</p></div>
      <div className="m-card">
        <div className="m-row" style={{ borderTop: 0, paddingTop: 0 }}>
          <span><b>Notify me</b><small>{area ? 'For the area you chose' : 'Choose your area first'}</small></span>
          <button className={`m-switch ${subbed ? 'on' : ''}`} onClick={toggle} disabled={busy} role="switch" aria-checked={subbed} aria-label="Notify me" />
        </div>
        <div className="m-row"><span>Language</span><span className="m-seg"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button><button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिं</button></span></div>
        {([['daybefore', 'Day-before summary', 'The morning before Diwali'], ['headsup', 'Heads-up', '3 hours before the air turns Very Poor'], ['severe', 'Severe air', 'When it reaches Severe']] as const).map(([k, n, s]) => (
          <div className="m-row" key={k}><span>{n}<small>{s}</small></span>
            <button className={`m-switch ${rules[k] ? 'on' : ''}`} onClick={() => setRules({ ...rules, [k]: !rules[k] })} role="switch" aria-checked={rules[k]} aria-label={n} /></div>
        ))}
        {!can && <div className="m-note">Phone notifications need a secure (https) connection, and this one is {location.protocol.replace(':', '')}. The alerts below show exactly what would be sent. You can still share any of them on WhatsApp.</div>}
      </div>

      {area && (
        <div className="m-card">
          <h4>WHAT WE WILL SEND <em>for your area</em></h4>
          {list.map((a) => (
            <div className="m-alert" key={a.kind}>
              <div className="t"><i style={{ background: a.level === 'severe' ? '#8e2c48' : '#f2994a' }} />{when(a.send_at)}</div>
              <b>{a.title}</b><p>{a.body}</p>
              <div className="acts">
                <a href={`https://wa.me/?text=${encodeURIComponent(a.title + '. ' + a.body)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
                {subbed && <button onClick={() => test(a.kind as 'daybefore' | 'headsup' | 'severe')}>Send me this now</button>}
              </div>
            </div>
          ))}
          {subbed && <button className="m-btn block" style={{ marginTop: 10 }} onClick={() => test('test')}>Send a test notification</button>}
        </div>
      )}

      <div className="m-card">
        <h4>INSTALL THE APP</h4>
        {install ? <button className="m-btn dark block" onClick={() => (install as unknown as { prompt: () => void }).prompt()}>Install NOx on this phone</button>
          : <p className="m-sub" style={{ margin: 0 }}>On Android: browser menu → Install app. On iPhone: Share → Add to Home Screen. Installing needs a secure (https) link.</p>}
      </div>
    </>
  )
}
