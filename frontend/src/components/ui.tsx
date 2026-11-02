import { ReactNode } from 'react'
import { band } from '../aqi'

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3l11 6.5v13L16 29 5 22.5v-13z" fill="#0f1115" />
      <path d="M16 11l5 3v6l-5 3-5-3v-6z" fill="#fff" />
    </svg>
  )
}

const P: Record<string, ReactNode> = {
  play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />,
  pause: <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor" />,
  locate: <><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  cube: <path d="M8 1.8l5.5 3.1v6.2L8 14.2l-5.5-3.1V4.9zM2.7 5L8 8l5.3-3M8 8v6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  back: <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  copy: <><rect x="5" y="5" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3 10.5V4.2C3 3.5 3.5 3 4.2 3h6.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
  check: <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  share: <path d="M8 2v8M5 4.8L8 2l3 2.8M3.5 8.5v4c0 .6.4 1 1 1h7c.6 0 1-.4 1-1v-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
  sensor: <><circle cx="8" cy="8" r="2" fill="currentColor" /><path d="M4.5 4.5a5 5 0 000 7M11.5 4.5a5 5 0 010 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
  flame: <path d="M8 1.8c.5 2.4 3.8 3.9 3.8 7.4A3.8 3.8 0 018 13.9a3.8 3.8 0 01-3.8-3.7c0-1.6.9-2.6 1.6-3.2.1 1.2.7 2 1.5 2.2C7 7 7.3 4 8 1.8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  alert: <><path d="M8 2l6.3 11H1.7z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.5v3M8 11.3v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  keyboard: <><rect x="1.5" y="4" width="13" height="8.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 10h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
}
export function Icon({ n, size = 16 }: { n: keyof typeof P | string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>{P[n]}</svg>
}

export function Chip({ aqi, label }: { aqi: number; label?: string }) {
  const b = band(aqi)
  return (
    <span className="chip tag"><i style={{ background: b.color }} />{label ?? b.name}</span>
  )
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <span className="stat-l">{label}</span>
      <span className="stat-v" style={tone ? { color: tone } : undefined}>{value}{unit && <small>{unit}</small>}</span>
      {sub && <span className="stat-s">{sub}</span>}
    </div>
  )
}

export function Section({ title, aside, children, hint }: { title: string; aside?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="sec">
      <header className="sec-h">
        <div><h4>{title}</h4>{hint && <p className="hint">{hint}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skel" style={{ height: h }} />
}

/** Generic tooltip shell for Recharts `content`. */
export function Tip({ title, rows }: { title: ReactNode; rows: { k: string; v: ReactNode; c?: string }[] }) {
  return (
    <div className="tip">
      <div className="tip-t">{title}</div>
      {rows.map((r) => (
        <div className="tip-r" key={r.k}>
          {r.c && <i style={{ background: r.c }} />}<span>{r.k}</span><b>{r.v}</b>
        </div>
      ))}
    </div>
  )
}
