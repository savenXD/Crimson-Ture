export type Meta = {
  ready: boolean; city: string; start: string; hours: number; diwali_t: number; hexes: number
  stations: { id?: number; name: string; lat: number; lon: number; last?: number | null; last_time?: string | null; url?: string }[]
}
export type Hexes = { t: number; h3: string[]; pm25: number[]; aqi: number[]; dist: number[] }
export type Point = { t: number; p10: number; p50: number; p90: number; aqi: number }
export type Detail = {
  h3: string; lat: number; lon: number; nearest_station: string; dist_km: number; t: number; aqi: number
  category: string; pm25: number; p10: number; p90: number; advice: { en: string; hi: string }
  alert: { en: string; hi: string }; peak_t: number; series: Point[]; causes: { name: string; share: number }[] | null
}
export type Hotspot = { h3: string; lat: number; lon: number; near: string; aqi: number; dist_km: number }

const j = <T,>(u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json() as Promise<T> })
export const getMeta = () => j<Meta>('/api/meta')
export const getHexes = (t: number) => j<Hexes>(`/api/hexes?t=${t}`)
export const getHex = (h: string, t: number) => j<Detail>(`/api/hex/${h}?t=${t}`)
export const getHotspots = (t: number) => j<Hotspot[]>(`/api/hotspots?t=${t}&n=6`)

export type Metrics = {
  hide_a_station?: { model_same_rows?: { mae: number; r2: number }; copy_nearest_station?: { mae: number }; cams_global_model?: { mae: number } }
  held_out_season?: Record<string, { r2: number; mae: number; peak_actual: number; peak_predicted: number }>
  stations?: number; rows?: number; seasons?: number[]
}
export const getMetrics = () => j<Metrics>('/api/metrics')

export type Stage = { id: string; label: string; state: 'done' | 'running' | 'pending'; progress: number; detail: string }
export const getStatus = () => j<{ stages: Stage[] }>('/api/status')

export type ModelInfo = {
  model: { family: string; version: string; xgboost: string; objective: string; params: Record<string, number>; n_features: number
    files: { name: string; role: string; kb: number; sha: string; trees: number; trained: string }[] }
  features: { name: string; label: string; group: string; gain: number }[]
  training: { rows?: number; stations?: number; seasons?: number[] }
  runtime: { python: string; lightgbm: string; xgboost: string; cpu: string; cores: number; ram_gb: number | null; os: string; device: string }
  serving: { hexagons: number; hours: number; forecasts: number; start: string }
  freshness: Record<string, string | number | null>
  sources: { name: string; detail: string }[]
}
export type LiveRun = {
  h3: string; t: number; when_utc: string
  prediction: { p10: number; p50: number; p90: number; aqi: number; category: string }
  baseline_pm25: number
  inputs: { name: string; label: string; group: string; unit: string; value: number | null; push: number }[]
  timing_ms: { features: number; model: number; total: number }
  check: { saved_p50: number | null; matches: boolean | null }
  trees_evaluated: number
}
export const getModelInfo = () => j<ModelInfo>('/api/model')
export const getLive = (h: string, t: number) => j<LiveRun>(`/api/model/live?h3=${h}&t=${t}`)

export type Replay = {
  season: number; diwali: string; rows: number; stations_used: number; trained_on_rows: number
  city: number[][]                                             // [h, actual, p50, p10, p90]
  stations: { id: number; name: string; url: string | null; n: number; series: number[][] }[]
  stats: { mae: number; corr: number; within_range: number; peak_actual: number; peak_pred: number; peak_actual_h: number; peak_pred_h: number }
}
export type Proof = {
  generated: string; replays: Replay[]
  latest: { id: number; name: string; url: string | null; last_time: string; last: number; mean_24h: number }[]
  fingerprints: Record<string, { sha256: string; bytes: number }>
}
export const getProof = () => j<Proof>('/api/proof')
