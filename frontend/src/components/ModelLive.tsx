import { useEffect, useState } from 'react'
import '../model-live.css'
import { Hotspot, LiveRun, Meta, ModelInfo, getHotspots, getLive, getMeta, getModelInfo } from '../api'
import { at } from '../format'
import { useDebounced } from '../hooks'
import { Icon, Section, Skeleton, Stat } from './ui'

const when = (iso?: string | number | null) =>
  iso ? new Date(String(iso).replace(' ', 'T') + (String(iso).includes('+') || String(iso).endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST' : '—'

function Live({ meta }: { meta: Meta }) {
  const [spots, setSpots] = useState<Hotspot[]>([])
  const [hex, setHex] = useState('')
  const [t, setT] = useState(Math.round(meta.diwali_t))
  const [run, setRun] = useState<LiveRun>()
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)
  const dt = useDebounced(t, 150)

  useEffect(() => { getHotspots(Math.round(meta.diwali_t)).then((s) => { setSpots(s); if (s[0]) setHex(s[0].h3) }).catch(() => {}) }, [meta.diwali_t])
  useEffect(() => {
    if (!hex) return
    let live = true
    setBusy(true)
    Promise.all([getLive(hex, dt), new Promise((r) => setTimeout(r, 450))])
      .then(([r]) => live && setRun(r)).catch(() => {}).finally(() => live && setBusy(false))
    return () => { live = false }
  }, [hex, dt])

  const rows = run ? (all ? run.inputs : run.inputs.slice(0, 8)) : []
  const max = run ? Math.max(...run.inputs.map((i) => Math.abs(i.push)), 0.01) : 1
  return (
    <>
      <div className="live-pick">
        <select value={hex} onChange={(e) => setHex(e.target.value)} aria-label="Area">
          {spots.map((s) => <option key={s.h3} value={s.h3}>Near {s.near} · {s.dist_km} km from a sensor</option>)}
        </select>
        <div>
          <div className="row-t"><span>Hour to forecast</span><b style={{ color: 'var(--ink)' }}>{at(meta, t, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', hour12: true })}</b></div>
          <input type="range" min={0} max={meta.hours - 1} value={t} onChange={(e) => setT(+e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      <div className={`run-card ${busy ? 'busy' : ''}`}>
        {run ? (
          <>
            <div className="run-big"><b>{run.prediction.aqi}</b><span>AQI · {run.prediction.category}</span></div>
            <p className="hint" style={{ margin: '4px 0 0' }}>PM2.5 likely {run.prediction.p50} µg/m³ (range {run.prediction.p10}–{run.prediction.p90})</p>
            {run.check.matches != null && (
              <div className={`run-ok ${run.check.matches ? 'good' : 'bad'}`}>
                <Icon n={run.check.matches ? 'check' : 'alert'} size={14} />
                {run.check.matches ? `Same as the saved forecast (${run.check.saved_p50})` : `Differs from saved forecast (${run.check.saved_p50})`}
              </div>
            )}
            <div className="timing">
              <span>features <b>{run.timing_ms.features} ms</b></span><span>model <b>{run.timing_ms.model} ms</b></span>
              <span>{run.trees_evaluated.toLocaleString()} trees</span>
            </div>
          </>
        ) : <Skeleton h={96} />}
      </div>

      {run && (
        <div style={{ marginTop: 14 }}>
          <p className="hint" style={{ marginBottom: 6 }}>Inputs the model received, strongest effect first. Red pushes pollution up, green pushes it down.</p>
          {rows.map((i, k) => (
            <div className="in-row" key={i.name} style={{ animationDelay: `${k * 25}ms` }}>
              <span>{i.label}</span>
              <span className={`v ${i.value == null ? 'miss' : ''}`}>{i.value == null ? 'missing' : `${i.value}${i.unit ? ' ' + i.unit : ''}`}</span>
              <div className="g">
                <div className="pushbar"><i style={{ width: `${(Math.abs(i.push) / max) * 100}%`, background: i.push > 0 ? '#e0533d' : '#2f8f57' }} /></div>
                <span>{i.push > 0 ? '×' : '×'}{Math.exp(i.push).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <button className="more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${run.inputs.length} inputs`}</button>
        </div>
      )}
    </>
  )
}

export default function ModelLive() {
  const [info, setInfo] = useState<ModelInfo>()
  const [meta, setMeta] = useState<Meta>()
  useEffect(() => { getModelInfo().then(setInfo).catch(() => {}); getMeta().then(setMeta).catch(() => {}) }, [])
  if (!info || !meta) return <Section title="Model in action"><Skeleton h={160} /></Section>
  const { model, runtime, serving, freshness: f } = info
  const trees = model.files.reduce((a, x) => a + x.trees, 0)
  return (
    <>
      <Section title="What exactly does it predict?">
        <ul className="steps-l">
          <li><b>PM2.5</b>, fine particles in the air (µg/m³), for every ~0.7 km² hexagon, every hour, for 6 days (6–12 Nov 2026).</li>
          <li>Each hexagon is coloured by the Indian AQI worked out from that hourly PM2.5, using the likely (middle) value. The low–high range is in the area panel.</li>
          <li>It does <b>not</b> predict PM10, NO₂, ozone or other pollutants, and it isn't the official CPCB daily AQI, which averages 24 hours and takes the worst pollutant.</li>
          <li>The circles on the map are real monitoring stations. Their colour is a measured reading, not a prediction.</li>
        </ul>
      </Section>

      <Section title="What is running" hint="The real trained model, loaded from disk right now.">
        <div className="stats3">
          <Stat label="Model" value="LightGBM" sub={`v${model.version}`} />
          <Stat label="Decision trees" value={trees.toLocaleString()} sub="3 models × 400" />
          <Stat label="Inputs" value={model.n_features} sub="per hexagon-hour" />
        </div>
        <p className="hint" style={{ margin: '12px 0 8px' }}>{model.objective}.</p>
        <dl className="kv">
          {model.files.map((x) => (<><dt key={x.name + 'a'}>{x.role}</dt><dd key={x.name + 'b'}>{x.name} · {x.kb.toLocaleString()} KB · {x.sha}</dd></>))}
          <dt>Trained</dt><dd>{when(model.files[0]?.trained)}</dd>
          <dt>Settings</dt><dd>{Object.entries(model.params).map(([k, v]) => `${k.replace('n_estimators', 'trees').replace('num_leaves', 'leaves').replace('learning_rate', 'rate')} ${v}`).slice(0, 3).join(' · ')}</dd>
        </dl>
      </Section>

      <Section title="Machine" hint="Where the model runs. No GPU and no cloud service is involved.">
        <dl className="kv">
          <dt>Processor</dt><dd>{runtime.cpu}</dd><dt>Cores</dt><dd>{runtime.cores}</dd>
          <dt>Memory</dt><dd>{runtime.ram_gb ? `${runtime.ram_gb} GB` : '—'}</dd><dt>Device</dt><dd>{runtime.device}</dd>
          <dt>Software</dt><dd>Python {runtime.python} · LightGBM {runtime.lightgbm}</dd><dt>System</dt><dd>{runtime.os}</dd>
          <dt>Output</dt><dd>{serving.hexagons.toLocaleString()} hexagons × {serving.hours} h = {serving.forecasts.toLocaleString()} forecasts</dd>
        </dl>
      </Section>

      <Section title="Run it live" hint="Pick an area and an hour. The server builds the inputs and runs all three models right now.">
        <Live meta={meta} />
      </Section>

      <Section title="How a forecast is made">
        <ol className="steps-l">
          <li>For an area and an hour, collect its conditions: the weather forecast, hours from Diwali night, recent farm-fire counts, and local roads and land use.</li>
          <li>Three sets of trees each read those conditions and give a low, likely and high PM2.5.</li>
          <li>The likely value is converted to the Indian AQI and coloured on the map.</li>
          <li>It doesn't use yesterday's pollution or nearby sensor readings, so it can run anywhere. That also means it can't correct itself from fresh sensor data.</li>
        </ol>
      </Section>

      <Section title="How fresh is the data">
        <dl className="kv">
          <dt>Weather forecast</dt><dd>fetched {when(f.weather_forecast_fetched)}</dd>
          <dt>Forecast covers</dt><dd>{when(f.weather_forecast_from)} → {when(f.weather_forecast_to)}</dd>
          <dt>Farm fires</dt><dd>observed to {String(f.fires_last_observed)}; assumes ~{String(f.fires_assumed_per_day)}/day after</dd>
          <dt>Latest sensor reading</dt><dd>{when(f.air_quality_last_reading)}</dd>
          <dt>Model trained</dt><dd>{when(f.model_trained)}</dd>
          <dt>Forecast built</dt><dd>{when(f.forecast_built)}</dd>
        </dl>
        <p className="hint" style={{ marginTop: 10 }}>Trained on {info.training.rows?.toLocaleString()} real hourly readings from {info.training.stations} stations. Sources: {info.sources.map((s) => s.name).join(', ')}.</p>
      </Section>
    </>
  )
}
