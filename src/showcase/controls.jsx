import { useId, useRef } from 'react'
import { draggedSliderValue } from '../components/hex-color-picker/model.js'

const TOUCH_DRAG_SLOP = 6

function controlFill(value, min, max) {
  if (!(max > min)) return '0%'
  const amount = (Number(value) - min) / (max - min)
  return `${Math.min(1, Math.max(0, amount)) * 100}%`
}

export function SegmentedControl({ label, value, options, onChange }) {
  const labelId = useId()
  const groupRef = useRef(null)

  function optionNode(next) {
    const group = groupRef.current
    if (!group) return null
    return [...group.querySelectorAll('[data-value]')].find((node) => node.getAttribute('data-value') === next) ?? null
  }

  function select(next, keyboard) {
    const group = groupRef.current
    const node = optionNode(next)
    if (keyboard) node?.focus({ preventScroll: true })
    else if (group) {
      // Safari paints :focus-visible for a scripted focus(), so a pointer pick must not move focus.
      const active = group.ownerDocument?.activeElement
      if (active && group.contains(active)) active.blur()
    }
    if (next !== value) onChange(next)
  }

  function onKeyDown(event) {
    const index = options.findIndex((option) => option.value === value)
    if (index < 0) return
    let next
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else return
    event.preventDefault()
    select(options[next].value, true)
  }

  function onPointerDown(event) {
    if (event.button !== 0) return
    const target = event.target?.closest?.('[data-value]')
    if (!target) return
    event.preventDefault()
    select(target.getAttribute('data-value'), false)
  }

  return (
    <div className="showcase-segmented">
      <span className="showcase-segmented-label" id={labelId}>
        {label}
      </span>
      <div
        className="showcase-segments"
        role="radiogroup"
        aria-labelledby={labelId}
        ref={groupRef}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            className="showcase-segment"
            data-value={option.value}
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            onClick={(event) => {
              if (event.detail === 0) select(option.value, true)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ShowcaseSlider({ label, min, max, step, value, display, valueText, disabled = false, onChange }) {
  const id = useId()
  const drag = useRef(null)

  function onPointerDown(event) {
    if (disabled || event.pointerType !== 'touch') return
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
    if (!current || event.pointerId !== current.id || disabled) return
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
      className="showcase-slider"
      data-disabled={disabled ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className="showcase-slider-fill" style={{ width: controlFill(value, min, max) }} aria-hidden="true" />
      <label className="showcase-slider-label" htmlFor={id}>
        {label}
      </label>
      <span className="showcase-slider-value" aria-hidden="true">
        {display}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText ?? display}
        onChange={(event) => {
          if (!disabled) onChange(event.target.valueAsNumber)
        }}
      />
    </div>
  )
}
