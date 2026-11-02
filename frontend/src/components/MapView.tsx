import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { cellToBoundary, cellToLatLng } from 'h3-js'
import { band, colorExpr, pmToAqi } from '../aqi'
import { Meta } from '../api'
import { Base, Frame } from '../hooks'

maplibregl.setWorkerUrl(workerUrl)
const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const EMPTY = { type: 'FeatureCollection' as const, features: [] }

export const panelPad = () => (window.innerWidth > 860 ? { left: 40, top: 120, right: 70, bottom: 30 } : { left: 30, top: 120, right: 30, bottom: 30 })

type Hover = { x: number; y: number; i?: number; station?: string; reading?: number; at?: string }

export default function MapView({ meta, base, frame, sel, onSelect, extrude, onMap }: {
  meta: Meta; base?: Base; frame?: Frame; sel: string | null; onSelect: (id: string) => void; extrude: boolean; onMap?: (m: maplibregl.Map) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const rings = useRef(new Map<string, number[][]>())
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)
  const sel0 = useRef(onSelect)
  sel0.current = onSelect

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [77.12, 28.63], zoom: 9.6, attributionControl: { compact: true }, fadeDuration: 0 })
    // offline or blocked basemap: fall back to a plain background so the forecast still draws
    let fellBack = false
    m.on('error', () => {
      if (fellBack || m.isStyleLoaded()) return
      fellBack = true
      m.setStyle({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eceef1' } }] })
    })
    m.on('load', () => {
      m.addSource('hex', { type: 'geojson', data: EMPTY, promoteId: 'id' })
      const firstLabel = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id
      m.addLayer({ id: 'hex-fill', type: 'fill', source: 'hex', paint: {
        'fill-color': colorExpr(), 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.66], 'fill-opacity-transition': { duration: 400 },
      } }, firstLabel)
      m.addLayer({ id: 'hex-line', type: 'line', source: 'hex', paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 13, 1.2], 'line-opacity': 0.7 } }, firstLabel)
      m.addLayer({ id: 'hex-3d', type: 'fill-extrusion', source: 'hex', layout: { visibility: 'none' }, paint: {
        'fill-extrusion-color': colorExpr(), 'fill-extrusion-height': ['*', ['get', 'aqi'], 9], 'fill-extrusion-opacity': 0.88, 'fill-extrusion-vertical-gradient': true,
      } })
      m.addLayer({ id: 'hex-sel-halo', type: 'line', source: 'hex', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#fff', 'line-width': 6 } })
      m.addLayer({ id: 'hex-sel', type: 'line', source: 'hex', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#0f1115', 'line-width': 2.6 } })

      m.addSource('st', { type: 'geojson', data: { type: 'FeatureCollection', features: meta.stations.map((s) => ({ type: 'Feature', properties: { n: s.name, r: s.last ?? null, t: s.last_time ?? null, u: s.url ?? null, c: s.last != null ? band(pmToAqi(s.last)).color : '#ffffff' }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })) } })
      m.addLayer({ id: 'st-halo', type: 'circle', source: 'st', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 13, 12], 'circle-color': '#0f1115', 'circle-opacity': 0.1 } })
      m.addLayer({ id: 'st', type: 'circle', source: 'st', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4.5, 13, 7.5], 'circle-color': ['get', 'c'], 'circle-stroke-color': '#0f1115', 'circle-stroke-width': 2 } })

      let hov: string | null = null
      const clear = () => { if (hov) m.setFeatureState({ source: 'hex', id: hov }, { hover: false }); hov = null }
      m.on('mousemove', (e) => {
        const st = m.queryRenderedFeatures(e.point, { layers: ['st'] })[0]
        const hx = m.queryRenderedFeatures(e.point, { layers: ['hex-fill'] })[0]
        const id = hx?.properties?.id as string | undefined
        if (id !== hov) { clear(); if (id) { hov = id; m.setFeatureState({ source: 'hex', id }, { hover: true }) } }
        m.getCanvas().style.cursor = id || st ? 'pointer' : ''
        if (st) setHover({ x: e.point.x, y: e.point.y, station: st.properties?.n, reading: st.properties?.r ?? undefined, at: st.properties?.t ?? undefined })
        else if (hx) setHover({ x: e.point.x, y: e.point.y, i: hx.properties?.i as number })
        else setHover(null)
      })
      m.on('mouseout', () => { clear(); setHover(null) })
      m.on('dragstart', () => setHover(null))
      m.on('click', 'st', (e) => { const u = e.features?.[0]?.properties?.u as string | undefined; if (u) window.open(u, '_blank', 'noopener') })
      m.on('click', 'hex-fill', (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['st'] }).length) return
        const id = e.features?.[0]?.properties?.id as string; if (id) sel0.current(id)
      })
      setReady(true)
    })
    map.current = m
    onMap?.(m)
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fit to the forecast area once its cells are known
  const fitted = useRef(false)
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !base || fitted.current) return
    fitted.current = true
    const b = new maplibregl.LngLatBounds()
    for (const id of base.h3) { const [la, lo] = cellToLatLng(id); b.extend([lo, la]) }
    m.fitBounds(b, { padding: panelPad(), duration: 1400, essential: true })
  }, [ready, base])

  useEffect(() => {
    const m = map.current
    if (!m || !ready || !base || !frame) return
    const feats = base.h3.map((id, i) => {
      let ring = rings.current.get(id)
      if (!ring) { ring = cellToBoundary(id, true); ring.push(ring[0]); rings.current.set(id, ring) }
      return { type: 'Feature' as const, properties: { id, i, aqi: frame.aqi[i] }, geometry: { type: 'Polygon' as const, coordinates: [ring] } }
    })
    ;(m.getSource('hex') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: feats })
  }, [ready, base, frame])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    for (const l of ['hex-sel', 'hex-sel-halo']) m.setFilter(l, ['==', ['get', 'id'], sel ?? ''])
  }, [ready, sel])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    m.setLayoutProperty('hex-3d', 'visibility', extrude ? 'visible' : 'none')
    m.setPaintProperty('hex-fill', 'fill-opacity', extrude ? 0 : ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.66])
    m.setLayoutProperty('hex-line', 'visibility', extrude ? 'none' : 'visible')
    m.easeTo({ pitch: extrude ? 52 : 0, bearing: extrude ? -18 : 0, duration: 1100 })
  }, [ready, extrude])

  const hi = hover?.i
  const tipAqi = hi != null && frame ? frame.aqi[hi] : null
  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {hover && (hover.station || tipAqi != null) && (
        <div className="maptip" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 14}px)` }}>
          {hover.station ? (
            <>
              <span className="maptip-k">Real monitoring station</span><b>{hover.station}</b>
              {hover.reading != null ? (
                <>
                  <div className="maptip-h"><b style={{ color: band(pmToAqi(hover.reading)).color }}>{Math.round(pmToAqi(hover.reading))}</b><span>{hover.reading} µg/m³ PM2.5</span></div>
                  <span className="maptip-k">Measured {hover.at ? new Date(hover.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : ''} · click to verify on OpenAQ</span>
                </>
              ) : <span className="maptip-k">No reading in the last 48 h · click to open on OpenAQ</span>}
            </>
          ) : tipAqi != null && base && frame && hi != null ? (
            <>
              <div className="maptip-h"><b style={{ color: band(tipAqi).color }}>{tipAqi}</b><span>{band(tipAqi).name}</span></div>
              <span className="maptip-k">PM2.5 {frame.pm25[hi]} µg/m³ · {base.dist[hi] < 1.5 ? 'sensor nearby' : `${base.dist[hi]} km to nearest sensor`}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
