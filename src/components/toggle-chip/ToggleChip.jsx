import { useState } from 'react'
import './ToggleChip.css'

function visibleLabel(children) {
  if (typeof children !== 'string' || children.trim() === '') {
    throw new Error('ToggleChip requires a visible label.')
  }
  return children
}

function isAriaDisabled(value) {
  return value === true || value === 'true'
}

function blocksKeys(event) {
  return event.key === 'Enter' || event.key === ' '
}

function attributes(rest) {
  const next = { ...rest }
  delete next['aria-pressed']
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function chipClassName(className) {
  return className ? `camellia-toggle-chip ${className}` : 'camellia-toggle-chip'
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ToggleChip({
  pressed,
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  icon = null,
  type = 'button',
  className,
  children,
  onClick,
  onKeyDown,
  onKeyUp,
  ...rest
}) {
  const [uncontrolled, setUncontrolled] = useState(() => Boolean(defaultPressed))
  const controlled = pressed !== undefined
  const selected = controlled ? Boolean(pressed) : uncontrolled
  const unavailable = isAriaDisabled(rest['aria-disabled'])
  const label = visibleLabel(children)

  function handleClick(event) {
    if (disabled || unavailable) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const next = !selected
    if (!controlled) setUncontrolled(next)
    onPressedChange?.(next)
    onClick?.(event)
  }

  function handleKeyDown(event) {
    if (unavailable && blocksKeys(event)) event.preventDefault()
    onKeyDown?.(event)
  }

  function handleKeyUp(event) {
    if (unavailable && blocksKeys(event)) event.preventDefault()
    onKeyUp?.(event)
  }

  return (
    <button
      {...attributes(rest)}
      type={type}
      disabled={disabled}
      className={chipClassName(className)}
      aria-pressed={selected ? 'true' : 'false'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <span className="camellia-toggle-chip-mark" aria-hidden="true">
        {selected ? <CheckMark /> : <span className="camellia-toggle-chip-dot" />}
      </span>
      {icon ? (
        <span className="camellia-toggle-chip-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="camellia-toggle-chip-label">{label}</span>
    </button>
  )
}

const DEMO_CHIPS = [
  ['Clear', false],
  ['Useful', true],
  ['Specific', false],
]

function TagIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M1.5 2.5h6.1l6 6-5.6 5.6-6.5-6.5V2.5zm2.2 2.2a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3z"
      />
    </svg>
  )
}

function selectionStatus(selected) {
  const names = DEMO_CHIPS.map(([label]) => label).filter((label) => selected.has(label))
  if (names.length === 0) return 'None selected.'
  if (names.length === 1) return `Selected ${names[0]}.`
  if (names.length === 2) return `Selected ${names[0]} and ${names[1]}.`
  return `Selected ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}.`
}

export function ToggleChipDemo() {
  const [selected, setSelected] = useState(() => new Set(['Clear']))

  function onPressedChange(label, next) {
    setSelected((current) => {
      const copy = new Set(current)
      if (next) copy.add(label)
      else copy.delete(label)
      return copy
    })
  }

  return (
    <div className="camellia-toggle-chip-demo">
      <h2 id="toggle-chip-demo-title">Toggle chip</h2>
      <div className="camellia-toggle-chip-group" role="group" aria-labelledby="toggle-chip-demo-reasons">
        <h2 id="toggle-chip-demo-reasons">Reasons</h2>
        <div className="camellia-toggle-chip-row">
          {DEMO_CHIPS.map(([label, hasIcon]) => (
            <ToggleChip
              key={label}
              pressed={selected.has(label)}
              onPressedChange={(next) => onPressedChange(label, next)}
              icon={hasIcon ? <TagIcon /> : null}
            >
              {label}
            </ToggleChip>
          ))}
          <ToggleChip pressed={false} disabled onPressedChange={(next) => onPressedChange('Later', next)}>
            Later
          </ToggleChip>
        </div>
      </div>
      <p className="note" aria-live="polite">
        {selectionStatus(selected)}
      </p>
    </div>
  )
}
