/** Browser side of alerts. Push needs https or localhost; elsewhere the app shows the same alerts in-app. */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext

const b64 = (s: string) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const post = (u: string, body: unknown) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() })

export async function currentSub() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enableAlerts(h3: string, lang: 'en' | 'hi', rules: Record<string, boolean>) {
  if (!pushSupported()) throw new Error('unsupported')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied')
  const reg = await navigator.serviceWorker.ready
  const { key } = await fetch('/api/push/key').then((r) => r.json())
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
  return post('/api/push/subscribe', { subscription: sub.toJSON(), h3, lang, rules })
}

export async function disableAlerts() {
  const sub = await currentSub()
  if (!sub) return
  await post('/api/push/unsubscribe', { endpoint: sub.endpoint })
  await sub.unsubscribe()
}

export async function sendNow(kind: 'test' | 'daybefore' | 'headsup' | 'severe') {
  const sub = await currentSub()
  if (!sub) throw new Error('not subscribed')
  return post('/api/push/send', { endpoint: sub.endpoint, kind })
}

export type AlertPreview = { kind: string; send_at: string; title: string; body: string; level: string }
export const getPreview = (h3: string, lang: string) => fetch(`/api/push/preview?h3=${h3}&lang=${lang}`).then((r) => r.json() as Promise<{ alerts: AlertPreview[] }>)
