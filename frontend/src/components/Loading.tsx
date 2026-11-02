import { Metrics, Stage } from '../api'
import { AccuracyBars, hasAccuracy } from './ModelView'
import { Logo } from './ui'

export function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty">
      <div className="card panel-c">
        <div className="brand-row"><Logo /><b>NOx</b></div>
        <h2>Can't reach the forecast server</h2>
        <p className="lede">The website needs the NOx API. Start everything from the project folder:</p>
        <code className="cmd">./nox run</code>
        <p className="lede">Retrying automatically…</p>
        <button className="btn" onClick={onRetry}>Retry now</button>
      </div>
    </div>
  )
}

export default function Loading({ stages, metrics }: { stages: Stage[]; metrics: Metrics }) {
  const doneN = stages.filter((x) => x.state === 'done').length
  const run = stages.find((x) => x.state === 'running')
  const pct = stages.length ? Math.round(((doneN + (run?.progress ?? 0)) / stages.length) * 100) : 0
  return (
    <div className="empty">
      <div className="bg-hex" aria-hidden />
      <div className="card panel-c">
        <div className="brand-row"><Logo /><b>NOx</b><span className="badge">{pct}%</span></div>
        <h2>Building the forecast</h2>
        <p className="lede">Real data only. Nothing is shown until the model has been trained and tested.</p>
        <div className="meter"><i style={{ width: `${pct}%` }} /></div>
        <ol className="steps">
          {stages.map((x, i) => (
            <li key={x.id} className={x.state} style={{ animationDelay: `${i * 50}ms` }}>
              <span className="tick">{x.state === 'done' ? '✓' : x.state === 'running' ? <i className="spin" /> : i + 1}</span>
              <div>
                <span>{x.label}</span>
                {x.state === 'running' && x.detail && <small>{x.detail}</small>}
                {x.state === 'running' && x.progress > 0 && x.progress < 1 && <div className="meter thin"><i style={{ width: `${x.progress * 100}%` }} /></div>}
              </div>
            </li>
          ))}
        </ol>
        {hasAccuracy(metrics) && (
          <div className="accwrap">
            <h4>First test results · error in µg/m³ (lower is better)</h4>
            <AccuracyBars m={metrics} />
          </div>
        )}
        <p className="lede small">Not started? Run <code className="inl">./nox run</code> in the project folder.</p>
      </div>
    </div>
  )
}
