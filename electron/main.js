// Desktop shell: starts the FastAPI backend (which also serves the built website) and shows it in a window.
const { app, BrowserWindow, shell } = require('electron')
const { spawn, execFileSync } = require('child_process')
const net = require('net')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const PY = path.join(ROOT, '.venv', 'bin', 'python')
let backend = null

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) })
    s.on('error', reject)
  })
}

async function waitFor(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('The NOx backend did not start. Run ./nox run once in a terminal to set up data and the model.')
}

function ensureBuilt() {
  if (fs.existsSync(path.join(ROOT, 'frontend', 'dist', 'index.html'))) return
  execFileSync('npm', ['run', 'build', '--silent'], { cwd: path.join(ROOT, 'frontend'), stdio: 'inherit' })
}

async function start() {
  if (!fs.existsSync(PY)) throw new Error('Python environment missing. Run ./nox setup first.')
  ensureBuilt()
  const port = await freePort()
  backend = spawn(PY, ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warning'],
    { cwd: ROOT, stdio: 'inherit' })
  backend.on('exit', code => { if (code) console.error('backend exited with code', code) })
  await waitFor(`http://127.0.0.1:${port}/api/meta`)

  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, title: 'NOx', backgroundColor: '#ffffff',
    icon: path.join(ROOT, 'frontend', 'public', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.setMenuBarVisibility(false)
  // links to other sites open in the normal browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://127.0.0.1:${port}`)) { e.preventDefault(); shell.openExternal(url) } })
  await win.loadURL(`http://127.0.0.1:${port}`)
}

app.whenReady().then(() => start().catch(err => {
  require('electron').dialog.showErrorBox('NOx could not start', String(err.message || err))
  app.quit()
}))
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { if (backend) backend.kill() })
