export const REEL_COUNT = 6
export const LOCK_BASE_MS = 1400
export const LOCK_STAGGER_MS = 150
export const FLIP_SPEED = 16
export const RETRO_MS = 3000
export const RETRO_HOLD_MS = 120
export const COPIED_MS = 1200
export const COUNTDOWN_MIN = 3
export const COUNTDOWN_MAX = 30
export const COUNTDOWN_DEFAULT = 5

export function mod10(value) {
  return ((value % 10) + 10) % 10
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

export function reelLockMs(index) {
  return LOCK_BASE_MS + index * LOCK_STAGGER_MS
}

// Demo only. Digits come from crypto.getRandomValues, not from a one-time password.
export function randomDigits(nextByte) {
  const digits = []
  while (digits.length < REEL_COUNT) {
    const value = nextByte()
    if (value < 250) digits.push(value % 10)
  }
  return digits
}

export function spokenCode(digits) {
  return digits.join(' ')
}

export function flapPlan(current, finalDigit, durMs, speed = FLIP_SPEED) {
  const period = Math.max(55, 1150 / speed)
  const need = mod10(finalDigit - current)
  let count = Math.floor(durMs / (period * 0.8))
  while (mod10(count) !== need) count -= 1
  if (count < 1) count += 10
  const per = Math.min(period * 1.25, durMs / count)
  return {
    n: count,
    per,
    delay: Math.max(0, durMs - count * per),
    lockAt: durMs,
  }
}

export function plansFor(current, next, speed = FLIP_SPEED) {
  return next.map((digit, index) => flapPlan(current[index], digit, reelLockMs(index), speed))
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

export function smoothClip(remaining) {
  return `inset(0 0 0 ${((1 - remaining) * 100).toFixed(3)}%)`
}

export function expiryText(seconds) {
  const count = Math.max(0, seconds)
  return `Code expires in ${count} second${count === 1 ? '' : 's'}`
}
