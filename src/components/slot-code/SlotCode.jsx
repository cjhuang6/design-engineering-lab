import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cssDurationMs } from '../hex-color-picker/model.js'
import {
  COPIED_MS,
  COUNTDOWN_DEFAULT,
  FILL_EMPTY,
  REEL_COUNT,
  REST_WORD,
  RETRO_HOLD_MS,
  cycleDurationMs,
  expiryText,
  idleDelayMs,
  makeSchedule,
  motionFromCss,
  percentAt,
  poseAt,
  randomDigits,
  returnRun,
  retroClip,
  smoothClip,
  spinRun,
  spokenCode,
  unbiasedBelow,
  unitEase,
} from './model.js'
import './SlotCode.css'

const INITIAL_VIEW = {
  busy: false,
  counting: false,
  label: 'create',
  glyphs: REST_WORD.slice(),
  announcement: '',
  description: '',
  status: '',
  codeText: 'No code yet',
}

function nextByte() {
  const bytes = new Uint8Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0]
}

function nextUint32() {
  const words = new Uint32Array(1)
  crypto.getRandomValues(words)
  return words[0]
}

function nextDigit() {
  for (;;) {
    const value = nextByte()
    if (value < 250) return String(value % 10)
  }
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readFade() {
  const duration = cssDurationMs(getComputedStyle(document.documentElement).getPropertyValue('--duration-normal'))
  return duration > 0 ? duration : 200
}

function readEase() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ease-standard').trim()
}

function readMotion() {
  const style = getComputedStyle(document.documentElement)
  return motionFromCss((name) => cssDurationMs(style.getPropertyValue(name)))
}

function blankRuns() {
  return Array.from({ length: REEL_COUNT }, () => null)
}

function staticPoses(glyphs) {
  return glyphs.map((glyph) => ({ a: glyph, b: glyph, phase: 0 }))
}

function createModel() {
  const shown = REST_WORD.slice()
  return {
    phase: 'resting',
    appliedStyle: 'smooth',
    shown,
    from: shown.slice(),
    next: shown.slice(),
    runs: blankRuns(),
    poses: staticPoses(shown),
    reduced: false,
    motionStart: 0,
    frameNow: 0,
    fadeMs: 200,
    ease: 'linear',
    motion: readMotion(),
    cycleStart: 0,
    duration: 0,
    schedule: [],
    hinted: false,
    lastSecond: null,
    copiedUntil: 0,
    nextIdle: Number.POSITIVE_INFINITY,
    clip: FILL_EMPTY,
    readNow: () => performance.now(),
    requestCreate: () => {},
    announcement: '',
    description: '',
    status: '',
    codeText: 'No code yet',
    published: { ...INITIAL_VIEW, glyphs: shown.slice() },
  }
}

function setFlap(flap, fromGlyph, toGlyph, phase) {
  const staticTop = flap.querySelector('.slot-static.slot-half-top')
  const staticBot = flap.querySelector('.slot-static.slot-half-bot')
  const leafTop = flap.querySelector('.slot-leaf.slot-half-top')
  const leafBot = flap.querySelector('.slot-leaf.slot-half-bot')
  const topText = staticTop.firstChild
  const botText = staticBot.firstChild
  const leafTopText = leafTop.firstChild
  const leafBotText = leafBot.firstChild
  const topShade = leafTop.lastChild
  const botShade = leafBot.lastChild
  topText.textContent = String(toGlyph)
  botText.textContent = String(fromGlyph)
  leafTopText.textContent = String(fromGlyph)
  leafBotText.textContent = String(toGlyph)
  const angle = -180 * phase * phase
  if (phase <= 0) {
    leafTop.style.visibility = 'hidden'
    leafBot.style.visibility = 'hidden'
    leafTop.style.transform = ''
    leafBot.style.transform = ''
    topShade.style.opacity = '0'
    botShade.style.opacity = '0'
    topText.textContent = String(fromGlyph)
    return
  }
  if (angle > -90) {
    leafTop.style.visibility = 'visible'
    leafBot.style.visibility = 'hidden'
    leafTop.style.transform = `rotateX(${angle.toFixed(2)}deg)`
    leafBot.style.transform = ''
    topShade.style.opacity = (0.2 * Math.sin((-angle * Math.PI) / 180)).toFixed(3)
    return
  }
  const bottom = 180 + angle
  leafTop.style.visibility = 'hidden'
  leafBot.style.visibility = 'visible'
  leafTop.style.transform = ''
  leafBot.style.transform = `rotateX(${bottom.toFixed(2)}deg)`
  botShade.style.opacity = (0.2 * Math.sin((bottom * Math.PI) / 180)).toFixed(3)
}

function RefreshIcon({ active }) {
  return (
    <svg
      data-icon="create"
      className={active ? 'is-on' : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function CopyIcon({ active }) {
  return (
    <svg
      data-icon="copy"
      className={active ? 'is-on' : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function ButtonFace({ label }) {
  return (
    <span className="slot-copy-face">
      <span className="slot-copy-icons">
        <RefreshIcon active={label === 'create'} />
        <CopyIcon active={label !== 'create'} />
      </span>
      <span className="slot-copy-label">
        <span className={label === 'create' ? 'is-on' : undefined} data-label="create">
          Create code
        </span>
        <span className={label === 'copy' ? 'is-on' : undefined} data-label="copy">
          Copy code
        </span>
        <span className={label === 'copied' ? 'is-on' : undefined} data-label="copied">
          Copied
        </span>
      </span>
    </span>
  )
}

function Flap({ kind }) {
  return (
    <div className={`slot-flap slot-flap-${kind}`} aria-hidden="true">
      <div className="slot-half slot-half-top slot-static">
        <span>0</span>
      </div>
      <div className="slot-half slot-half-bot slot-static">
        <span>0</span>
      </div>
      <div className="slot-half slot-half-top slot-leaf">
        <span>0</span>
        <i />
      </div>
      <div className="slot-half slot-half-bot slot-leaf">
        <span>0</span>
        <i />
      </div>
    </div>
  )
}

function labelName(label) {
  if (label === 'copied') return 'Copied'
  if (label === 'copy') return 'Copy code'
  return 'Create code'
}

export const SLOT_CODE_DESCRIPTION =
  'Six split-flap reels rest on HELLO!. Create code spins a 6-digit code drawn from crypto.getRandomValues. This is a demo, not a one-time password. The button fill is the countdown. Smooth is the default and the graphite fill grows left to right across the selected duration. Retro jumps from empty to full across 3 seconds. When time runs out, the reels flip back to HELLO!. The button does not show a percent or a seconds count.'

export function SlotCode({ fillStyle = 'smooth', countdownSeconds = COUNTDOWN_DEFAULT }) {
  const rootRef = useRef(null)
  const fillRef = useRef(null)
  const modelRef = useRef(null)
  const aliveRef = useRef(true)
  const fillStyleRef = useRef(fillStyle)
  const countdownRef = useRef(countdownSeconds)
  const timeId = useId()
  const [view, setView] = useState(INITIAL_VIEW)

  if (modelRef.current == null) {
    modelRef.current = createModel()
  }

  function paint() {
    const root = rootRef.current
    const model = modelRef.current
    if (!root || !model) return
    const moving = model.phase === 'spinning' || model.phase === 'returning'
    const reels = root.querySelectorAll('.slot-reel')
    reels.forEach((reel, index) => {
      const current = reel.querySelector('.slot-flap-current')
      const incoming = reel.querySelector('.slot-flap-next')
      if (moving && model.reduced) {
        const target = model.phase === 'returning' ? REST_WORD[index] : model.next[index]
        setFlap(current, model.from[index], model.from[index], 0)
        setFlap(incoming, target, target, 0)
        const amount = model.fadeMs > 0 ? (model.frameNow - model.motionStart) / model.fadeMs : 1
        const eased = unitEase(model.ease, amount)
        current.style.opacity = String(1 - eased)
        incoming.style.visibility = 'visible'
        incoming.style.opacity = String(eased)
        return
      }
      incoming.style.visibility = 'hidden'
      incoming.style.opacity = '0'
      current.style.opacity = '1'
      const pose = model.poses[index]
      setFlap(current, pose.a, pose.b, pose.phase)
    })
    if (fillRef.current) fillRef.current.style.clipPath = model.clip
  }

  useLayoutEffect(() => {
    fillStyleRef.current = fillStyle === 'smooth' ? 'smooth' : 'retro'
    countdownRef.current = countdownSeconds
    paint()
  })

  useEffect(() => {
    const model = modelRef.current
    aliveRef.current = true
    let raf = 0
    let offset = 0
    let hiddenAt = 0

    function now() {
      return performance.now() - offset
    }

    model.readNow = now

    function styleNow() {
      return fillStyleRef.current === 'smooth' ? 'smooth' : 'retro'
    }

    function publish(time) {
      const counting = model.phase === 'counting' || model.phase === 'holding'
      const busy = model.phase === 'spinning' || model.phase === 'returning'
      const copied = counting && time < model.copiedUntil
      const next = {
        busy,
        counting,
        label: counting ? (copied ? 'copied' : 'copy') : 'create',
        glyphs: model.shown.slice(),
        announcement: model.announcement,
        description: model.description,
        status: model.status,
        codeText: model.codeText,
      }
      const previous = model.published
      const changed = Object.keys(next).some((key) => {
        if (key === 'glyphs') return next.glyphs.join('') !== previous.glyphs.join('')
        return next[key] !== previous[key]
      })
      if (!changed) return
      model.published = next
      if (!aliveRef.current) return
      flushSync(() => setView(next))
    }

    function sync(time) {
      publish(time)
      paint()
    }

    function applyPoses(time) {
      for (let index = 0; index < REEL_COUNT; index += 1) {
        const run = model.runs[index]
        if (!run) {
          const glyph = model.shown[index]
          model.poses[index] = { a: glyph, b: glyph, phase: 0 }
          continue
        }
        const pose = poseAt(time - model.motionStart, run)
        model.poses[index] = { a: pose.a, b: pose.b, phase: pose.phase }
        if (pose.done) model.shown[index] = pose.a
      }
    }

    function motionSettled(time) {
      if (model.reduced) return time - model.motionStart >= model.fadeMs
      applyPoses(time)
      return model.runs.every((run) => run == null || poseAt(time - model.motionStart, run).done)
    }

    function scheduleIdle(time) {
      model.runs = blankRuns()
      model.poses = staticPoses(model.shown)
      if (reducedMotion()) {
        model.nextIdle = Number.POSITIVE_INFINITY
        return
      }
      model.nextIdle = time + idleDelayMs((limit) => unbiasedBelow(limit, nextUint32))
    }

    function beginSpin(time) {
      model.phase = 'spinning'
      model.appliedStyle = styleNow()
      model.reduced = reducedMotion()
      model.from = model.shown.slice()
      model.next = randomDigits(nextByte)
      model.motionStart = time
      model.frameNow = time
      model.fadeMs = readFade()
      model.ease = readEase()
      model.motion = readMotion()
      model.copiedUntil = 0
      model.clip = FILL_EMPTY
      model.nextIdle = Number.POSITIVE_INFINITY
      model.codeText = 'Generating code'
      model.description = 'Generating a new code'
      model.status = ''
      if (model.reduced) {
        model.runs = blankRuns()
        model.poses = staticPoses(model.from)
        return
      }
      model.runs = model.from.map((glyph, index) => spinRun(glyph, model.next[index], index, model.motion, nextDigit))
      applyPoses(time)
    }

    function beginCount(time) {
      model.phase = 'counting'
      model.shown = model.next.slice()
      model.runs = blankRuns()
      model.poses = staticPoses(model.shown)
      model.appliedStyle = styleNow()
      model.cycleStart = time
      model.duration = cycleDurationMs(model.appliedStyle, countdownRef.current)
      model.hinted = false
      model.lastSecond = null
      model.copiedUntil = 0
      model.clip = FILL_EMPTY
      if (model.appliedStyle === 'retro') {
        model.schedule = makeSchedule(model.duration, (span) => unbiasedBelow(span, nextUint32))
      } else {
        model.schedule = []
      }
      const spoken = spokenCode(model.shown)
      const seconds = Math.max(0, Math.ceil(model.duration / 1000))
      model.lastSecond = seconds
      model.codeText = `Security code ${spoken}`
      model.announcement = `New code: ${spoken}`
      model.description = expiryText(seconds)
    }

    function beginReturn(time) {
      model.phase = 'returning'
      model.reduced = reducedMotion()
      model.from = model.shown.slice()
      model.motionStart = time
      model.frameNow = time
      model.fadeMs = readFade()
      model.ease = readEase()
      model.motion = readMotion()
      model.copiedUntil = 0
      model.clip = FILL_EMPTY
      model.codeText = 'No code yet'
      model.description = ''
      if (model.reduced) {
        model.runs = blankRuns()
        model.poses = staticPoses(model.from)
        return
      }
      model.runs = model.from.map((glyph, index) => returnRun(glyph, index, model.motion))
      applyPoses(time)
    }

    function finishReturn(time) {
      model.phase = 'resting'
      model.shown = REST_WORD.slice()
      model.runs = blankRuns()
      model.poses = staticPoses(model.shown)
      model.clip = FILL_EMPTY
      model.copiedUntil = 0
      model.codeText = 'No code yet'
      model.description = ''
      model.announcement = 'Code expired. Create code.'
      scheduleIdle(time)
    }

    function startBreath(time) {
      const index = unbiasedBelow(REEL_COUNT, nextUint32)
      model.motion = readMotion()
      model.motionStart = time
      model.frameNow = time
      model.reduced = false
      model.runs = blankRuns()
      model.runs[index] = {
        delay: 0,
        times: [0, model.motion.expressionSm],
        glyphs: [model.shown[index], model.shown[index]],
      }
      model.nextIdle = Number.POSITIVE_INFINITY
    }

    function advanceRest(time) {
      if (reducedMotion()) {
        model.runs = blankRuns()
        model.poses = staticPoses(model.shown)
        model.nextIdle = Number.POSITIVE_INFINITY
        return
      }
      if (model.runs.some(Boolean)) {
        if (motionSettled(time)) scheduleIdle(time)
        return
      }
      if (!Number.isFinite(model.nextIdle)) {
        scheduleIdle(time)
        return
      }
      if (time >= model.nextIdle) startBreath(time)
    }

    function noteSecond(time) {
      const remaining = model.cycleStart + model.duration - time
      const seconds = Math.max(0, Math.ceil(remaining / 1000))
      if (seconds === model.lastSecond) return
      model.lastSecond = seconds
      model.description = expiryText(seconds)
      const countdown = cycleDurationMs('smooth', countdownRef.current) / 1000
      if (seconds === 5 && model.appliedStyle === 'smooth' && countdown > 5 && !model.hinted) {
        model.hinted = true
        model.status = 'Code expires in 5 seconds'
      }
    }

    function advanceCount(time) {
      const elapsed = time - model.cycleStart
      if (model.appliedStyle === 'retro') {
        if (elapsed >= model.duration + RETRO_HOLD_MS) {
          beginReturn(time)
          return
        }
        model.clip = retroClip(percentAt(model.schedule, Math.max(0, elapsed)))
        if (elapsed >= model.duration) model.phase = 'holding'
      } else if (elapsed >= model.duration) {
        beginReturn(time)
        return
      } else {
        model.clip = smoothClip(model.duration > 0 ? elapsed / model.duration : 1)
      }
      noteSecond(time)
    }

    function step(time) {
      model.frameNow = time
      if (model.phase === 'resting') advanceRest(time)
      else if (model.phase === 'spinning') {
        if (motionSettled(time)) beginCount(time)
      } else if (model.phase === 'counting' || model.phase === 'holding') advanceCount(time)
      else if (model.phase === 'returning') {
        if (motionSettled(time)) finishReturn(time)
      }
      sync(time)
    }

    model.requestCreate = () => {
      if (model.phase !== 'resting') return
      beginSpin(now())
      sync(now())
    }

    function frame() {
      raf = 0
      if (!aliveRef.current || document.visibilityState === 'hidden') return
      step(now())
      if (aliveRef.current && document.visibilityState !== 'hidden') {
        raf = window.requestAnimationFrame(frame)
      }
    }

    function schedule() {
      if (!aliveRef.current || raf || document.visibilityState === 'hidden') return
      raf = window.requestAnimationFrame(frame)
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        if (!hiddenAt) hiddenAt = performance.now()
        if (raf) {
          window.cancelAnimationFrame(raf)
          raf = 0
        }
        return
      }
      if (hiddenAt) {
        offset += performance.now() - hiddenAt
        hiddenAt = 0
      }
      schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    schedule()
    return () => {
      aliveRef.current = false
      model.requestCreate = () => {}
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function onCopy() {
    const model = modelRef.current
    if (!model || (model.phase !== 'counting' && model.phase !== 'holding')) return
    const text = model.shown.join('')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      if (!aliveRef.current) return
      model.status = 'Copy failed'
      const next = { ...model.published, status: 'Copy failed' }
      model.published = next
      setView(next)
      return
    }
    if (!aliveRef.current) return
    const time = model.readNow()
    model.copiedUntil = time + COPIED_MS
    model.announcement = 'Copied'
    const next = { ...model.published, label: 'copied', announcement: 'Copied' }
    model.published = next
    setView(next)
  }

  function onActivate() {
    const model = modelRef.current
    if (!model || model.phase === 'spinning' || model.phase === 'returning') return
    if (model.phase === 'resting') {
      model.requestCreate()
      return
    }
    onCopy()
  }

  return (
    <section className="slot-code" aria-label="Security code" ref={rootRef}>
      <div className="slot-reels" aria-hidden="true">
        {view.glyphs.map((glyph, index) => (
          <div className="slot-reel" key={index} role="img" aria-label={String(glyph)}>
            <Flap kind="current" />
            <Flap kind="next" />
          </div>
        ))}
      </div>
      <p className="slot-code-sr">{view.codeText}</p>
      <div className="slot-code-sr" aria-live="polite" aria-atomic="true">
        {view.announcement}
      </div>
      <div className="slot-code-sr" role="status">
        {view.status}
      </div>
      <button
        type="button"
        className="slot-copy"
        aria-label={labelName(view.label)}
        aria-describedby={timeId}
        aria-disabled={view.busy ? 'true' : 'false'}
        onClick={onActivate}
      >
        <span className="slot-copy-visual">
          <ButtonFace label={view.label} />
          <span className="slot-copy-fill" ref={fillRef} aria-hidden="true">
            <ButtonFace label={view.label} />
          </span>
        </span>
      </button>
      <span className="slot-code-sr" id={timeId}>
        {view.description}
      </span>
    </section>
  )
}
