import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildPalette,
  cellAtPoint,
  cssDurationMs,
  draggedSliderValue,
  focusRingPoints,
  formatHex,
  layoutMetrics,
  moveSelection,
  pickMarkColor,
  placeCells,
  proximityFalloff,
  proximityPaint,
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

function scaleFromTransform(transform) {
  if (!transform || transform === 'none') return 1
  const open = transform.indexOf('(')
  if (open < 0) return 1
  const parts = transform.slice(open + 1, -1).split(',')
  const a = Number.parseFloat(parts[0])
  const b = Number.parseFloat(parts[1])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  return Math.hypot(a, b)
}

function knownToken(token) {
  return CELLS.some((cell) => cell.token === token) ? token : null
}

function applyEffect(node, effect, maxScale, darken, selected) {
  const paint = proximityPaint(effect, maxScale, darken)
  node.style.transform = paint.transform
  const fill = node.querySelector('.hex-picker-fill')
  if (fill) fill.style.filter = paint.filter
  const boost = node.dataset.token === selected ? 200 : 0
  node.style.zIndex = String(1 + Math.round(effect * 100) + boost)
}

export function HexColorPicker({
  value,
  defaultValue = null,
  onChange,
  label = 'Camellia color',
  radius,
  scaleHover,
  darken,
}) {
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selectedToken = isControlled ? value : uncontrolled
  const knownSelected = knownToken(selectedToken)
  const labelId = useId()
  const rootRef = useRef(null)
  const gridRef = useRef(null)
  const effectsRef = useRef(new Map())
  const lookRef = useRef('')
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
  const layerTimerRef = useRef(0)
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

  function paintProximity() {
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
      lookRef.current = ''
      return
    }
    const radius = readNumber(root, '--hex-picker-radius')
    const maxScale = readNumber(root, '--hex-picker-scale-hover')
    const darken = readNumber(root, '--hex-picker-darken')
    const lookKey = `${maxScale}:${darken}`
    let localX = 0
    let localY = 0
    if (trackingRef.current) {
      const local = layoutPoint(pointerRef.current.x, pointerRef.current.y)
      if (!local) return
      localX = local.x
      localY = local.y
    }
    for (const cell of cells) {
      let effect = 0
      if (trackingRef.current) {
        effect = proximityFalloff(Math.hypot(localX - cell.cx, localY - cell.cy), radius)
      }
      const previous = effectsRef.current.get(cell.token) ?? 0
      const sameEffect = effect === previous || (effect && Math.abs(effect - previous) < 0.001)
      if (sameEffect && lookRef.current === lookKey) continue
      effectsRef.current.set(cell.token, effect)
      const node = nodeFor(cell.token)
      if (node) applyEffect(node, effect, maxScale, darken, selectedRef.current)
    }
    lookRef.current = lookKey
  }

  function scheduleFrame() {
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      paintProximity()
    })
  }

  function recache() {
    const grid = gridRef.current
    if (grid) rectRef.current = grid.getBoundingClientRect()
  }

  function layoutPoint(clientX, clientY) {
    const rect = rectRef.current
    const size = metricsRef.current
    if (!rect || !size || !(size.gridWidth > 0) || !(size.gridHeight > 0)) return null
    const scaleX = rect.width / size.gridWidth
    const scaleY = rect.height / size.gridHeight
    if (!(scaleX > 0) || !(scaleY > 0)) return null
    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    }
  }

  function hitTest(event) {
    const current = placedRef.current
    const size = metricsRef.current
    if (!current || !size) return null
    recache()
    const local = layoutPoint(event.clientX, event.clientY)
    if (!local) return null
    return cellAtPoint(current, local.x, local.y, size.height)
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
    window.clearTimeout(layerTimerRef.current)
    if (!trackingRef.current && grid) {
      grid.removeAttribute('data-settling')
      grid.setAttribute('data-layer', '')
    }
    trackingRef.current = true
    pointerRef.current = { x: event.clientX, y: event.clientY }
    recache()
    scheduleFrame()
  }

  function onPointerLeave(event) {
    if (event.pointerType === 'touch') return
    trackingRef.current = false
    const grid = gridRef.current
    if (reducedMotion()) {
      window.clearTimeout(layerTimerRef.current)
      grid?.removeAttribute('data-settling')
      grid?.removeAttribute('data-layer')
    } else if (grid) {
      grid.setAttribute('data-settling', '')
      const duration = rootRef.current ? readDuration(rootRef.current, '--duration-fast') : 0
      window.clearTimeout(layerTimerRef.current)
      layerTimerRef.current = window.setTimeout(() => {
        if (!trackingRef.current) grid.removeAttribute('data-layer')
      }, duration + 50)
    }
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
    if (hexRef.current) {
      if (hexRef.current.textContent !== nextHex) hexRef.current.textContent = nextHex
      if (hexRef.current.title !== nextHex) hexRef.current.title = nextHex
    }
  }, [knownSelected, placed, metrics, focusToken])

  useLayoutEffect(() => {
    paintProximity()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the custom properties written for these controls
  }, [radius, scaleHover, darken])

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
    let wave = 0

    function stop(mode = 'cancel') {
      window.clearTimeout(timer)
      timer = 0
      wave += 1
      const current = animation
      if (!current) return Promise.resolve()
      const target = current.effect?.target
      const motion = target instanceof Element ? target : null
      const active = current.playState === 'running' || current.playState === 'paused'
      const from = motion ? getComputedStyle(motion).transform : 'none'
      const ease = mode === 'ease' && motion && active && Math.abs(scaleFromTransform(from) - 1) > 0.001
      if (ease) motion.style.transform = from
      else if (motion) motion.style.transform = ''
      animation = null
      animationRef.current = null
      current.cancel()
      if (!ease) return Promise.resolve()
      const easing = getComputedStyle(root).getPropertyValue('--ease-standard').trim()
      const duration = readDuration(root, '--duration-normal')
      const next = motion.animate(
        [{ transform: from }, { transform: 'scale(1)' }],
        {
          duration: duration > 0 ? duration : 200,
          easing: easing || 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards',
        },
      )
      animation = next
      animationRef.current = next
      if (pressedRef.current) next.pause()
      return next.finished.then(
        () => {
          if (animation !== next) return
          motion.style.transform = ''
          animation = null
          animationRef.current = null
          next.cancel()
        },
        () => {},
      )
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
      motion.style.transform = ''
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
      const handoff = stop('ease')
      const ticket = wave
      if (media.matches) {
        phase = 'off'
        return
      }
      phase = 'waiting'
      handoff.then(() => {
        if (ticket !== wave || phase !== 'waiting' || media.matches) return
        timer = window.setTimeout(start, delay)
      })
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
      if (media.matches) {
        phase = 'off'
        void stop('ease')
      } else schedule(readDuration(root, '--hex-picker-delay-idle'))
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
      window.clearTimeout(layerTimerRef.current)
      gridRef.current?.removeAttribute('data-settling')
      gridRef.current?.removeAttribute('data-layer')
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
      window.clearTimeout(layerTimerRef.current)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const selectedCell = knownSelected ? placedByToken.get(knownSelected) : null
  const tuningStyle = {}
  if (radius != null) tuningStyle['--hex-picker-radius'] = `${radius}px`
  if (scaleHover != null) tuningStyle['--hex-picker-scale-hover'] = String(scaleHover)
  if (darken != null) tuningStyle['--hex-picker-darken'] = String(darken)

  return (
    <div
      className="hex-color-picker"
      ref={rootRef}
      style={tuningStyle}
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
          <p className="hex-picker-name" title={selectedCell ? selectedCell.label : 'No color selected'}>
            {selectedCell ? selectedCell.label : 'No color selected'}
          </p>
          {selectedCell ? (
            <code className="hex-picker-token" title={selectedCell.token}>
              {selectedCell.token}
            </code>
          ) : null}
          <code className="hex-picker-hex" ref={hexRef} />
        </div>
      </div>
    </div>
  )
}

export const RADIUS_DEFAULT = 80
export const SCALE_DEFAULT = 1.15
export const DARKEN_DEFAULT = 0
export const PICKER_DESCRIPTION =
  "A honeycomb of Camellia's solid color tokens. Cells near the pointer grow as it passes, and the selected color breathes gently until you move on. Use the controls to tune how far the effect reaches, how much cells grow, and whether they darken."

const TOUCH_DRAG_SLOP = 6

function controlFill(value, min, max) {
  if (!(max > min)) return '0%'
  const amount = (Number(value) - min) / (max - min)
  return `${Math.min(1, Math.max(0, amount)) * 100}%`
}

function ControlSlider({ label, min, max, step, value, display, onChange }) {
  const id = useId()
  const drag = useRef(null)

  function onPointerDown(event) {
    if (event.pointerType !== 'touch') return
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      value: Number(value),
      active: false,
    }
  }

  function onPointerMove(event) {
    const current = drag.current
    if (!current || event.pointerId !== current.id) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.active) {
      if (Math.abs(dx) < TOUCH_DRAG_SLOP || Math.abs(dx) < Math.abs(dy)) return
      current.active = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.currentTarget.querySelector('input')?.focus({ preventScroll: true })
    }
    onChange(draggedSliderValue(current.value, dx, event.currentTarget.clientWidth, min, max, step))
  }

  function onPointerEnd(event) {
    const current = drag.current
    if (!current || event.pointerId !== current.id) return
    drag.current = null
  }

  return (
    <div
      className="hex-picker-slider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className="hex-picker-slider-fill" style={{ width: controlFill(value, min, max) }} aria-hidden="true" />
      <label className="hex-picker-slider-label" htmlFor={id}>
        {label}
      </label>
      <span className="hex-picker-slider-value" aria-hidden="true">
        {display}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
    </div>
  )
}

export function HexPickerControls({ radius, scaleHover, darken, onRadius, onScale, onDarken, onReset }) {
  const headingId = useId()
  return (
    <div className="hex-picker-controls">
      <div className="hex-picker-controls-head">
        <h4 id={headingId}>Controls</h4>
        <button type="button" className="hex-picker-reset" aria-label="Reset controls" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="hex-picker-controls-list" data-showcase-scroll="" role="group" aria-labelledby={headingId}>
        <ControlSlider
          label="Radius"
          min={40}
          max={160}
          step={1}
          value={radius}
          display={`${Math.round(radius)}px`}
          onChange={onRadius}
        />
        <ControlSlider
          label="Scale"
          min={1}
          max={1.4}
          step={0.01}
          value={scaleHover}
          display={`${scaleHover.toFixed(2)}×`}
          onChange={onScale}
        />
        <ControlSlider
          label="Darken"
          min={0}
          max={0.3}
          step={0.01}
          value={darken}
          display={darken.toFixed(2)}
          onChange={onDarken}
        />
      </div>
    </div>
  )
}
