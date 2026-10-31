import { useEffect, useRef, useState } from 'react'
import { MapLibreMap, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cellToBoundary } from 'h3-js'
import {
  Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AQI_COLORS, api, phaseLabel, type Advisory, type Driver, type ForecastPoint, type HexCell } from './api'
import './App.css'

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const toGeoJSON = (cells: HexCell[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: cells.map((c) => ({
    type: 'Feature',
    properties: { ...c, color: AQI_COLORS[c.category] },
    geometry: { type: 'Polygon', coordinates: [cellToBoundary(c.h3, true)] },
  })),
})

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [t, setT] = useState(0)
  const [cells, setCells] = useState<HexCell[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [series, setSeries] = useState<ForecastPoint[]>([])
  const [station, setStation] = useState('')
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [advisory, setAdvisory] = useState<Advisory | null>(null)
  const [crackers, setCrackers] = useState(1)
  const [traffic, setTraffic] = useState(1)
  const [scenario, setScenario] = useState<{ mean_pm25_before: number; mean_pm25_after: number } | null>(null)

  // map init
  useEffect(() => {
    const m = new MapLibreMap({ container: mapEl.current!, style: BASEMAP, center: [77.2, 28.62], zoom: 10 })
    m.on('load', () => {
      m.addSource('hexes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'hex-fill', type: 'fill', source: 'hexes',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.55 },
      })
      m.on('click', 'hex-fill', (e: MapLayerMouseEvent) => setSelected(e.features?.[0]?.properties?.h3 ?? null))
      m.on('mouseenter', 'hex-fill', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'hex-fill', () => (m.getCanvas().style.cursor = ''))
      map.current = m
      api.hexes(0).then((d) => setCells(d.cells))
    })
    return () => m.remove()
  }, [])

  useEffect(() => {
    const id = setTimeout(() => api.hexes(t).then((d) => setCells(d.cells)), 120)
    return () => clearTimeout(id)
  }, [t])

  useEffect(() => {
    ;(map.current?.getSource('hexes') as GeoJSONSource | undefined)?.setData(toGeoJSON(cells))
  }, [cells])

  useEffect(() => {
    if (!selected) return
    api.forecast(selected).then((d) => { setSeries(d.series); setStation(d.nearest_station) })
  }, [selected])

  useEffect(() => {
    if (!selected) return
    api.explain(selected, t).then((d) => setDrivers(d.drivers))
    api.advisory(selected, t).then(setAdvisory)
  }, [selected, t])

  useEffect(() => {
    const id = setTimeout(() => api.scenario(t, crackers, traffic).then(setScenario), 200)
    return () => clearTimeout(id)
  }, [t, crackers, traffic])

  const cityMean = cells.length ? cells.reduce((s, c) => s + c.pm25, 0) / cells.length : 0
  const worst = cells.length ? cells.reduce((a, b) => (a.pm25 > b.pm25 ? a : b)) : null

  return (
    <div className="layout">
      <header>
        <h1>NOx <span>· Street-level Diwali Air Forecast · Delhi</span></h1>
        <div className="kpis">
          <div><b>{cells.length.toLocaleString()}</b> neighborhoods</div>
          <div>city mean <b>{cityMean.toFixed(0)}</b> µg/m³</div>
          {worst && <div>worst hex <b style={{ color: AQI_COLORS[worst.category] }}>{worst.pm25.toFixed(0)}</b></div>}
          <div className="mock">mock model v0</div>
        </div>
      </header>

      <main>
        <div className="map" ref={mapEl} />

        <aside>
          <section>
            <h3>Time · {phaseLabel(t)}</h3>
            <input type="range" min={-168} max={168} step={3} value={t} onChange={(e) => setT(+e.target.value)} />
            <div className="ticks"><span>D-7</span><span>Diwali night</span><span>D+7</span></div>
          </section>

          {!selected && <section className="hint">Click a hexagon to see that neighborhood's forecast.</section>}

          {selected && (
            <>
              <section>
                <h3>Forecast · {selected.slice(0, 9)}… <small>(near {station})</small></h3>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={series}>
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 24)}d`} />
                    <YAxis tick={{ fontSize: 10 }} width={32} />
                    <Tooltip contentStyle={{ background: '#111827', border: 'none' }} />
                    <Area dataKey={(d: ForecastPoint) => [d.p10, d.p90]} fill="#ff6b6b" fillOpacity={0.2} stroke="none" name="P10–P90" />
                    <Line dataKey="p50" stroke="#ff6b6b" dot={false} strokeWidth={2} name="PM2.5" />
                    <ReferenceLine x={Math.round(t / 3) * 3} stroke="#fff" strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#92d050" strokeDasharray="2 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </section>

              {advisory && (
                <section>
                  <h3>Now: <span style={{ color: AQI_COLORS[advisory.now.category] }}>
                    AQI {advisory.now.aqi} · {advisory.now.category}</span></h3>
                  <p>{advisory.advice}</p>
                  <p className="muted">Safest outdoor slots: {advisory.safest_hours_offset.map((h) => `+${h}h`).join(', ')}</p>
                </section>
              )}

              <section>
                <h3>Why so polluted? (source attribution)</h3>
                {drivers.map((d) => (
                  <div key={d.source} className="bar">
                    <span>{d.source.replace('_', ' ')}</span>
                    <div><i style={{ width: `${d.share * 100}%` }} /></div>
                    <b>{(d.share * 100).toFixed(0)}%</b>
                  </div>
                ))}
              </section>
            </>
          )}

          <section>
            <h3>What-if simulator</h3>
            <label>Firecrackers ×{crackers.toFixed(1)}
              <input type="range" min={0} max={2} step={0.1} value={crackers} onChange={(e) => setCrackers(+e.target.value)} />
            </label>
            <label>Traffic ×{traffic.toFixed(1)}
              <input type="range" min={0} max={2} step={0.1} value={traffic} onChange={(e) => setTraffic(+e.target.value)} />
            </label>
            {scenario && (
              <p>City mean PM2.5: <b>{scenario.mean_pm25_before}</b> → <b>{scenario.mean_pm25_after}</b> µg/m³
                {' '}({(((scenario.mean_pm25_after - scenario.mean_pm25_before) / scenario.mean_pm25_before) * 100).toFixed(0)}%)</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}
