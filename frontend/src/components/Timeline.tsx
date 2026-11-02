import { PointerEvent as RPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BANDS, band } from '../aqi'
import { Meta } from '../api'
import { at, dayTicks, fullLabel, hourLabel, phaseOf } from '../format'
import { HourStat } from '../hooks'
import { Icon } from './ui'

/** Stacked share of the city in each AQI band, hour by hour, drawn to line up exactly with the slider. */
function ShareStrip({ hours, stats }: { hours: number; stats: (HourStat | undefined)[] }) {
  const paths = useMemo(() => {
    const ks = stats.map((s, k) => (s ? k : -1)).filter((k) => k >= 0)
    if (ks.length < 2) return []
    const cum = ks.map((k) => { let a = 0; return [0, ...stats[k]!.shares.map((v) => (a += v))] })
    const y = (v: number) => (1 - v) * 100
    return BANDS.map((b, i) => {
      const top = ks.map((k, j) => `${k},${y(cum[j][i + 1])}`)
      const bot = ks.map((k, j) => `${k},${y(cum[j][i])}`).reverse()
      return { c: b.color, d: `M${top.join('L')}L${bot.join('L')}Z` }
    })
  }, [stats])
  return (
    <svg className="strip" viewBox={`0 0 ${hours - 1} 100`} preserveAspectRatio="none" aria-hidden>
      {paths.map((p) => <path key={p.c} d={p.d} fill={p.c} stroke={p.c} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

const SPEEDS = [1, 2, 4]

/** Continuous slider position: follows the pointer while dragging, otherwise eases toward the hour `t`. */
function useGlide(t: number) {
  const [v, setV] = useState(t)
  const [held, setHeld] = useState(false)
  const cur = useRef(t)
  useEffect(() => {
    if (held) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const k = 1 - Math.exp(-(now - last) / 90) // frame-rate independent ease-out
      last = now
      const d = t - cur.current
      cur.current = Math.abs(d) < 0.002 ? t : cur.current + d * k
      setV(cur.current)
      if (cur.current !== t) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [t, held])
  return { v, hold: setHeld, set: (x: number) => { cur.current = x; setV(x) } }
}

export default function Timeline({ meta, t, setT, play, setPlay, speed, setSpeed, stats }: {
  meta: Meta; t: number; setT: (t: number) => void; play: boolean; setPlay: (p: boolean) => void
  speed: number; setSpeed: (s: number) => void; stats: (HourStat | undefined)[]
}) {
  const last = meta.hours - 1
  const pct = (h: number) => (h / last) * 100
  const x = (h: number) => `${pct(h)}%`
  const pos = useGlide(t)
  const ph = phaseOf(meta, t)
  const s = stats[t]
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  // hour of day for every tick (0-23), so midnight and 6-hour marks can be drawn bigger, like a ruler
  const hod = useMemo(() => Array.from({ length: meta.hours }, (_, h) => (+at(meta, h, { hour: 'numeric', hour12: false })) % 24), [meta])

  const hourAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * last
  }
  const seek = (clientX: number) => { const v = hourAt(clientX); pos.set(v); setT(Math.round(v)) }
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pos.hold(true); setPlay(false); setDrag(true); setHover(null); seek(e.clientX)
  }
  const move = (e: RPointerEvent<HTMLDivElement>) => { if (drag) seek(e.clientX); else setHover(hourAt(e.clientX)) }
  const up = () => { if (drag) { setDrag(false); pos.hold(false) } }

  return (
    <div className="time card dock">
      <button className="play" onClick={() => setPlay(!play)} aria-label={play ? 'Pause' : 'Play'} title="Play / pause (Space)">
        <Icon n={play ? 'pause' : 'play'} />
      </button>
      <button className="speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} title="Playback speed">{speed}×</button>

      <div className="track">
        <div ref={ref} className={`scrub ${drag ? 'drag' : ''}`} role="slider" tabIndex={0} aria-label="Forecast hour"
          aria-valuemin={0} aria-valuemax={last} aria-valuenow={t} aria-valuetext={fullLabel(meta, t)}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)}>
          <div className="marks">
            {dayTicks(meta).map((h) => <span key={h} style={{ left: x(h) }}>{at(meta, h, { weekday: 'short', day: 'numeric' })}</span>)}
          </div>
          <div className="heat" title="Share of the city in each AQI band">
            <ShareStrip hours={meta.hours} stats={stats} />
            <div className="heat-d" style={{ left: x(meta.diwali_t) }}><span>Diwali night</span></div>
          </div>
          <div className="ruler" aria-hidden>
            {hod.map((h, i) => <i key={i} className={h === 0 ? 'day' : h % 6 === 0 ? 'six' : ''} style={{ left: x(i) }} />)}
          </div>
          {hover != null && !drag && <div className="ghost" style={{ left: x(hover) }} />}
          <div className="playhead" style={{ left: x(pos.v) }} />
          <div className="cap" style={{ left: `clamp(26px, ${pct(pos.v)}%, calc(100% - 26px))` }}>{hourLabel(meta, t)}</div>
        </div>
      </div>

      <div className="now">
        <span><i className={`ph ${ph.key}`} />{ph.name}</span>
        {s && <span>City AQI <em style={{ color: band(s.mean).color }}>{s.mean}</em></span>}
      </div>
    </div>
  )
}
