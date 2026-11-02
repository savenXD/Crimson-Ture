import { useEffect, useState } from 'react'
import App from './App'
import MobileApp from './mobile/MobileApp'

const Q = '(max-width: 860px)'
const forced = () => { const v = new URLSearchParams(location.search).get('app'); return v === '1' ? true : v === '0' ? false : null }

/** Phones get the app layout; larger screens get the dashboard. `?app=1` / `?app=0` forces one for previewing. */
export default function Root() {
  const [mobile, setMobile] = useState(() => forced() ?? window.matchMedia(Q).matches)
  useEffect(() => {
    if (forced() != null) return
    const mq = window.matchMedia(Q)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile ? <MobileApp /> : <App />
}
