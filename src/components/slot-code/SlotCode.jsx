import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cssDurationMs } from '../hex-color-picker/model.js'
import {
  COPIED_MS,
  RETRO_HOLD_MS,
  cycleDurationMs,
  expiryText,
  makeSchedule,
  mod10,
  percentAt,
  plansFor,
  randomDigits,
  retroClip,
  smoothClip,
  smoothRemaining,
  spokenCode,
  unbiasedBelow,
  unitEase,
} from './model.js'
import './SlotCode.css'

const REELS = 6

const INITIAL_VIEW = {
  spinning: true,
  copied: false,
  digits: [0, 0, 0, 0, 0, 0],
  announcement: '',
  description: 'Generating a new code',
  status: '',
  codeText: 'Generating code',
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

function createModel() {
  return {
    phase: 'idle',
    appliedStyle: 'smooth',
    code: [0, 0, 0, 0, 0, 0],
    next: [0, 0, 0, 0, 0, 0],
    plans: [],
    poses: Array.from({ length: REELS }, () => ({ a: 0, b: 0, phase: 0 })),
    reduced: false,
    spinStart: 0,
    frameNow: 0,
    fadeMs: 200,
    ease: 'linear',
    cycleStart: 0,
    deadline: 0,
    duration: 0,
    schedule: [],
    hinted: false,
    lastSecond: null,
    copiedUntil: 0,
    clip: retroClip(0),
    readNow: () => performance.now(),
    announcement: '',
    description: 'Generating a new code',
    status: '',
    codeText: 'Generating code',
    published: { ...INITIAL_VIEW, digits: [0, 0, 0, 0, 0, 0] },
  }
}

function setFlap(flap, fromDigit, toDigit, phase) {
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
  topText.textContent = String(toDigit)
  botText.textContent = String(fromDigit)
  leafTopText.textContent = String(fromDigit)
  leafBotText.textContent = String(toDigit)
  const angle = -180 * phase * phase
  if (phase <= 0) {
    leafTop.style.visibility = 'hidden'
    leafBot.style.visibility = 'hidden'
    leafTop.style.transform = ''
    leafBot.style.transform = ''
    topShade.style.opacity = '0'
    botShade.style.opacity = '0'
    topText.textContent = String(fromDigit)
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

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CopyFace({ copied }) {
  return (
    <span className="slot-copy-face">
      <CopyIcon />
      <span className="slot-copy-label">
        <span hidden={copied}>Copy code</span>
        <span hidden={!copied}>Copied</span>
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

export const SLOT_CODE_DESCRIPTION =
  'Six split-flap reels show a 6-digit code drawn from crypto.getRandomValues. This is a demo, not a one-time password. The Copy code button fill is the countdown. Smooth is the default and drains across the selected duration. Retro jumps from empty to full across 3 seconds. The button does not show a percent or a seconds count.'

export function SlotCode({ fillStyle = 'smooth', countdownSeconds = 5 }) {
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
    const spinning = model.phase === 'spinning'
    const reels = root.querySelectorAll('.slot-reel')
    reels.forEach((reel, index) => {
      const current = reel.querySelector('.slot-flap-current')
      const incoming = reel.querySelector('.slot-flap-next')
      if (spinning && model.reduced) {
        setFlap(current, model.code[index], model.code[index], 0)
        setFlap(incoming, model.next[index], model.next[index], 0)
        const amount = model.fadeMs > 0 ? (model.frameNow - model.spinStart) / model.fadeMs : 1
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
      const spinning = model.phase !== 'counting' && model.phase !== 'holding'
      const copied = !spinning && time < model.copiedUntil
      const next = {
        spinning,
        copied,
        digits: model.code.slice(),
        announcement: model.announcement,
        description: model.description,
        status: model.status,
        codeText: model.codeText,
      }
      const previous = model.published
      const changed = Object.keys(next).some((key) => {
        if (key === 'digits') return next.digits.join('') !== previous.digits.join('')
        return next[key] !== previous[key]
      })
      if (!changed) return
      model.published = next
      if (!aliveRef.current) return
      flushSync(() => setView(next))
    }

    function beginSpin(time) {
      model.phase = 'spinning'
      model.appliedStyle = styleNow()
      model.reduced = reducedMotion()
      model.next = randomDigits(nextByte)
      model.spinStart = time
      model.frameNow = time
      model.copiedUntil = 0
      model.fadeMs = readFade()
      model.ease = readEase()
      if (!model.reduced) model.plans = plansFor(model.code, model.next)
      for (let index = 0; index < REELS; index += 1) {
        model.poses[index] = { a: model.code[index], b: model.code[index], phase: 0 }
      }
      model.codeText = 'Generating code'
      model.description = 'Generating a new code'
      model.status = ''
      model.lastSecond = null
    }

    function beginCount(time) {
      model.phase = 'counting'
      model.code = model.next.slice()
      model.appliedStyle = styleNow()
      model.cycleStart = time
      model.duration = cycleDurationMs(model.appliedStyle, countdownRef.current)
      model.deadline = time + model.duration
      model.hinted = false
      model.lastSecond = null
      model.copiedUntil = 0
      for (let index = 0; index < REELS; index += 1) {
        model.poses[index] = { a: model.code[index], b: model.code[index], phase: 0 }
      }
      if (model.appliedStyle === 'retro') {
        model.schedule = makeSchedule(model.duration, (span) => unbiasedBelow(span, nextUint32))
        model.clip = retroClip(0)
      } else {
        model.schedule = []
        model.clip = smoothClip(1)
      }
      const spoken = spokenCode(model.code)
      const seconds = Math.max(0, Math.ceil(model.duration / 1000))
      model.lastSecond = seconds
      model.codeText = `Security code ${spoken}`
      model.announcement = `New code: ${spoken}`
      model.description = expiryText(seconds)
    }

    function advanceSpin(time) {
      model.frameNow = time
      if (model.reduced) return time - model.spinStart >= model.fadeMs
      const elapsed = time - model.spinStart
      let settled = true
      for (let index = 0; index < REELS; index += 1) {
        const plan = model.plans[index]
        if (elapsed >= plan.lockAt) {
          model.poses[index] = { a: model.next[index], b: model.next[index], phase: 0 }
          continue
        }
        settled = false
        const into = elapsed - plan.delay
        if (into < 0) {
          model.poses[index] = { a: model.code[index], b: model.code[index], phase: 0 }
          continue
        }
        const step = Math.floor(into / plan.per)
        if (step >= plan.n) {
          model.poses[index] = { a: model.next[index], b: model.next[index], phase: 0 }
          continue
        }
        const from = mod10(model.code[index] + step)
        model.poses[index] = {
          a: from,
          b: mod10(from + 1),
          phase: (into - step * plan.per) / plan.per,
        }
      }
      return settled
    }

    function noteSecond(time) {
      if (model.phase !== 'counting' && model.phase !== 'holding') return
      const seconds = Math.max(0, Math.ceil((model.deadline - time) / 1000))
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
        model.clip = retroClip(percentAt(model.schedule, Math.max(0, elapsed)))
        if (elapsed >= model.duration + RETRO_HOLD_MS) {
          beginSpin(time)
          return
        }
        if (elapsed >= model.duration) model.phase = 'holding'
      } else if (time >= model.deadline) {
        model.clip = smoothClip(0)
        beginSpin(time)
        return
      } else {
        model.clip = smoothClip(smoothRemaining(time, model.deadline, model.duration))
      }
      noteSecond(time)
    }

    function step(time) {
      const style = styleNow()
      if (model.phase === 'idle' || model.appliedStyle !== style) beginSpin(time)
      if (model.phase === 'spinning') {
        if (advanceSpin(time)) beginCount(time)
      } else {
        advanceCount(time)
      }
      paint()
      publish(time)
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
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function onCopy() {
    const model = modelRef.current
    if (!model || (model.phase !== 'counting' && model.phase !== 'holding')) return
    const text = model.code.join('')
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
    model.status = 'Copied'
    const next = { ...model.published, copied: true, status: 'Copied' }
    model.published = next
    setView(next)
  }

  return (
    <section className="slot-code" aria-label="Security code" ref={rootRef}>
      <div className="slot-reels" aria-hidden={view.spinning ? true : undefined}>
        {view.digits.map((digit, index) => (
          <div className="slot-reel" key={index} role="img" aria-label={String(digit)}>
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
        aria-label="Copy code"
        aria-describedby={timeId}
        aria-disabled={view.spinning ? 'true' : 'false'}
        onClick={onCopy}
      >
        <span className="slot-copy-visual">
          <CopyFace copied={view.copied} />
          <span className="slot-copy-fill" ref={fillRef} aria-hidden="true">
            <CopyFace copied={view.copied} />
          </span>
        </span>
      </button>
      <span className="slot-code-sr" id={timeId}>
        {view.description}
      </span>
    </section>
  )
}
