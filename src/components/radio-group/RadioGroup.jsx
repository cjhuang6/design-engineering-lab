import { Children, createContext, isValidElement, useContext, useState } from 'react'
import './RadioGroup.css'

const RadioContext = createContext(null)

function visibleLegend(legend, label) {
  const hasLegend = legend != null
  const hasLabel = label != null
  if (hasLegend && hasLabel && legend !== label) {
    throw new Error('RadioGroup takes one visible legend.')
  }
  const text = hasLegend ? legend : label
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('RadioGroup requires a visible legend.')
  }
  return text
}

function requiredName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('RadioGroup requires a name.')
  }
  return name
}

function selectionValue(value) {
  if (value == null) return null
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('RadioGroup value must be a non-empty string.')
  }
  return value
}

function optionValue(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Radio requires a value.')
  }
  return value
}

function visibleLabel(children) {
  if (typeof children !== 'string' || children.trim() === '') {
    throw new Error('Radio requires a visible label.')
  }
  return children
}

function readOptions(options) {
  if (!Array.isArray(options)) throw new Error('RadioGroup options must be an array.')
  const seen = new Set()
  return options.map((option) => {
    if (typeof option?.label !== 'string' || option.label.trim() === '') {
      throw new Error('RadioGroup option requires a visible label.')
    }
    if (typeof option.value !== 'string' || option.value.trim() === '') {
      throw new Error('RadioGroup option requires a value.')
    }
    const value = option.value
    if (seen.has(value)) throw new Error('RadioGroup option values must be unique.')
    seen.add(value)
    return { value, label: option.label, disabled: Boolean(option.disabled) }
  })
}

function radioChildren(children) {
  const items = []
  const seen = new Set()
  Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return
    if (typeof child === 'string' && child.trim() === '') return
    if (!isValidElement(child) || child.type !== Radio) {
      throw new Error('RadioGroup children must be Radio elements.')
    }
    const value = optionValue(child.props.value)
    visibleLabel(child.props.children)
    if (seen.has(value)) throw new Error('RadioGroup option values must be unique.')
    seen.add(value)
    items.push(child)
  })
  return items
}

function fieldsetAttributes(rest) {
  const next = { ...rest }
  delete next.role
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function inputAttributes(rest) {
  const next = { ...rest }
  delete next.type
  delete next.name
  delete next.checked
  delete next.defaultChecked
  delete next['aria-checked']
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function groupClassName(disabled, className) {
  const names = ['camellia-radio-group']
  if (disabled) names.push('camellia-radio-group-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

function radioClassName(faded, className) {
  const names = ['camellia-radio']
  if (faded) names.push('camellia-radio-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

export function Radio({
  value,
  disabled = false,
  className,
  children,
  onChange,
  ...rest
}) {
  const group = useContext(RadioContext)
  if (!group) throw new Error('Radio must be rendered inside a RadioGroup.')
  const option = optionValue(value)
  const label = visibleLabel(children)
  const checked = group.selected === option
  const unavailable = group.disabled || disabled
  const faded = disabled && !group.disabled

  function handleChange(event) {
    if (unavailable || checked) return
    group.onSelect(option)
    onChange?.(event)
  }

  return (
    <label className={radioClassName(faded, className)} data-state={checked ? 'checked' : 'unchecked'}>
      <span className="camellia-radio-control">
        <input
          {...inputAttributes(rest)}
          className="camellia-radio-input"
          type="radio"
          name={group.name}
          value={option}
          checked={checked}
          disabled={unavailable}
          onChange={handleChange}
        />
        <span className="camellia-radio-glyph" aria-hidden="true">
          {checked ? <span className="camellia-radio-dot" /> : null}
        </span>
      </span>
      <span className="camellia-radio-label">{label}</span>
    </label>
  )
}

export function RadioGroup({
  legend,
  label,
  name,
  options,
  value,
  defaultValue = null,
  onValueChange,
  disabled = false,
  className,
  children,
  ...rest
}) {
  const [uncontrolled, setUncontrolled] = useState(() => selectionValue(defaultValue))
  const controlled = value !== undefined
  const selected = controlled ? selectionValue(value) : uncontrolled
  const legendText = visibleLegend(legend, label)
  const groupName = requiredName(name)
  const items = radioChildren(children)

  function onSelect(next) {
    if (disabled) return
    if (!controlled) setUncontrolled(next)
    onValueChange?.(next)
  }

  let body
  if (options !== undefined && items.length > 0) {
    throw new Error('RadioGroup takes options or Radio children, not both.')
  } else if (options !== undefined) {
    const list = readOptions(options)
    if (list.length === 0) throw new Error('RadioGroup requires options or Radio children.')
    body = list.map((option) => (
      <Radio key={option.value} value={option.value} disabled={option.disabled}>
        {option.label}
      </Radio>
    ))
  } else if (items.length === 0) {
    throw new Error('RadioGroup requires options or Radio children.')
  } else {
    body = items
  }

  return (
    <RadioContext.Provider value={{ name: groupName, selected, disabled, onSelect }}>
      <fieldset
        {...fieldsetAttributes(rest)}
        className={groupClassName(disabled, className)}
        disabled={disabled}
      >
        <legend>{legendText}</legend>
        <div className="camellia-radio-list">{body}</div>
      </fieldset>
    </RadioContext.Provider>
  )
}

const DEMO_OPTIONS = [
  ['standard', 'Standard', false],
  ['express', 'Express', false],
  ['pickup', 'Pickup', true],
]

function selectionStatus(value) {
  const match = DEMO_OPTIONS.find(([option]) => option === value)
  if (!match) return 'Nothing selected.'
  return `Selected ${match[1]}.`
}

export function RadioGroupDemo() {
  const [value, setValue] = useState(null)

  return (
    <div className="camellia-radio-demo">
      <h2>Radio group</h2>
      <RadioGroup legend="Shipping" name="shipping" value={value} onValueChange={setValue}>
        {DEMO_OPTIONS.map(([option, text, optionDisabled]) => (
          <Radio key={option} value={option} disabled={optionDisabled}>
            {text}
          </Radio>
        ))}
      </RadioGroup>
      <p className="note" aria-live="polite">
        {selectionStatus(value)}
      </p>
      <RadioGroup legend="Gift wrap" name="gift-wrap" defaultValue="none" disabled>
        <Radio value="none">None</Radio>
        <Radio value="box">Box</Radio>
      </RadioGroup>
    </div>
  )
}
