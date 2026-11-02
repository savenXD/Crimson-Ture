// CPCB National AQI bands (same breakpoints as ml/aqi.py)
export const BANDS = [
  { max: 50, name: 'Good', color: '#5cb87a', ink: '#14532d' },
  { max: 100, name: 'Satisfactory', color: '#a6cf63', ink: '#3f5d12' },
  { max: 200, name: 'Moderate', color: '#f2c94c', ink: '#6b4e00' },
  { max: 300, name: 'Poor', color: '#f2994a', ink: '#7a3b05' },
  { max: 400, name: 'Very Poor', color: '#e0533d', ink: '#fff' },
  { max: Infinity, name: 'Severe', color: '#8e2c48', ink: '#fff' },
]

export const bandIndex = (aqi: number) => {
  const i = BANDS.findIndex((b) => aqi <= b.max)
  return i < 0 ? BANDS.length - 1 : i
}
export const band = (aqi: number) => BANDS[bandIndex(aqi)]

/** MapLibre step expression that colours by the `aqi` feature property. */
export const colorExpr = (): any => {
  const e: any[] = ['step', ['get', 'aqi'], BANDS[0].color]
  BANDS.slice(1).forEach((b, i) => e.push(BANDS[i].max + 1, b.color))
  return e
}

const BP: [number, number, number, number][] = [
  [0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500],
]
export function pmToAqi(pm: number) {
  for (const [lo, hi, a, b] of BP) if (pm <= hi) return a + ((Math.max(pm, lo) - lo) * (b - a)) / (hi - lo)
  return 500 + (pm - 500) * 0.2
}
