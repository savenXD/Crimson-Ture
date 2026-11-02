import { useId, useMemo } from 'react'
import {
  Area, AreaChart, Bar, BarChart, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ReferenceArea, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { BANDS, band, pmToAqi } from '../aqi'
import { Meta, Point } from '../api'
import { dayTicks, fullLabel, at, pct } from '../format'
import { HourStat } from '../hooks'
import { Tip } from './ui'

const AX = { tickLine: false, axisLine: false, tick: { fontSize: 10, fill: '#8b919c' } } as const
const CURSOR = { stroke: '#0f1115', strokeOpacity: 0.25, strokeDasharray: '2 3' }

const ceil50 = (v: number) => Math.max(100, Math.ceil(v / 50) * 50)

/** Faint AQI category bands behind a chart whose y axis is AQI. */
function bandAreas(top: number) {
  let lo = 0
  return BANDS.map((b) => {
    const a = lo
    lo = b.max
    if (a >= top) return null
    return <ReferenceArea key={b.name} y1={a} y2={Math.min(b.max, top)} fill={b.color} fillOpacity={0.05} stroke="none" ifOverflow="hidden" />
  })
}

const xAxis = (meta: Meta) => (
  <XAxis dataKey="t" type="number" domain={[0, meta.hours - 1]} ticks={dayTicks(meta)} tickFormatter={(v) => at(meta, v, { day: 'numeric', month: 'short' })} {...AX} />
)

const seek = (data: { t: number }[], on?: (t: number) => void) => (s: any) => {
  const i = Number(s?.activeTooltipIndex)
  if (on && Number.isFinite(i) && data[i]) on(data[i].t)
}

/** One hexagon's forecast: likely value with the P10–P90 range. */
export function ForecastChart({ meta, series, t, peak, onSeek }: { meta: Meta; series: Point[]; t: number; peak: number; onSeek?: (t: number) => void }) {
  const id = useId().replace(/:/g, '')
  const data = useMemo(() => series.map((p) => {
    const lo = pmToAqi(p.p10), hi = pmToAqi(p.p90)
    return { t: p.t, aqi: p.aqi, lo: Math.round(lo), hi: Math.round(hi), range: [lo, hi] as [number, number] }
  }), [series])
  const top = ceil50(Math.max(...data.map((d) => d.hi)) * 1.05)
  const pk = data[peak]
  return (
    <div className="chart" style={{ height: 196 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 14, right: 8, left: -18, bottom: 0 }} onClick={seek(data, onSeek)}>
          <defs>
            <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f1115" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#0f1115" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {bandAreas(top)}
          {xAxis(meta)}
          <YAxis domain={[0, top]} {...AX} width={44} />
          <Tooltip cursor={CURSOR} content={({ active, payload }: any) => active && payload?.[0] ? (
            <Tip title={fullLabel(meta, payload[0].payload.t)} rows={[
              { k: 'Likely AQI', v: payload[0].payload.aqi, c: band(payload[0].payload.aqi).color },
              { k: 'Range', v: `${payload[0].payload.lo}–${payload[0].payload.hi}` },
            ]} />
          ) : null} />
          <Area dataKey="range" stroke="none" fill={`url(#r${id})`} animationDuration={800} isAnimationActive />
          <Line dataKey="aqi" dot={false} stroke="#0f1115" strokeWidth={2} animationDuration={900} activeDot={{ r: 4, fill: '#0f1115', stroke: '#fff', strokeWidth: 2 }} />
          <ReferenceLine x={meta.diwali_t} stroke="#0f1115" strokeOpacity={0.35} strokeDasharray="3 3" label={{ value: 'Diwali', fontSize: 10, fill: '#5d636e', position: 'top' }} />
          <ReferenceLine x={t} stroke={band(data[t]?.aqi ?? 0).color} strokeWidth={2} />
          {pk && <ReferenceDot x={pk.t} y={pk.aqi} r={4.5} fill={band(pk.aqi).color} stroke="#fff" strokeWidth={2} label={{ value: `Peak ${pk.aqi}`, position: 'right', fontSize: 10, fill: '#0f1115', fontWeight: 600 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** City-wide outlook: average hexagon with the spread between the 10th and 90th percentile hexagon, plus the worst one. */
export function CityChart({ meta, stats, t, onSeek }: { meta: Meta; stats: (HourStat | undefined)[]; t: number; onSeek?: (t: number) => void }) {
  const id = useId().replace(/:/g, '')
  const data = useMemo(() => Array.from({ length: meta.hours }, (_, k) => {
    const s = stats[k]
    return s ? { t: k, mean: s.mean, max: s.max, spread: [s.lo, s.hi] as [number, number], lo: s.lo, hi: s.hi } : { t: k }
  }), [stats, meta.hours])
  const top = ceil50(Math.max(0, ...stats.map((s) => s?.max ?? 0)) * 1.05)
  const cur = stats[t]
  return (
    <div className="chart" style={{ height: 184 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} onClick={seek(data, onSeek)}>
          <defs>
            <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f1115" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#0f1115" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {bandAreas(top)}
          {xAxis(meta)}
          <YAxis domain={[0, top]} {...AX} width={44} />
          <Tooltip cursor={CURSOR} content={({ active, payload }: any) => {
            const p = payload?.[0]?.payload
            return active && p?.mean != null ? (
              <Tip title={fullLabel(meta, p.t)} rows={[
                { k: 'Average area', v: p.mean, c: band(p.mean).color },
                { k: 'Most areas between', v: `${p.lo}–${p.hi}` },
                { k: 'Worst area', v: p.max, c: band(p.max).color },
              ]} />
            ) : null
          }} />
          <Area dataKey="spread" stroke="none" fill={`url(#c${id})`} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="mean" dot={false} stroke="#0f1115" strokeWidth={2} isAnimationActive={false} activeDot={{ r: 4, fill: '#0f1115', stroke: '#fff', strokeWidth: 2 }} />
          <ReferenceLine x={meta.diwali_t} stroke="#0f1115" strokeOpacity={0.35} strokeDasharray="3 3" label={{ value: 'Diwali', fontSize: 10, fill: '#5d636e', position: 'top' }} />
          <ReferenceLine x={t} stroke={cur ? band(cur.mean).color : '#0f1115'} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Share of the city's area in each AQI band, hour by hour. */
export function ShareChart({ meta, stats, t, onSeek }: { meta: Meta; stats: (HourStat | undefined)[]; t: number; onSeek?: (t: number) => void }) {
  const data = useMemo(() => Array.from({ length: meta.hours }, (_, k) => {
    const s = stats[k]
    const row: Record<string, number> = { t: k }
    if (s) BANDS.forEach((b, i) => { row[b.name] = s.shares[i] })
    return row as { t: number } & Record<string, number>
  }), [stats, meta.hours])
  return (
    <div className="chart" style={{ height: 150 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} onClick={seek(data, onSeek)}>
          {xAxis(meta)}
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={pct} {...AX} width={44} />
          <Tooltip cursor={CURSOR} content={({ active, payload }: any) => {
            const p = payload?.[0]?.payload
            if (!active || !p || p[BANDS[0].name] == null) return null
            return <Tip title={fullLabel(meta, p.t)} rows={[...BANDS].reverse().filter((b) => p[b.name] > 0).map((b) => ({ k: b.name, v: pct(p[b.name]), c: b.color }))} />
          }} />
          {BANDS.map((b) => (
            <Area key={b.name} dataKey={b.name} stackId="s" stroke={b.color} strokeWidth={0.5} fill={b.color} fillOpacity={0.85} isAnimationActive={false} type="monotone" />
          ))}
          <ReferenceLine x={t} stroke="#0f1115" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export const CAUSE_COLORS: Record<string, string> = {
  Crackers: '#e0533d', 'Farm-fire smoke': '#f2994a', 'Weather & trapped air': '#5b7cfa', 'Local sources': '#8b919c',
}
const causeColor = (n: string, i: number) => CAUSE_COLORS[n] ?? ['#0f1115', '#5d636e', '#a0a6b0', '#d0d4da'][i % 4]

/** Donut of the model's grouped SHAP pushes. */
export function CauseDonut({ causes }: { causes: { name: string; share: number }[] }) {
  const top = [...causes].sort((a, b) => b.share - a.share)[0]
  return (
    <div className="donut">
      <div className="donut-c">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={causes} dataKey="share" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={2} cornerRadius={3} stroke="none" startAngle={90} endAngle={-270} animationDuration={800}>
              {causes.map((c, i) => <Cell key={c.name} fill={causeColor(c.name, i)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {top && <div className="donut-m"><b>{pct(top.share)}</b><span>{top.name.split(' ')[0]}</span></div>}
      </div>
      <ul className="donut-l">
        {causes.map((c, i) => (
          <li key={c.name}>
            <i style={{ background: causeColor(c.name, i) }} />
            <span>{c.name}</span>
            <b>{pct(c.share)}</b>
            <div className="bar"><em style={{ width: pct(c.share), background: causeColor(c.name, i) }} /></div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal bars, one per method. */
export function ErrorBars({ rows }: { rows: { n: string; v: number; us?: boolean }[] }) {
  return (
    <div className="chart" style={{ height: rows.length * 38 + 8 }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={9}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="n" width={132} {...AX} tick={{ fontSize: 12, fill: '#0f1115' }} />
          <Bar dataKey="v" radius={[0, 6, 6, 0]} animationDuration={900} background={{ fill: '#f2f3f5', radius: 6 } as any}>
            {rows.map((r) => <Cell key={r.n} fill={r.us ? '#0f1115' : '#c3c8d0'} />)}
            <LabelList dataKey="v" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#0f1115' }} formatter={(v: any) => `${v}`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Peak PM2.5 actual vs predicted for each held-out Diwali season. */
export function SeasonBars({ seasons }: { seasons: [string, { peak_actual: number; peak_predicted: number }][] }) {
  const data = seasons.map(([y, s]) => ({ y, actual: s.peak_actual, predicted: s.peak_predicted }))
  return (
    <div className="chart" style={{ height: 170 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 4, left: -18, bottom: 0 }} barGap={3} barCategoryGap="28%">
          <XAxis dataKey="y" {...AX} tick={{ fontSize: 11, fill: '#5d636e' }} />
          <YAxis {...AX} width={44} />
          <Tooltip cursor={{ fill: '#0f1115', fillOpacity: 0.04 }} content={({ active, payload }: any) => active && payload?.[0] ? (
            <Tip title={`Diwali ${payload[0].payload.y} (unseen)`} rows={[
              { k: 'Actual peak', v: `${payload[0].payload.actual} µg/m³`, c: '#c3c8d0' },
              { k: 'Predicted peak', v: `${payload[0].payload.predicted} µg/m³`, c: '#0f1115' },
            ]} />
          ) : null} />
          <Bar dataKey="actual" fill="#c3c8d0" radius={[4, 4, 0, 0]} animationDuration={900} />
          <Bar dataKey="predicted" fill="#0f1115" radius={[4, 4, 0, 0]} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
