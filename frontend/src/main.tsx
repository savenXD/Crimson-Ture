import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import Root from './Root'

createRoot(document.getElementById('root')!).render(<Root />)

// Offline support needs a secure context (https or localhost). On a plain http LAN address the browser won't allow it.
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {})
