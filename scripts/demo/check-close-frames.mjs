import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/demo/check-close-frames.mjs <dev-server-url>')
  process.exit(1)
}

const chromeBin = process.env.CHROME || '/usr/bin/google-chrome-stable'
const port = 9341
const profile = await mkdtemp(join(tmpdir(), 'camellia-close-'))

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.next = 1
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id || !this.pending.has(message.id)) return
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = this.next++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

function jump(a, b) {
  if (!a || !b) return 0
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.w - a.w), Math.abs(b.h - a.h))
}

const chrome = spawn(
  chromeBin,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const failures = []

try {
  let list
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      list = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
      if (list.some((item) => item.type === 'page' && item.webSocketDebuggerUrl)) break
    } catch {
      // Chrome is still starting.
    }
    await delay(100)
  }
  const pageInfo = list?.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
  if (!pageInfo) throw new Error('Chrome did not open a debugging port')
  const ws = new WebSocket(pageInfo.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const page = new Cdp(ws)
  await page.send('Page.enable')
  await page.send('Runtime.enable')

  async function check({ width, height, scroll, label }) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await page.send('Page.navigate', { url })
    const ready = await page.send('Runtime.evaluate', {
      expression: `new Promise((resolve) => {
        const start = performance.now()
        function tick() {
          if (document.querySelector('[data-showcase-trigger]')) resolve('ready')
          else if (performance.now() - start > 8000) resolve('timeout')
          else requestAnimationFrame(tick)
        }
        tick()
      })`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (ready.result?.value !== 'ready') {
      failures.push(`${label}: page did not load`)
      return
    }
    const result = await page.send('Runtime.evaluate', {
      expression: `new Promise((resolve) => {
        document.documentElement.dataset.theme = 'light'
        const spacer = document.getElementById('close-check-spacer')
        if (spacer) spacer.remove()
        if (${scroll ? 'true' : 'false'}) {
          const extra = document.createElement('div')
          extra.id = 'close-check-spacer'
          extra.style.height = '900px'
          document.body.appendChild(extra)
          window.scrollTo(0, ${scroll})
        } else {
          window.scrollTo(0, 0)
        }
        const before = window.scrollY
        function box(el) {
          if (!el) return null
          const rect = el.getBoundingClientRect()
          return {
            x: Math.round(rect.x * 100) / 100,
            y: Math.round(rect.y * 100) / 100,
            w: Math.round(rect.width * 100) / 100,
            h: Math.round(rect.height * 100) / 100,
          }
        }
        document.querySelector('[data-showcase-trigger]').click()
        const opened = performance.now()
        function waitOpen() {
          const layer = document.querySelector('.showcase-layer')
          const running = document.getAnimations().some((animation) => animation.playState === 'running' && animation.effect?.target?.closest?.('.showcase-layer'))
          if (layer && !running && performance.now() - opened > 300) {
            const mode = layer.getAttribute('data-mode')
            document.querySelector('[aria-label="Close"]').click()
            const samples = []
            const started = performance.now()
            let closedAt = 0
            function frame() {
              const open = document.querySelector('.showcase-layer')
              const card = open?.querySelector('.showcase-card')
              samples.push({ dialog: !!open, card: box(card), scrollY: window.scrollY })
              if (!open && !closedAt) closedAt = performance.now()
              if (performance.now() - started < 1600 && (!closedAt || performance.now() - closedAt < 120)) requestAnimationFrame(frame)
              else resolve({ mode, before, samples })
            }
            requestAnimationFrame(frame)
            return
          }
          if (performance.now() - opened > 2500) resolve({ failed: 'open', before, samples: [] })
          else requestAnimationFrame(waitOpen)
        }
        requestAnimationFrame(waitOpen)
      })`,
      awaitPromise: true,
      returnByValue: true,
    })
    const value = result.result?.value
    if (!value || value.failed) {
      failures.push(`${label}: dialog did not open`)
      return
    }
    if (width >= 640 && value.mode !== 'desktop') failures.push(`${label}: mode ${value.mode}, expected desktop`)
    const dialog = value.samples.filter((sample) => sample.dialog && sample.card)
    if (dialog.length < 3) {
      failures.push(`${label}: only ${dialog.length} dialog frames`)
      return
    }
    const landed = dialog[dialog.length - 2].card
    const last = dialog[dialog.length - 1].card
    const back = jump(landed, last)
    const towardStart = Math.hypot(last.x - dialog[0].card.x, last.y - dialog[0].card.y) + 1 <
      Math.hypot(landed.x - dialog[0].card.x, landed.y - dialog[0].card.y)
    if (back > 1 && towardStart) {
      failures.push(`${label}: card jumped ${back}px back toward the expanded frame`)
    }
    const after = value.samples.filter((sample) => !sample.dialog).at(-1)
    if (!after) failures.push(`${label}: dialog did not close`)
    else if (Math.abs(after.scrollY - value.before) > 1) {
      failures.push(`${label}: scroll restored to ${after.scrollY}, started at ${value.before}`)
    } else {
      console.log(`${label}: no snap-back, scroll ${value.before} -> ${after.scrollY}, mode ${value.mode}`)
    }
  }

  await check({ width: 1280, height: 800, scroll: 0, label: '1280x800' })
  await check({ width: 1280, height: 500, scroll: 120, label: '1280x500 scrolled' })
  await check({ width: 820, height: 1180, scroll: 0, label: '820x1180' })
  await check({ width: 390, height: 844, scroll: 0, label: '390x844' })
  page.ws.close()
} finally {
  chrome.kill()
  await new Promise((resolve) => {
    if (chrome.exitCode != null || chrome.signalCode != null) resolve()
    else chrome.once('exit', resolve)
  })
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}
console.log('PASS')
