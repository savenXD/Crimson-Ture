import { Metrics } from '../api'
import { ErrorBars, SeasonBars } from './charts'
import ModelLive from './ModelLive'
import ProofPanel from './ProofPanel'
import { Section, Stat } from './ui'

export function hasAccuracy(m: Metrics) {
  return !!(m.hide_a_station?.model_same_rows && m.hide_a_station.copy_nearest_station)
}

export function AccuracyBars({ m }: { m: Metrics }) {
  const h = m.hide_a_station!
  const rows = [
    { n: 'NOx model', v: h.model_same_rows!.mae, us: true },
    { n: 'Copy nearest sensor', v: h.copy_nearest_station!.mae },
    ...(h.cams_global_model ? [{ n: 'Global model (CAMS)', v: h.cams_global_model.mae }] : []),
  ]
  return <ErrorBars rows={rows} />
}

export default function ModelView({ m }: { m: Metrics }) {
  if (!hasAccuracy(m)) {
    return (
      <div className="view">
        <div className="empty-s">
          <h3>No test results yet</h3>
          <p className="lede">Accuracy appears here once the model has been trained and tested (<code className="inl">ml/models/metrics.json</code>).</p>
        </div>
      </div>
    )
  }
  const h = m.hide_a_station!
  const base = h.copy_nearest_station!.mae
  const ours = h.model_same_rows!.mae
  const gain = base > 0 ? Math.round((1 - ours / base) * 100) : 0
  const seasons = Object.entries(m.held_out_season ?? {})
  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">Model · tested on data it never saw</div>
        <h2 className="title">How accurate is this?</h2>
        <p className="lede">Two tests. Each sensor is hidden in turn and predicted from the model alone, then a whole Diwali season is held out and forecast.</p>
      </div>

      <div className="stats3">
        <Stat label="Avg. error" value={ours} unit="µg/m³" sub="hidden sensors" />
        <Stat label="R²" value={h.model_same_rows!.r2.toFixed(2)} sub="hidden sensors" />
        <Stat label="vs nearest sensor" value={`${gain > 0 ? '−' : '+'}${Math.abs(gain)}%`} sub="error" tone={gain > 0 ? '#2f8f57' : '#e0533d'} />
      </div>

      <ProofPanel />

      <Section title="Hide-a-station test" hint="Average error in µg/m³ when a real sensor is hidden and predicted. Lower is better.">
        <AccuracyBars m={m} />
      </Section>

      {seasons.length > 0 && (
        <Section title="Unseen Diwali seasons" hint="Peak PM2.5 (µg/m³): actual vs forecast, with that season left out of training.">
          <SeasonBars seasons={seasons} />
          <div className="legend-inline"><span><i style={{ background: '#c3c8d0' }} />Actual</span><span><i style={{ background: '#0f1115' }} />Predicted</span></div>
          <table className="tbl">
            <thead><tr><th>Season</th><th>R²</th><th>Error</th><th>Peak (actual / predicted)</th></tr></thead>
            <tbody>
              {seasons.map(([y, s]) => (
                <tr key={y}><td>{y}</td><td>{s.r2.toFixed(2)}</td><td>{s.mae}</td><td>{s.peak_actual} / {s.peak_predicted}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Training data">
        <div className="stats3">
          {m.stations != null && <Stat label="Stations" value={m.stations} />}
          {m.rows != null && <Stat label="Hourly readings" value={m.rows.toLocaleString()} />}
          {m.seasons && <Stat label="Seasons" value={m.seasons.length} sub={m.seasons.length ? `${Math.min(...m.seasons)}–${Math.max(...m.seasons)}` : undefined} />}
        </div>
      </Section>

      <ModelLive />

      <Section title="Known limits">
        <ul className="limits">
          <li>On past Diwali nights it tended to under-call the sharpest peak (see the replay above).</li>
          <li>Traffic isn't measured directly; road density stands in for it.</li>
          <li>Future farm-fire counts are unknown, so the last week's level is assumed to continue.</li>
          <li>Weather forecasts several days out can change.</li>
        </ul>
      </Section>
    </div>
  )
}
