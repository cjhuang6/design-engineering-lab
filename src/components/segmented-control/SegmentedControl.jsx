import { useState } from 'react'
import './SegmentedControl.css'

function visibleLegend(legend, label) {
  const hasLegend = legend != null
  const hasLabel = label != null
  if (hasLegend && hasLabel && legend !== label) {
    throw new Error('SegmentedControl takes one visible legend.')
  }
  const text = hasLegend ? legend : label
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('SegmentedControl requires a visible legend.')
  }
  return text
}

function requiredName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('SegmentedControl requires a name.')
  }
  return name
}

function selectionValue(value) {
  if (value == null) return null
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('SegmentedControl value must be a non-empty string.')
  }
  return value
}

function readOptions(options) {
  if (!Array.isArray(options)) throw new Error('SegmentedControl options must be an array.')
  if (options.length === 0) throw new Error('SegmentedControl requires options.')
  const seen = new Set()
  return options.map((option) => {
    if (typeof option?.label !== 'string' || option.label.trim() === '') {
      throw new Error('SegmentedControl option requires a visible label.')
    }
    if (typeof option.value !== 'string' || option.value.trim() === '') {
      throw new Error('SegmentedControl option requires a value.')
    }
    const value = option.value
    if (seen.has(value)) throw new Error('SegmentedControl option values must be unique.')
    seen.add(value)
    return { value, label: option.label, disabled: Boolean(option.disabled) }
  })
}

function fieldsetAttributes(rest) {
  const next = { ...rest }
  delete next.role
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function groupClassName(disabled, className) {
  const names = ['camellia-segmented']
  if (disabled) names.push('camellia-segmented-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

function segmentClassName(faded) {
  const names = ['camellia-segment']
  if (faded) names.push('camellia-segment-disabled')
  return names.join(' ')
}

export function SegmentedControl({
  legend,
  label,
  name,
  options,
  value,
  defaultValue = null,
  onValueChange,
  disabled = false,
  className,
  ...rest
}) {
  const [uncontrolled, setUncontrolled] = useState(() => selectionValue(defaultValue))
  const controlled = value !== undefined
  const selected = controlled ? selectionValue(value) : uncontrolled
  const legendText = visibleLegend(legend, label)
  const groupName = requiredName(name)
  const items = readOptions(options)

  function onSelect(next) {
    if (disabled || next === selected) return
    if (!controlled) setUncontrolled(next)
    onValueChange?.(next)
  }

  return (
    <fieldset
      {...fieldsetAttributes(rest)}
      className={groupClassName(disabled, className)}
      disabled={disabled}
    >
      <legend>{legendText}</legend>
      <div className="camellia-segmented-track">
        {items.map((option) => {
          const checked = selected === option.value
          const unavailable = disabled || option.disabled
          return (
            <label
              key={option.value}
              className={segmentClassName(option.disabled && !disabled)}
              data-state={checked ? 'checked' : 'unchecked'}
            >
              <input
                className="camellia-segment-input"
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                disabled={unavailable}
                onChange={() => {
                  if (unavailable) return
                  onSelect(option.value)
                }}
              />
              <span className="camellia-segment-label">{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

const DEMO_OPTIONS = [
  ['day', 'Day', false],
  ['week', 'Week', false],
  ['month', 'Month', false],
  ['year', 'Year', true],
]

const ALIGN_OPTIONS = [
  ['start', 'Start'],
  ['center', 'Center'],
  ['end', 'End'],
]

function selectionStatus(value) {
  const match = DEMO_OPTIONS.find(([option]) => option === value)
  if (!match) return 'Nothing selected.'
  return `Selected ${match[1]}.`
}

export function SegmentedControlDemo() {
  const [value, setValue] = useState('week')

  return (
    <div className="camellia-segmented-demo">
      <h2>Segmented control</h2>
      <SegmentedControl
        legend="View"
        name="view"
        value={value}
        onValueChange={setValue}
        options={DEMO_OPTIONS.map(([option, text, optionDisabled]) => ({
          value: option,
          label: text,
          disabled: optionDisabled,
        }))}
      />
      <p className="note" aria-live="polite">
        {selectionStatus(value)}
      </p>
      <SegmentedControl
        legend="Alignment"
        name="alignment"
        defaultValue="center"
        disabled
        options={ALIGN_OPTIONS.map(([option, text]) => ({ value: option, label: text }))}
      />
    </div>
  )
}
