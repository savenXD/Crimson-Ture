export type Category = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe'

export interface HexCell { h3: string; pm25: number; aqi: number; category: Category }
export interface ForecastPoint { t: number; p10: number; p50: number; p90: number; aqi: number; category: Category }
export interface Driver { source: string; ug_m3: number; share: number }
export interface Advisory { now: ForecastPoint; advice: string; safest_hours_offset: number[] }

const get = async <T,>(path: string): Promise<T> => {
  const r = await fetch(`/api${path}`)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

export const api = {
  hexes: (t: number) => get<{ cells: HexCell[] }>(`/hexes?t=${t}`),
  forecast: (h3: string) => get<{ nearest_station: string; series: ForecastPoint[] }>(`/forecast/${h3}`),
  explain: (h3: string, t: number) => get<{ pm25: number; drivers: Driver[] }>(`/explain/${h3}?t=${t}`),
  advisory: (h3: string, t: number) => get<Advisory>(`/advisory/${h3}?t=${t}`),
  scenario: async (t: number, cracker_factor: number, traffic_factor: number) => {
    const r = await fetch('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t, cracker_factor, traffic_factor }),
    })
    return r.json() as Promise<{ mean_pm25_before: number; mean_pm25_after: number }>
  },
}

// CPCB National AQI colours
export const AQI_COLORS: Record<Category, string> = {
  Good: '#00b050',
  Satisfactory: '#92d050',
  Moderate: '#e6d200',
  Poor: '#ff9900',
  'Very Poor': '#ff2a2a',
  Severe: '#9b0000',
}

export const phaseLabel = (t: number) => {
  if (t < -24) return `Before Diwali · D${Math.floor((t + 20) / 24)}`
  if (t <= 36) return 'Diwali window'
  return `After Diwali · D+${Math.floor((t + 20) / 24)}`
}
