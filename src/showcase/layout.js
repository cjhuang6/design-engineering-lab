import { cssDurationMs } from '../components/hex-color-picker/model.js'

export const PANEL_VIEWPORT_FRACTION = 0.22
export const PANEL_MIN_OF_CONTENT = 0.4375
export const PANEL_MAX_OF_CONTENT = 0.53125
export const CARD_MIN_OF_CONTENT = 0.5
export const CARD_MAX_OF_CONTENT = 0.75
export const CARD_VIEWPORT_FRACTION = 0.36
export const CARD_HEIGHT_OF_CONTENT = 0.85
export const NARROW_CARD_HEIGHT = 0.46
export const MAX_COLUMNS = 3
export const MOBILE_BREAKPOINT_TOKEN = '--breakpoint-sm'

function clamp(min, value, max) {
  const lower = Math.min(min, max)
  const upper = Math.max(min, max)
  return Math.min(upper, Math.max(lower, value))
}

function lengthOf(style, name) {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

export function frameFromStyle(style) {
  return {
    space4: lengthOf(style, '--space-4'),
    space6: lengthOf(style, '--space-6'),
    space8: lengthOf(style, '--space-8'),
    space24: lengthOf(style, '--space-24'),
    contentSm: lengthOf(style, '--size-content-sm'),
    contentMd: lengthOf(style, '--size-content-md'),
    breakpointSm: lengthOf(style, MOBILE_BREAKPOINT_TOKEN),
  }
}

export function isMobileWidth(width, breakpoint) {
  return breakpoint > 0 && width < breakpoint
}

export function motionFromStyle(style) {
  const panelFrom = Number.parseFloat(style.getPropertyValue('--showcase-panel-scale-from'))
  const closeRate = Number.parseFloat(style.getPropertyValue('--showcase-close-rate'))
  return {
    card: cssDurationMs(style.getPropertyValue('--showcase-card-move')),
    panelDelay: cssDurationMs(style.getPropertyValue('--duration-fast')),
    panelDuration: cssDurationMs(style.getPropertyValue('--showcase-panel-duration')),
    panelFrom: Number.isFinite(panelFrom) ? panelFrom : 1,
    closeRate: Number.isFinite(closeRate) && closeRate > 0 ? closeRate : 1,
    ease: style.getPropertyValue('--ease-enter').trim(),
    fade: cssDurationMs(style.getPropertyValue('--duration-normal')),
  }
}

export function columnCount(available, gap, minWidth, maxColumns = MAX_COLUMNS) {
  if (!(available > 0) || !(minWidth > 0)) return 1
  const columns = Math.floor((available + gap) / (minWidth + gap))
  return Math.max(1, Math.min(maxColumns, columns))
}

export function feedColumnCount(viewportWidth, breakpoint, available, gap, minWidth, maxColumns = MAX_COLUMNS) {
  if (isMobileWidth(viewportWidth, breakpoint)) return 1
  return columnCount(available, gap, minWidth, maxColumns)
}

export function masonrySpan(height, gap, row = 1) {
  const unit = row > 0 ? row : 1
  return Math.max(1, Math.round((height + gap) / unit))
}

export function expandedFrame(viewport, tokens) {
  const gap = tokens.space4
  const pad = tokens.space8
  let panelW = clamp(
    tokens.contentSm * PANEL_MIN_OF_CONTENT,
    viewport.width * PANEL_VIEWPORT_FRACTION,
    tokens.contentSm * PANEL_MAX_OF_CONTENT,
  )
  let cardW = clamp(
    tokens.contentSm * CARD_MIN_OF_CONTENT,
    viewport.width * CARD_VIEWPORT_FRACTION,
    tokens.contentSm * CARD_MAX_OF_CONTENT,
  )
  const available = Math.max(0, viewport.width - pad * 2)
  if (cardW + gap + panelW > available) cardW = Math.max(0, available - gap - panelW)
  const cardH = Math.min(
    tokens.contentSm * CARD_HEIGHT_OF_CONTENT,
    Math.max(0, viewport.height - pad * 2),
  )
  const total = cardW + gap + panelW
  const x = Math.max(pad, (viewport.width - total) / 2)
  const y = Math.max(pad, (viewport.height - cardH) / 2)
  const card = { x: Math.round(x), y: Math.round(y), w: Math.round(cardW), h: Math.round(cardH) }
  return {
    axis: 'x',
    card,
    panel: { x: card.x + card.w + gap, y: card.y, w: Math.round(panelW), h: card.h },
  }
}

export function mobileFrame(viewport, tokens, safe = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const gap = tokens.space4
  const gutter = tokens.space4
  const top = (safe.top || 0) + gutter
  const bottom = (safe.bottom || 0) + gutter
  const left = (safe.left || 0) + gutter
  const right = (safe.right || 0) + gutter
  const width = Math.max(0, viewport.width - left - right)
  const usable = Math.max(0, viewport.height - top - bottom - gap)
  const cardH = Math.round(usable * NARROW_CARD_HEIGHT)
  const card = { x: Math.round(left), y: Math.round(top), w: Math.round(width), h: cardH }
  const panelY = card.y + card.h + gap
  return {
    axis: 'y',
    card,
    panel: {
      x: card.x,
      y: panelY,
      w: card.w,
      h: Math.max(0, Math.round(viewport.height - bottom - panelY)),
    },
  }
}

export function uniformScale(natural, inner) {
  if (!(natural.w > 0) || !(natural.h > 0) || !(inner.w > 0) || !(inner.h > 0)) return 1
  return Math.min(inner.w / natural.w, inner.h / natural.h)
}

export function rectAt(from, to, progress) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    w: from.w + (to.w - from.w) * progress,
    h: from.h + (to.h - from.h) * progress,
  }
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function easeAt(easing, amount) {
  if (amount <= 0) return 0
  if (amount >= 1) return 1
  const match = /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(
    easing,
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
  for (let step = 0; step < 30; step += 1) {
    const mid = (low + high) / 2
    if (bezierX(mid) < amount) low = mid
    else high = mid
  }
  return bezierY((low + high) / 2)
}

export function overlapWindow(from, to, panel, duration, easing) {
  if (!(duration > 0)) return null
  let first = null
  let last = null
  const steps = Math.max(1, Math.round(duration))
  for (let time = 0; time <= steps; time += 1) {
    const progress = easeAt(easing, time / steps)
    if (rectsOverlap(rectAt(from, to, progress), panel)) {
      if (first == null) first = time
      last = time
    }
  }
  if (first == null) return null
  return { first, last }
}

export function openPanelDelay(baseDelay, overlap) {
  if (!overlap) return baseDelay
  return Math.max(baseDelay, overlap.last + 1)
}

export function closeMotion(panelDelay, panelDuration, cardDuration, rate, overlap) {
  const safeRate = rate > 0 ? rate : 1
  const end = panelDelay + panelDuration
  const panelSpan = Math.round((end - panelDelay) * safeRate)
  const cardSpan = Math.round(cardDuration * safeRate)
  let cardDelay = Math.round(panelSpan * 0.6)
  if (overlap) cardDelay = Math.max(cardDelay, panelSpan - overlap.first)
  return {
    panelDuration: Math.round(panelDuration * safeRate),
    panelDelay: Math.round((end - panelDelay - panelDuration) * safeRate),
    cardDuration: cardSpan,
    cardDelay,
    scrimDuration: cardSpan,
    scrimDelay: cardDelay,
  }
}
