import { useCallback, useEffect, useRef, useState } from 'react'
import { Meta, getHexes } from './api'
import { BANDS, bandIndex } from './aqi'

export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const a = from.current, t0 = performance.now()
    let raf = 0
    const tick = (n: number) => {
      const k = Math.min(1, (n - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (target - a) * e))
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target, ms])
  return v
}

export function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => { const h = setTimeout(() => setD(v), ms); return () => clearTimeout(h) }, [v, ms])
  return d
}

export type Base = { h3: string[]; dist: number[]; index: Map<string, number> }
export type Frame = { aqi: number[]; pm25: number[] }
/** City-wide summary of one forecast hour, computed from every hexagon. lo/hi are the 10th/90th percentile hexagon. */
export type HourStat = { t: number; mean: number; lo: number; hi: number; max: number; shares: number[] }

function summarise(t: number, aqi: number[]): HourStat {
  const s = [...aqi].sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  const counts = BANDS.map(() => 0)
  for (const a of aqi) counts[bandIndex(a)]++
  return { t, mean: Math.round(aqi.reduce((a, b) => a + b, 0) / aqi.length), lo: q(0.1), hi: q(0.9), max: s[s.length - 1], shares: counts.map((c) => c / aqi.length) }
}

/**
 * Loads the hexagon forecast for every hour: the requested hour first, the rest in the background,
 * so scrubbing and playback are instant and the city-wide charts cover the whole window.
 */
export function useFrames(meta: Meta | undefined, want: number) {
  const frames = useRef(new Map<number, Frame>())
  const inflight = useRef(new Map<number, Promise<void>>())
  const shown = useRef<Frame>(undefined)
  const [base, setBase] = useState<Base>()
  const [stats, setStats] = useState<(HourStat | undefined)[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback((t: number) => {
    if (frames.current.has(t)) return Promise.resolve()
    let p = inflight.current.get(t)
    if (!p) {
      p = getHexes(t)
        .then((h) => {
          frames.current.set(t, { aqi: h.aqi, pm25: h.pm25 })
          setBase((b) => b ?? { h3: h.h3, dist: h.dist, index: new Map(h.h3.map((id, i) => [id, i])) })
          setStats((s) => { const n = s.slice(); n[t] = summarise(t, h.aqi); return n })
        })
        .catch(() => setFailed(true))
        .finally(() => inflight.current.delete(t))
      inflight.current.set(t, p)
    }
    return p
  }, [])

  const ready = !!meta?.ready
  useEffect(() => { if (ready) load(want) }, [ready, want, load])

  useEffect(() => {
    if (!ready || !meta) return
    let stop = false
    const queue = Array.from({ length: meta.hours }, (_, i) => i)
    const worker = async () => { while (!stop && queue.length) await load(queue.shift()!) }
    // let the first hour paint before the background fill starts
    const h = setTimeout(() => { for (let i = 0; i < 4; i++) worker() }, 250)
    return () => { stop = true; clearTimeout(h) }
  }, [ready, meta?.hours, load])

  const f = frames.current.get(want)
  if (f) shown.current = f
  const loaded = stats.filter(Boolean).length
  return { base, frame: shown.current, exact: !!f, stats, loaded, failed, get: (t: number) => frames.current.get(t) }
}
