import { useMemo } from 'react'
import { BANDS, band } from '../aqi'
import { Hotspot, Meta } from '../api'
import { fullLabel, pct, phaseOf } from '../format'
import { Base, Frame, HourStat, useCountUp } from '../hooks'
import { CityChart } from './charts'
import { Chip, Section, Skeleton, Stat } from './ui'

export function Gauge({ value, lo, hi }: { value: number; lo?: number; hi?: number }) {
  const x = (v: number) => `${Math.min(100, Math.max(0, v / 5))}%`
  let prev = 0
  return (
    <div className="gauge">
      <div className="gauge-track">
        {BANDS.map((b) => { const w = Math.min(500, b.max) - prev; prev = Math.min(500, b.max); return <i key={b.name} style={{ flex: w, background: b.color }} /> })}
      </div>
      {lo != null && hi != null && <div className="gauge-range" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />}
      <div className="gauge-pin" style={{ left: x(value) }} />
      <div className="gauge-s"><span>0</span><span>100</span><span>200</span><span>300</span><span>400</span><span>500</span></div>
    </div>
  )
}

export default function Overview({ meta, base, frame, stats, loaded, t, spots, onSeek, onFocus }: {
  meta: Meta; base?: Base; frame?: Frame; stats: (HourStat | undefined)[]; loaded: number; t: number; spots: Hotspot[]
  onSeek: (t: number) => void; onFocus: (s: Hotspot) => void
}) {
  const s = stats[t]
  const prev = t >= 24 ? stats[t - 24] : undefined
  const mean = useCountUp(s?.mean ?? 0)
  const all = loaded >= meta.hours

  const peak = useMemo(() => (all ? stats.reduce((a, b) => (b && (!a || b.mean > a.mean) ? b : a), undefined as HourStat | undefined) : undefined), [stats, all])
  const far = useMemo(() => (base ? base.dist.filter((d) => d >= 2).length / base.dist.length : 0), [base])
  const vpShare = s ? s.shares.slice(4).reduce((a, b) => a + b, 0) : 0
  const curShares = useMemo(() => {
    if (!frame) return []
    const c = BANDS.map(() => 0)
    for (const a of frame.aqi) c[BANDS.findIndex((b) => a <= b.max)]++
    return c.map((n) => n / frame.aqi.length)
  }, [frame])

  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">{meta.city} average · {phaseOf(meta, t).name}</div>
        {s ? (
          <>
            <div className="hero-row">
              <div className="big">{mean}</div>
              <div className="hero-side">
                <Chip aqi={s.mean} />
                {prev && (
                  <span className="delta">{Math.abs(s.mean - prev.mean)} {s.mean > prev.mean ? 'higher' : 'lower'} than 24 h earlier</span>
                )}
              </div>
            </div>
            <Gauge value={s.mean} lo={s.lo} hi={s.hi} />
          </>
        ) : <Skeleton h={110} />}
        <p className="lede">Estimated for every 0.7 km² hexagon, including the {pct(far)} of the city more than 2 km from a monitor. Select an area on the map for its forecast.</p>
      </div>

      {s && (
        <div className="stats3">
          <Stat label="Worst area" value={s.max} sub={band(s.max).name} />
          <Stat label="Very Poor +" value={pct(vpShare)} sub="of the city" />
          <Stat label="Typical range" value={`${s.lo}–${s.hi}`} sub="middle 80%" />
        </div>
      )}

      <Section title="City-wide outlook" hint="Average AQI with the middle 80% of areas shaded. Click to jump to an hour."
        aside={!all ? <span className="loading-pill"><i className="spin" />{loaded}/{meta.hours} h</span> : undefined}>
        {loaded > 0 ? <CityChart meta={meta} stats={stats} t={t} onSeek={onSeek} /> : <Skeleton h={184} />}
        {peak && (
          <button className="linkrow" onClick={() => onSeek(peak.t)}>
            <span>Worst hour <b>{fullLabel(meta, peak.t)}</b></span><span className="v">AQI {peak.mean}<i>›</i></span>
          </button>
        )}
      </Section>

      <Section title="Share of the city by category" hint="At the hour selected on the timeline.">
        {frame && (
          <div className="stack">
            {curShares.map((v, i) => v > 0 && <i key={i} title={`${BANDS[i].name}: ${pct(v)}`} style={{ flex: v, background: BANDS[i].color }} />)}
          </div>
        )}
        <div className="stack-l">
          {curShares.map((v, i) => v > 0 && <span key={i}><i style={{ background: BANDS[i].color }} />{BANDS[i].name} <b>{pct(v)}</b></span>)}
        </div>
      </Section>

      <Section title="Worst-hit areas">
        <ol className="spots">
          {spots.map((h, i) => (
            <li key={h.h3}>
              <button className="spot" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onFocus(h)}>
                <span className="rank">{i + 1}</span>
                <span className="t">Near {h.near}<small>{h.dist_km < 1.5 ? 'Sensor nearby' : `${h.dist_km} km from nearest sensor`}</small></span>
                <span className="spot-v"><i style={{ background: band(h.aqi).color }} /><b>{h.aqi}</b></span>
              </button>
            </li>
          ))}
          {!spots.length && <Skeleton h={180} />}
        </ol>
      </Section>
    </div>
  )
}
