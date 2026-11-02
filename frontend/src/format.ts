import { Meta } from './api'

export const at = (m: Meta, t: number, o: Intl.DateTimeFormatOptions) =>
  new Date(new Date(m.start).getTime() + t * 3600e3).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...o })

export const dayLabel = (m: Meta, t: number) => at(m, t, { weekday: 'short', day: 'numeric', month: 'short' })
export const hourLabel = (m: Meta, t: number) => at(m, t, { hour: 'numeric', hour12: true })
export const fullLabel = (m: Meta, t: number) => at(m, t, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

/** Hours (window offsets) that fall on IST midnight. */
export function dayTicks(m: Meta) {
  const h0 = +at(m, 0, { hour: 'numeric', hour12: false }) % 24
  const out: number[] = []
  for (let t = (24 - h0) % 24; t < m.hours; t += 24) out.push(t)
  return out
}

export function phaseOf(m: Meta, t: number) {
  if (t < m.diwali_t - 4) return { key: 'before', name: 'Before Diwali' }
  if (t < m.diwali_t + 14) return { key: 'during', name: 'Diwali night' }
  return { key: 'after', name: 'After Diwali' }
}

export const pct = (x: number) => `${Math.round(x * 100)}%`
