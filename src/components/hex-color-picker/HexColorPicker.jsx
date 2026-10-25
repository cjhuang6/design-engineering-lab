import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildPalette,
  cellAtPoint,
  cssDurationMs,
  focusRingPoints,
  formatHex,
  layoutMetrics,
  moveSelection,
  pickMarkColor,
  placeCells,
  proximityFalloff,
} from './model.js'
import './HexColorPicker.css'

const CELLS = buildPalette()
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
const HAIRLINE_WIDTH = 100
const HAIRLINE_HEIGHT = (HAIRLINE_WIDTH * 2) / Math.sqrt(3)
const HAIRLINE_POINTS = [
  [HAIRLINE_WIDTH / 2, 0],
  [HAIRLINE_WIDTH, HAIRLINE_HEIGHT * 0.25],
  [HAIRLINE_WIDTH, HAIRLINE_HEIGHT * 0.75],
  [HAIRLINE_WIDTH / 2, HAIRLINE_HEIGHT],
  [0, HAIRLINE_HEIGHT * 0.75],
  [0, HAIRLINE_HEIGHT * 0.25],
]
  .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
  .join(' ')

function readNumber(element, name) {
  const raw = getComputedStyle(element).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

function readDuration(element, name) {
  return cssDurationMs(getComputedStyle(element).getPropertyValue(name))
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function knownToken(token) {
  return CELLS.some((cell) => cell.token === token) ? token : null
}

function applyEffect(node, effect, maxScale, darken, selected) {
  node.style.transform = effect ? `scale(${(1 + (maxScale - 1) * effect).toFixed(4)})` : ''
  const fill = node.querySelector('.hex-picker-fill')
  if (fill) fill.style.filter = effect && darken ? `brightness(${(1 - darken * effect).toFixed(4)})` : ''
  const boost = node.dataset.token === selected ? 200 : 0
  node.style.zIndex = String(1 + Math.round(effect * 100) + boost)
}

export function HexColorPicker({ value, defaultValue = null, onChange, label = 'Camellia color' }) {
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selectedToken = isControlled ? value : uncontrolled
  const knownSelected = knownToken(selectedToken)
  const labelId = useId()
  const rootRef = useRef(null)
  const gridRef = useRef(null)
  const effectsRef = useRef(new Map())
  const trackingRef = useRef(false)
  const pointerRef = useRef({ x: 0, y: 0 })
  const rectRef = useRef(null)
  const rafRef = useRef(0)
  const metricsRef = useRef(null)
  const placedRef = useRef(null)
  const selectedRef = useRef(knownSelected)
  const focusRef = useRef(null)
  const memoryRef = useRef({ colX: null, colId: null })
  const pressedRef = useRef(null)
  const pokeRef = useRef(() => {})
  const animationRef = useRef(null)
  const hexRef = useRef(null)
  const [metrics, setMetrics] = useState(null)
  const [pressedToken, setPressedToken] = useState(null)
  const [focusToken, setFocusToken] = useState(() => knownToken(value ?? defaultValue) ?? CELLS[0].token)
  const [trackedSelection, setTrackedSelection] = useState(knownSelected)

  if (knownSelected !== trackedSelection) {
    setTrackedSelection(knownSelected)
    if (knownSelected) setFocusToken(knownSelected)
  }

  const placed = useMemo(
    () => (metrics ? placeCells(CELLS, metrics.width, metrics.gap) : null),
    [metrics],
  )
  const placedByToken = useMemo(() => {
    const map = new Map()
    for (const cell of placed ?? CELLS) map.set(cell.token, cell)
    return map
  }, [placed])

  const ring = metrics
    ? {
        width: metrics.width + metrics.pad * 2,
        height: metrics.height + metrics.pad * 2,
        points: focusRingPoints(metrics.width, metrics.height, metrics.pad, metrics.outset),
      }
    : null

  function nodeFor(token) {
    return gridRef.current?.querySelector(`[data-token="${token}"]`) ?? null
  }

  function commit(token) {
    if (!knownToken(token)) return
    memoryRef.current = { colX: null, colId: null }
    setFocusToken(token)
    focusRef.current = token
    if (token === selectedRef.current) return
    if (!isControlled) {
      selectedRef.current = token
      setUncontrolled(token)
    }
    onChange?.(token)
  }

  function press(token) {
    if (!token || reducedMotion()) return
    pressedRef.current = token
    setPressedToken(token)
    const animation = animationRef.current
    if (animation) animation.pause()
  }

  function release() {
    if (pressedRef.current == null) return
    pressedRef.current = null
    setPressedToken(null)
    const animation = animationRef.current
    if (animation?.playState === 'paused') animation.play()
  }

  function scheduleFrame() {
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      const root = rootRef.current
      const cells = placedRef.current
      const rect = rectRef.current
      if (!root || !cells || !rect) return
      if (reducedMotion()) {
        trackingRef.current = false
        for (const cell of cells) {
          effectsRef.current.set(cell.token, 0)
          const node = nodeFor(cell.token)
          if (node) applyEffect(node, 0, 1, 0, selectedRef.current)
        }
        return
      }
      const radius = readNumber(root, '--hex-picker-radius')
      const maxScale = readNumber(root, '--hex-picker-scale-hover')
      const darken = readNumber(root, '--hex-picker-darken')
      const localX = pointerRef.current.x - rect.left
      const localY = pointerRef.current.y - rect.top
      for (const cell of cells) {
        let effect = 0
        if (trackingRef.current) {
          effect = proximityFalloff(Math.hypot(localX - cell.cx, localY - cell.cy), radius)
        }
        const previous = effectsRef.current.get(cell.token) ?? 0
        if (effect === previous || (effect && Math.abs(effect - previous) < 0.001)) continue
        effectsRef.current.set(cell.token, effect)
        const node = nodeFor(cell.token)
        if (node) applyEffect(node, effect, maxScale, darken, selectedRef.current)
      }
    })
  }

  function recache() {
    const grid = gridRef.current
    if (grid) rectRef.current = grid.getBoundingClientRect()
  }

  function hitTest(event) {
    const current = placedRef.current
    const size = metricsRef.current
    if (!current || !size) return null
    recache()
    const rect = rectRef.current
    return cellAtPoint(current, event.clientX - rect.left, event.clientY - rect.top, size.height)
  }

  function ignoredTarget(event) {
    return event.target instanceof Element && Boolean(event.target.closest('.hex-picker-readout, .hex-picker-label'))
  }

  function onPointerEnter() {
    pokeRef.current()
  }

  function onPointerMove(event) {
    pokeRef.current()
    if (event.pointerType === 'touch' || reducedMotion()) return
    const grid = gridRef.current
    if (!trackingRef.current && grid) grid.removeAttribute('data-settling')
    trackingRef.current = true
    pointerRef.current = { x: event.clientX, y: event.clientY }
    recache()
    scheduleFrame()
  }

  function onPointerLeave(event) {
    if (event.pointerType === 'touch') return
    trackingRef.current = false
    if (reducedMotion()) gridRef.current?.removeAttribute('data-settling')
    else gridRef.current?.setAttribute('data-settling', '')
    scheduleFrame()
  }

  function onPointerDown(event) {
    if (ignoredTarget(event)) return
    pokeRef.current()
    const hit = hitTest(event)
    if (hit) press(hit.token)
  }

  function onClick(event) {
    if (event.detail === 0 || ignoredTarget(event)) return
    const hit = hitTest(event)
    if (hit) commit(hit.token)
  }

  function onKeyDown(event) {
    const current = focusRef.current
    if (!current) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pokeRef.current()
      if (!event.repeat) press(current)
      return
    }
    if (!NAV_KEYS.has(event.key)) return
    event.preventDefault()
    const size = metricsRef.current
    const positions = placedRef.current
    if (!size || !positions) return
    pokeRef.current()
    release()
    const step = moveSelection(positions, current, event.key, memoryRef.current, size.pitchX)
    commit(step.token)
    memoryRef.current = step.memory
    nodeFor(step.token)?.focus({ preventScroll: true })
  }

  function onKeyUp(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const current = focusRef.current
    release()
    if (current) commit(current)
  }

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    function measure() {
      const sample = grid.querySelector('.hex-picker-cell')
      if (!sample) return
      const width = sample.offsetWidth
      const root = document.documentElement
      const gap = readNumber(root, '--space-1')
      const pad = readNumber(root, '--space-3')
      const outset = readNumber(root, '--space-2')
      if (width <= 0) return
      setMetrics((current) => {
        if (
          current &&
          current.width === width &&
          current.gap === gap &&
          current.pad === pad &&
          current.outset === outset
        ) {
          return current
        }
        return { ...layoutMetrics(width, gap), pad, outset }
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    const sample = grid.querySelector('.hex-picker-cell')
    if (sample) observer.observe(sample)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    selectedRef.current = knownSelected
    placedRef.current = placed
    metricsRef.current = metrics
    focusRef.current = focusToken
    const rootStyle = getComputedStyle(document.documentElement)
    const white = rootStyle.getPropertyValue('--color-base-white')
    const dark = rootStyle.getPropertyValue('--color-primitive-ice-900')
    const maxScale = rootRef.current ? readNumber(rootRef.current, '--hex-picker-scale-hover') : 1
    const darken = rootRef.current ? readNumber(rootRef.current, '--hex-picker-darken') : 0
    const reduced = reducedMotion()
    let nextHex = ''
    for (const cell of CELLS) {
      const node = nodeFor(cell.token)
      if (!node) continue
      const fill = node.querySelector('.hex-picker-fill')
      const mark = node.querySelector('.hex-picker-mark')
      if (fill && mark) {
        const painted = getComputedStyle(fill).backgroundColor
        const choice = pickMarkColor(painted, white, dark)
        mark.style.backgroundColor = choice === 'white' ? 'var(--color-base-white)' : 'var(--color-primitive-ice-900)'
        if (cell.token === knownSelected) nextHex = formatHex(painted)
      }
      const effect = reduced ? 0 : (effectsRef.current.get(cell.token) ?? 0)
      applyEffect(node, effect, maxScale, darken, knownSelected)
    }
    if (hexRef.current && hexRef.current.textContent !== nextHex) hexRef.current.textContent = nextHex
  }, [knownSelected, placed, metrics, focusToken])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !knownSelected) {
      pokeRef.current = () => {}
      return undefined
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer = 0
    let animation = null
    let phase = 'off'

    function stop() {
      window.clearTimeout(timer)
      timer = 0
      if (animation) {
        const current = animation
        animation = null
        animationRef.current = null
        current.cancel()
      }
    }

    function loopsFor() {
      const duration = readDuration(root, '--hex-picker-duration-idle')
      const span = readDuration(root, '--hex-picker-duration-autostop')
      if (!(duration > 0)) return 1
      return Math.max(1, Math.round(span / duration))
    }

    function start() {
      timer = 0
      if (media.matches) {
        phase = 'off'
        return
      }
      const motion = root.querySelector('[data-selected-motion]')
      const duration = readDuration(root, '--hex-picker-duration-idle')
      const peak = readNumber(root, '--hex-picker-scale-idle')
      const easing = getComputedStyle(root).getPropertyValue('--hex-picker-ease-sine').trim()
      if (!motion || !(duration > 0) || !(peak > 0) || !easing) return
      const next = motion.animate(
        [
          { transform: 'scale(1)', easing, offset: 0 },
          { transform: `scale(${peak})`, easing, offset: 0.5 },
          { transform: 'scale(1)', offset: 1 },
        ],
        { duration, iterations: loopsFor() },
      )
      animation = next
      animationRef.current = next
      phase = 'playing'
      if (pressedRef.current) next.pause()
      next.finished.then(
        () => {
          if (animation !== next) return
          animation = null
          animationRef.current = null
          phase = 'stopped'
        },
        () => {},
      )
    }

    function schedule(delay) {
      stop()
      if (media.matches) {
        phase = 'off'
        return
      }
      phase = 'waiting'
      timer = window.setTimeout(start, delay)
    }

    function poke() {
      if (media.matches) return
      if (phase === 'stopped') {
        schedule(readDuration(root, '--hex-picker-delay-idle') / 2)
        return
      }
      if (animation && phase === 'playing') {
        const current = animation.effect.getComputedTiming().currentIteration || 0
        animation.effect.updateTiming({ iterations: Number(current) + loopsFor() })
      }
    }

    pokeRef.current = poke
    schedule(readDuration(root, '--hex-picker-duration-grow') + readDuration(root, '--hex-picker-delay-idle'))
    function onMedia() {
      if (media.matches) stop()
      else schedule(readDuration(root, '--hex-picker-delay-idle'))
    }
    media.addEventListener('change', onMedia)
    return () => {
      pokeRef.current = () => {}
      media.removeEventListener('change', onMedia)
      stop()
    }
  }, [knownSelected])

  useEffect(() => {
    function clearPress() {
      if (pressedRef.current == null) return
      pressedRef.current = null
      setPressedToken(null)
      const animation = animationRef.current
      if (animation?.playState === 'paused') animation.play()
    }
    function recacheRect() {
      const grid = gridRef.current
      if (grid) rectRef.current = grid.getBoundingClientRect()
    }
    function onMotionChange(event) {
      if (!event.matches) return
      trackingRef.current = false
      gridRef.current?.removeAttribute('data-settling')
      for (const node of gridRef.current?.querySelectorAll('.hex-picker-cell') ?? []) {
        applyEffect(node, 0, 1, 0, selectedRef.current)
      }
      effectsRef.current.clear()
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    window.addEventListener('pointerup', clearPress)
    window.addEventListener('pointercancel', clearPress)
    window.addEventListener('blur', clearPress)
    window.addEventListener('resize', recacheRect)
    window.addEventListener('scroll', recacheRect, true)
    media.addEventListener('change', onMotionChange)
    return () => {
      window.removeEventListener('pointerup', clearPress)
      window.removeEventListener('pointercancel', clearPress)
      window.removeEventListener('blur', clearPress)
      window.removeEventListener('resize', recacheRect)
      window.removeEventListener('scroll', recacheRect, true)
      media.removeEventListener('change', onMotionChange)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const selectedCell = knownSelected ? placedByToken.get(knownSelected) : null

  return (
    <div
      className="hex-color-picker"
      ref={rootRef}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <p id={labelId} className="hex-picker-label">
        {label}
      </p>
      <div
        className="hex-picker-grid"
        ref={gridRef}
        role="radiogroup"
        aria-labelledby={labelId}
        style={metrics ? { width: metrics.gridWidth, height: metrics.gridHeight } : undefined}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        {CELLS.map((cell) => {
          const position = placedByToken.get(cell.token)
          const style = metrics
            ? { left: position.x, top: position.y, width: metrics.width, height: metrics.height }
            : undefined
          return (
            <button
              key={cell.token}
              type="button"
              role="radio"
              className="hex-picker-cell"
              data-token={cell.token}
              data-pressed={cell.token === pressedToken ? '' : undefined}
              aria-checked={cell.token === knownSelected}
              aria-label={cell.label}
              tabIndex={cell.token === focusToken ? 0 : -1}
              style={style}
            >
              <span className="hex-picker-body">
                <span className="hex-picker-fill" style={{ background: `var(${cell.cssVar})` }} />
                {cell.token === 'color.base.white' ? (
                  <svg
                    className="hex-picker-hairline"
                    viewBox={`0 0 ${HAIRLINE_WIDTH} ${HAIRLINE_HEIGHT.toFixed(3)}`}
                    aria-hidden="true"
                  >
                    <polygon points={HAIRLINE_POINTS} />
                  </svg>
                ) : null}
                <span
                  className="hex-picker-motion"
                  data-selected-motion={cell.token === knownSelected ? '' : undefined}
                >
                  <span className="hex-picker-mark" />
                </span>
                {ring ? (
                  <svg
                    className="hex-picker-rings"
                    aria-hidden="true"
                    viewBox={`0 0 ${ring.width} ${ring.height}`}
                    style={{ left: -metrics.pad, top: -metrics.pad, width: ring.width, height: ring.height }}
                  >
                    <polygon className="hex-picker-focus" points={ring.points} />
                  </svg>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      <div className="hex-picker-readout">
        <div
          className="swatch"
          style={{ background: selectedCell ? `var(${selectedCell.cssVar})` : 'var(--color-surface-secondary)' }}
          aria-hidden="true"
        />
        <div className="hex-picker-meta">
          <p className="hex-picker-name">{selectedCell ? selectedCell.label : 'No color selected'}</p>
          {selectedCell ? <code className="hex-picker-token">{selectedCell.token}</code> : null}
          <code className="hex-picker-hex" ref={hexRef} />
        </div>
      </div>
    </div>
  )
}

export function HexColorPickerDemo() {
  const [value, setValue] = useState('color.primitive.blue.600')
  return (
    <section className="section" aria-labelledby="color-picker-title">
      <h2 id="color-picker-title">Color picker</h2>
      <p className="note">
        Cells near the pointer grow and darken. Choose a color with a click or the arrow keys.
      </p>
      <div className="hex-picker-demo">
        <HexColorPicker value={value} onChange={setValue} />
      </div>
    </section>
  )
}
