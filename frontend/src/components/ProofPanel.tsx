import { useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Proof, getProof } from '../api'
import { band, pmToAqi } from '../aqi'
import { Icon, Section, Skeleton, Stat, Tip } from './ui'

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const hl = (h: number) => (h === 0 ? 'Diwali night' : `${h > 0 ? '+' : '−'}${Math.abs(h)} h`)

export default function ProofPanel() {
  const [p, setP] = useState<Proof | null | undefined>()
  const [si, setSi] = useState(0)
  const [st, setSt] = useState(-1)
  useEffect(() => { getProof().then(setP).catch(() => setP(null)) }, [])

  const r = p?.replays[si]
  const rows = useMemo(() => {
    if (!r) return []
    const src = st < 0 ? r.city : r.stations[st].series
    return src.map(([h, a, m, lo, hi]) => ({ h, actual: a, model: m, base: lo, band: hi - lo }))
  }, [r, st])

  if (p === undefined) return <Section title="Proof it's real"><Skeleton h={220} /></Section>
  if (!p || !r) return null
  const s = r.stats
  const gap = Math.round((1 - s.peak_pred / s.peak_actual) * 100)
  const sta = st >= 0 ? r.stations[st] : null

  return (
    <>
      <Section title="Proof it's real: replay a past Diwali"
        hint={`The model was trained without the ${r.season} season, then asked to predict it. The dark line is what real sensors measured.`}
        aside={<div className="seg">{p.replays.map((x, k) => <button key={x.season} className={k === si ? 'on' : ''} onClick={() => { setSi(k); setSt(-1) }}>{x.season}</button>)}</div>}>
        <div className="stats3">
          <Stat label="Avg. error" value={s.mae} unit="µg/m³" sub={`${r.stations_used} stations`} />
          <Stat label="Real inside range" value={`${Math.round(s.within_range * 100)}%`} sub="target 80%" />
          <Stat label="Peak: real / model" value={`${Math.round(s.peak_actual)} / ${Math.round(s.peak_pred)}`} sub={gap > 0 ? `model ${gap}% low` : `model ${-gap}% high`} tone={Math.abs(gap) > 25 ? '#e0533d' : undefined} />
        </div>
        <select className="proof-sel" value={st} onChange={(e) => setSt(+e.target.value)} aria-label="Station">
          <option value={-1}>All stations (average)</option>
          {r.stations.map((x, k) => <option key={x.id} value={k}>{x.name}</option>)}
        </select>
        <div style={{ height: 210, margin: '10px -6px 0' }}>
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="h" type="number" domain={['dataMin', 'dataMax']} ticks={[-96, -72, -48, -24, 0, 24, 48, 72, 96].filter((x) => rows.length && x >= rows[0].h && x <= rows[rows.length - 1].h)} tickFormatter={(v) => (v === 0 ? 'Diwali' : `${v > 0 ? '+' : '−'}${Math.abs(v) / 24}d`)} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9aa0aa' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9aa0aa' }} width={44} />
              <Tooltip content={({ payload }) => payload?.[0] ? (
                <Tip title={hl(payload[0].payload.h)} rows={[
                  { k: 'Real sensors', v: `${Math.round(payload[0].payload.actual)}`, c: '#0f1115' },
                  { k: 'Model', v: `${Math.round(payload[0].payload.model)}`, c: '#3b82f6' },
                ]} />) : null} />
              <Area dataKey="base" stackId="a" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area dataKey="band" stackId="a" stroke="none" fill="#3b82f6" fillOpacity={0.12} animationDuration={700} />
              <Line dataKey="model" dot={false} stroke="#3b82f6" strokeWidth={1.8} animationDuration={800} />
              <Line dataKey="actual" dot={false} stroke="#0f1115" strokeWidth={2} animationDuration={800} />
              <ReferenceLine x={0} stroke="#c9ccd3" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="legend-inline">
          <span><i style={{ background: '#0f1115' }} />Real sensors</span><span><i style={{ background: '#3b82f6' }} />Model</span><span><i style={{ background: '#cfe0fb' }} />Model range</span>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          PM2.5 in µg/m³. Real peak {Math.round(s.peak_actual)} came {Math.abs(s.peak_actual_h)} h {s.peak_actual_h >= 0 ? 'after' : 'before'} Diwali night; the model's peak {Math.round(s.peak_pred)} came {Math.abs(s.peak_pred_h)} h {s.peak_pred_h >= 0 ? 'after' : 'before'}. {gap > 25 ? 'The model under-called the sharpest peak. Treat Diwali-night forecasts as a floor, not a ceiling.' : ''}
        </p>
        {sta && (sta.url
          ? <a className="verify" href={sta.url} target="_blank" rel="noreferrer">Check {sta.name} yourself on OpenAQ ↗</a>
          : <p className="hint">Source: CPCB hourly archive ({r.season}).</p>)}
      </Section>

      <Section title="Latest real readings" hint="Measured by government sensors. Open any link and compare the number with the public page.">
        <table className="tbl proof-tbl">
          <thead><tr><th>Station</th><th>PM2.5</th><th>AQI</th><th /></tr></thead>
          <tbody>
            {p.latest.map((x) => {
              const a = Math.round(pmToAqi(x.last))
              return (
                <tr key={x.id}>
                  <td>{x.name}<small>{when(x.last_time)}</small></td>
                  <td>{x.last}</td>
                  <td><span className="dotk" style={{ background: band(a).color }} />{a}</td>
                  <td>{x.url && <a href={x.url} target="_blank" rel="noreferrer" aria-label={`Open ${x.name} on OpenAQ`}><Icon n="share" size={14} /></a>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Check the files yourself" hint="If any of these fingerprints differ from the files on disk, something was changed after the model was tested.">
        <dl className="kv">
          {Object.entries(p.fingerprints).map(([f, v]) => (<><dt key={f + 'a'}>{f}</dt><dd key={f + 'b'} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{v.sha256.slice(0, 16)}…</dd></>))}
        </dl>
        <p className="hint" style={{ marginTop: 10 }}>In a terminal: <code className="inl">./nox verify</code> re-runs the model from scratch, compares it with what this site shows, and checks live readings against OpenAQ.</p>
      </Section>
    </>
  )
}
