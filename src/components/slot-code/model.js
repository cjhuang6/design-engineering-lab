export const REEL_COUNT = 6
export const REST_WORD = ['H', 'E', 'L', 'L', 'O', '!']
export const REST_FLIPS = 3
export const SPIN_FLIPS_BASE = 9
export const EASE_OUT_POWER = 1.9
export const RETRO_MS = 3000
export const RETRO_HOLD_MS = 120
export const COPIED_MS = 1200
export const COUNTDOWN_MIN = 3
export const COUNTDOWN_MAX = 30
export const COUNTDOWN_DEFAULT = 30
export const IDLE_MIN_MS = 2500
export const IDLE_MAX_MS = 5000
export const FILL_EMPTY = 'inset(0 100% 0 0)'
export const MOTION_FALLBACK = {
  fast: 100,
  normal: 200,
  expressionSm: 400,
  expressionMd: 600,
}

const GLYPH_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!'

export function mod10(value) {
  return ((value % 10) + 10) % 10
}

export function motionFromCss(readMs) {
  const pick = (name, fallback) => {
    const value = readMs(name)
    return value > 0 ? value : fallback
  }
  return {
    fast: pick('--duration-fast', MOTION_FALLBACK.fast),
    normal: pick('--duration-normal', MOTION_FALLBACK.normal),
    expressionSm: pick('--duration-expression-sm', MOTION_FALLBACK.expressionSm),
    expressionMd: pick('--duration-expression-md', MOTION_FALLBACK.expressionMd),
  }
}

export function easeOutUnit(amount) {
  const unit = Math.min(1, Math.max(0, amount))
  return unit ** EASE_OUT_POWER
}

export function reelMotion(index, motion, kind) {
  if (kind === 'return') {
    const per = motion.normal
    const stagger = (motion.normal * 7) / 10
    const delay = index * stagger
    const times = Array.from({ length: REST_FLIPS + 1 }, (_, step) => step * per)
    return { delay, times, flips: REST_FLIPS, end: delay + REST_FLIPS * per }
  }
  const stagger = motion.fast / 2
  const duration = motion.expressionMd - stagger + index * stagger
  const flips = SPIN_FLIPS_BASE + index
  const times = Array.from({ length: flips + 1 }, (_, step) => duration * easeOutUnit(step / flips))
  return { delay: 0, times, flips, end: duration }
}

export function precedingGlyph(glyph, stepsBack) {
  const index = GLYPH_ORDER.indexOf(glyph)
  if (index < 0) return glyph
  const size = GLYPH_ORDER.length
  return GLYPH_ORDER[(index - stepsBack + size) % size]
}

export function restSequence(glyph) {
  const sequence = []
  for (let back = REST_FLIPS - 1; back > 0; back -= 1) sequence.push(precedingGlyph(glyph, back))
  sequence.push(glyph)
  return sequence
}

export function spinRun(from, to, index, motion, nextDigit) {
  const plan = reelMotion(index, motion, 'spin')
  const sequence = []
  for (let step = 0; step < plan.flips - 1; step += 1) sequence.push(nextDigit())
  sequence.push(to)
  return { delay: plan.delay, times: plan.times, glyphs: [from, ...sequence] }
}

export function returnRun(from, index, motion) {
  const plan = reelMotion(index, motion, 'return')
  return { delay: plan.delay, times: plan.times, glyphs: [from, ...restSequence(REST_WORD[index])] }
}

export function poseAt(elapsed, run) {
  const into = elapsed - run.delay
  const start = run.glyphs[0]
  const landed = run.glyphs[run.glyphs.length - 1]
  if (into < 0) return { a: start, b: start, phase: 0, done: false }
  const end = run.times[run.times.length - 1]
  if (into >= end) return { a: landed, b: landed, phase: 0, done: true }
  let step = 0
  while (into >= run.times[step + 1]) step += 1
  const span = run.times[step + 1] - run.times[step]
  const phase = span > 0 ? (into - run.times[step]) / span : 1
  return { a: run.glyphs[step], b: run.glyphs[step + 1], phase, done: false }
}

export function idleDelayMs(nextBelow) {
  return IDLE_MIN_MS + nextBelow(IDLE_MAX_MS - IDLE_MIN_MS + 1)
}

export function clampCountdown(seconds) {
  const value = Math.round(Number(seconds))
  if (!Number.isFinite(value)) return COUNTDOWN_DEFAULT
  return Math.min(COUNTDOWN_MAX, Math.max(COUNTDOWN_MIN, value))
}

export function cycleDurationMs(fillStyle, countdownSeconds) {
  if (fillStyle !== 'smooth') return RETRO_MS
  return clampCountdown(countdownSeconds) * 1000
}

// Demo only. Digits come from crypto.getRandomValues, not from a one-time password.
export function randomDigits(nextByte) {
  const digits = []
  while (digits.length < REEL_COUNT) {
    const value = nextByte()
    if (value < 250) digits.push(String(value % 10))
  }
  return digits
}

export function spokenCode(digits) {
  return digits.join(' ')
}

export function unbiasedBelow(span, nextUint32) {
  const limit = Math.floor(0x100000000 / span) * span
  let value = nextUint32() >>> 0
  while (value >= limit) value = nextUint32() >>> 0
  return value % span
}

export function makeSchedule(durationMs, nextInt) {
  const between = (min, max) => min + nextInt(max - min + 1)
  for (let tries = 0; tries < 500; tries += 1) {
    const count = between(6, 10)
    const percents = []
    let percent = 0
    for (let index = 0; index < count - 1; index += 1) {
      const roll = nextInt(100)
      if (roll < 30) percent += between(1, 2)
      else if (roll < 55) percent += between(25, 40)
      else percent += between(3, 14)
      percents.push(percent)
    }
    percents.push(100)
    if (percents[count - 2] >= 100) continue
    const jumps = percents.map((value, index) => value - (index ? percents[index - 1] : 0))
    if (!jumps.some((jump) => jump >= 25) || !jumps.some((jump) => jump <= 2) || jumps.some((jump) => jump < 1)) {
      continue
    }
    const stallAt = []
    for (let index = 0; index < count - 1; index += 1) {
      if (percents[index] >= 60) stallAt.push(index)
    }
    if (stallAt.length === 0) continue
    const stallIndex = stallAt[nextInt(stallAt.length)]
    const first = between(40, 150)
    const stall = between(420, 700)
    const rest = durationMs - first - stall
    const gaps = count - 2
    const minGap = 50
    if (rest < gaps * minGap) continue
    const weights = Array.from({ length: gaps }, () => between(1, 10))
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
    const times = [first]
    let weightIndex = 0
    for (let index = 1; index < count; index += 1) {
      const gap =
        index - 1 === stallIndex
          ? stall
          : minGap + ((rest - gaps * minGap) * weights[weightIndex]) / weightSum
      if (index - 1 !== stallIndex) weightIndex += 1
      times.push(times[index - 1] + gap)
    }
    times[count - 1] = durationMs
    return percents.map((value, index) => ({ t: Math.round(times[index] * 10) / 10, p: value }))
  }
  return [
    { t: 100, p: 10 },
    { t: 400, p: 11 },
    { t: 900, p: 56 },
    { t: 1400, p: 68 },
    { t: 1900, p: 88 },
    { t: 2500, p: 90 },
    { t: durationMs, p: 100 },
  ]
}

export function percentAt(schedule, elapsed) {
  let percent = 0
  for (const step of schedule) {
    if (elapsed >= step.t) percent = step.p
    else break
  }
  return percent
}

export function smoothRemaining(now, deadline, durationMs) {
  if (!(durationMs > 0)) return 0
  return Math.min(1, Math.max(0, (deadline - now) / durationMs))
}

export function unitEase(easing, amount) {
  if (amount <= 0) return 0
  if (amount >= 1) return 1
  const match = /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(
    easing || '',
  )
  if (!match) return amount
  const x1 = Number(match[1])
  const y1 = Number(match[2])
  const x2 = Number(match[3])
  const y2 = Number(match[4])
  const bezierX = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
  const bezierY = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
  let low = 0
  let high = 1
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2
    if (bezierX(mid) < amount) low = mid
    else high = mid
  }
  return bezierY((low + high) / 2)
}

export function retroClip(percent) {
  return `inset(0 ${100 - percent}% 0 0)`
}

export function smoothClip(progress) {
  const clamped = Math.min(1, Math.max(0, progress))
  if (clamped <= 0) return FILL_EMPTY
  const right = (1 - clamped) * 100
  if (right <= 0) return 'inset(0 0% 0 0)'
  return `inset(0 ${right.toFixed(3)}% 0 0)`
}

export function expiryText(seconds) {
  const count = Math.max(0, seconds)
  return `Code expires in ${count} second${count === 1 ? '' : 's'}`
}
