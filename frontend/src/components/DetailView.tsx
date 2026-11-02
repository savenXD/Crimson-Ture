import { useState } from 'react'
import { band, pmToAqi } from '../aqi'
import { Detail, Meta } from '../api'
import { fullLabel } from '../format'
import { useCountUp } from '../hooks'
import { CauseDonut, ForecastChart } from './charts'
import { Gauge } from './Overview'
import { Chip, Icon, Section, Stat } from './ui'

export default function DetailView({ meta, d, t, loading, onBack, onSeek, toast }: {
  meta: Meta; d: Detail; t: number; loading: boolean; onBack: () => void; onSeek: (t: number) => void; toast: (s: string) => void
}) {
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [copied, setCopied] = useState(false)
  const aqi = useCountUp(d.aqi)
  const lo = Math.round(pmToAqi(d.p10)), hi = Math.round(pmToAqi(d.p90))
  const peak = d.series[d.peak_t]
  const near = d.dist_km < 1.5

  const copy = () => {
    navigator.clipboard?.writeText(d.alert[lang]).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }, () => toast('Could not copy to the clipboard'))
  }

  return (
    <div className={`view ${loading ? 'dim' : ''}`}>
      <button className="back" onClick={onBack}><Icon n="back" size={14} /> All of {meta.city}</button>
      <div className="hero">
        <div className="eyebrow">Near {d.nearest_station}</div>
        <div className="hero-row">
          <div className="big" style={{ ['--glow' as string]: band(d.aqi).color }}>{aqi}</div>
          <div className="hero-side">
            <Chip aqi={d.aqi} label={d.category} />
            <span className="mono">{d.lat.toFixed(3)}°N {d.lon.toFixed(3)}°E</span>
          </div>
        </div>
        <Gauge value={d.aqi} lo={lo} hi={hi} />
      </div>

      <div className="stats3">
        <Stat label="PM2.5" value={d.pm25} unit="µg/m³" sub={`${d.p10}–${d.p90} likely`} />
        <Stat label="Likely AQI range" value={`${lo}–${hi}`} sub="P10–P90" />
        <Stat label={near ? 'Sensor' : 'Nearest sensor'} value={near ? 'Nearby' : d.dist_km} unit={near ? undefined : 'km'} sub={near ? d.nearest_station : 'model estimate'} />
      </div>

      <Section title="6-day forecast · AQI" hint="Line: most likely. Shaded: likely range. Click to jump to an hour.">
        <ForecastChart meta={meta} series={d.series} t={t} peak={d.peak_t} onSeek={onSeek} />
        {peak && (
          <button className="callout" onClick={() => onSeek(d.peak_t)}>
            <Icon n="alert" />
            <span>Expected peak <b style={{ color: band(peak.aqi).color }}>{peak.aqi}</b> on <b>{fullLabel(meta, d.peak_t)}</b></span>
          </button>
        )}
      </Section>

      {d.causes && (
        <Section title="What is driving it" hint="Share of the model's upward push on this hour's estimate.">
          <CauseDonut causes={d.causes} />
        </Section>
      )}

      <Section title="What to do" aside={
        <div className="seg" role="tablist">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
        </div>
      }>
        <div className="advice" style={{ borderColor: band(d.aqi).color }}>{d.advice[lang]}</div>
        <div className="msg">
          <div className="msg-h"><span><Icon n="share" size={14} /> Community alert · SMS / WhatsApp</span></div>
          <div className="bubble">{d.alert[lang]}</div>
          <div className="msg-a">
            <button className="btn sm" onClick={copy}><Icon n={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy'}</button>
            <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(d.alert[lang])}`} target="_blank" rel="noreferrer"><Icon n="share" size={14} />WhatsApp</a>
          </div>
        </div>
      </Section>
      <p className="foot mono">H3 {d.h3}</p>
    </div>
  )
}
