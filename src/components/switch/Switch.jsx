import { useState } from 'react'
import './Switch.css'

function visibleLabel(children) {
  if (typeof children !== 'string' || children.trim() === '') {
    throw new Error('Switch requires a visible label.')
  }
  return children
}

function stateValue(value) {
  if (value === true || value === false) return value
  throw new Error('Switch state must be true or false.')
}

function attributes(rest) {
  const next = { ...rest }
  delete next.type
  delete next.role
  delete next.indeterminate
  delete next['aria-checked']
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function switchClassName(disabled, className) {
  const names = ['camellia-switch']
  if (disabled) names.push('camellia-switch-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
  children,
  onChange,
  ...rest
}) {
  const [uncontrolled, setUncontrolled] = useState(() => stateValue(defaultChecked))
  const controlled = checked !== undefined
  const state = controlled ? stateValue(checked) : uncontrolled
  const label = visibleLabel(children)

  function handleChange(event) {
    if (disabled) return
    const next = !state
    if (!controlled) setUncontrolled(next)
    onCheckedChange?.(next)
    onChange?.(event)
  }

  return (
    <label className={switchClassName(disabled, className)} data-state={state ? 'on' : 'off'}>
      <span className="camellia-switch-control">
        <input
          {...attributes(rest)}
          className="camellia-switch-input"
          type="checkbox"
          role="switch"
          checked={state}
          disabled={disabled}
          onChange={handleChange}
        />
        <span className="camellia-switch-thumb" aria-hidden="true" />
      </span>
      <span className="camellia-switch-label">{label}</span>
    </label>
  )
}

const DEMO_ITEMS = [
  ['Wi-Fi', true],
  ['Bluetooth', false],
]

function stateWord(state) {
  return state ? 'on' : 'off'
}

function selectionStatus(values) {
  const parts = [
    ...DEMO_ITEMS.map(([name]) => `${name} is ${stateWord(values[name])}`),
    'Airplane mode is off',
  ]
  return `${parts.join('. ')}.`
}

export function SwitchDemo() {
  const [values, setValues] = useState(() => Object.fromEntries(DEMO_ITEMS))

  function onCheckedChange(name, next) {
    setValues((current) => ({ ...current, [name]: next }))
  }

  return (
    <div className="camellia-switch-demo">
      <h2>Switch</h2>
      <fieldset className="camellia-switch-group">
        <legend>Connections</legend>
        <div className="camellia-switch-list">
          {DEMO_ITEMS.map(([name]) => (
            <Switch
              key={name}
              checked={values[name]}
              onCheckedChange={(next) => onCheckedChange(name, next)}
            >
              {name}
            </Switch>
          ))}
          <Switch disabled>Airplane mode</Switch>
        </div>
      </fieldset>
      <p className="note" aria-live="polite">
        {selectionStatus(values)}
      </p>
    </div>
  )
}
