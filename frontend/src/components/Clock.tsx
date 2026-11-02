import { band } from '../aqi'
import { Meta } from '../api'
import { at } from '../format'

// 5×7 dot-matrix glyphs, one string per row ('1' = lit LED).
const FONT: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  ':': ['00', '11', '11', '00', '11', '11', '00'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
}

/** A line of text as an LED dot matrix: every dot is drawn, unlit ones as faint ghosts. */
function Dots({ text, px, blink }: { text: string; px: number; blink?: boolean }) {
  const cols: { on: boolean[]; colon: boolean }[] = []
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']
    if (cols.length) cols.push({ on: Array(7).fill(false), colon: false })
    for (let c = 0; c < g[0].length; c++) cols.push({ on: g.map((r) => r[c] === '1'), colon: ch === ':' })
  }
  const r = px * 0.42
  return (
    <svg className="dots" width={cols.length * px} height={7 * px} viewBox={`0 0 ${cols.length * px} ${7 * px}`} aria-hidden>
      {cols.flatMap((col, x) => col.on.map((on, y) => (
        <rect key={`${x}-${y}`} x={x * px + px / 2 - r} y={y * px + px / 2 - r} width={r * 2} height={r * 2} rx={r * 0.35}
          className={on ? (blink && col.colon ? 'on blink' : 'on') : 'off'} />
      )))}
    </svg>
  )
}

/** Digital LED clock showing the forecast hour being viewed; the LEDs glow in the city's current AQI colour. */
export default function Clock({ meta, t, aqi }: { meta: Meta; t: number; aqi?: number }) {
  const hh = at(meta, t, { hour: '2-digit', hour12: true }).replace(/\D/g, '').padStart(2, '0')
  const pm = +at(meta, t, { hour: 'numeric', hour12: false }) % 24 >= 12
  const date = `${at(meta, t, { weekday: 'short' })} ${at(meta, t, { day: '2-digit' })} ${at(meta, t, { month: 'short' })}`
  const led = aqi != null ? band(aqi).color : '#ffb347'

  return (
    <div className="clock card" style={{ ['--led' as string]: led }}
      aria-label={`${at(meta, t, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', hour12: true })}`}>
      <div className="clock-panel">
        <div className="clock-row">
          <Dots text={`${hh}:00`} px={3.4} blink />
          <div className="clock-ampm">
            <span className={pm ? '' : 'lit'}><Dots text="AM" px={1.8} /></span>
            <span className={pm ? 'lit' : ''}><Dots text="PM" px={1.8} /></span>
          </div>
        </div>
        <Dots text={date} px={3.2} />
      </div>
    </div>
  )
}
