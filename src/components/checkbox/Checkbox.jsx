import { useState } from 'react'
import './Checkbox.css'

function visibleLabel(children) {
  if (typeof children !== 'string' || children.trim() === '') {
    throw new Error('Checkbox requires a visible label.')
  }
  return children
}

function stateValue(value) {
  if (value === true || value === false || value === 'mixed') return value
  throw new Error('Checkbox state must be true, false, or "mixed".')
}

function stateName(state) {
  if (state === 'mixed') return 'mixed'
  return state ? 'checked' : 'unchecked'
}

function nextChecked(state) {
  return state !== true
}

function attributes(rest) {
  const next = { ...rest }
  delete next.type
  delete next.indeterminate
  delete next['aria-checked']
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function checkboxClassName(disabled, className) {
  const names = ['camellia-checkbox']
  if (disabled) names.push('camellia-checkbox-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

function CheckMark() {
  return (
    <svg className="camellia-checkbox-check" viewBox="0 0 20 20">
      <path
        d="M4.5 10.4 8.2 14.1 15.5 6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DashMark() {
  return (
    <svg className="camellia-checkbox-dash" viewBox="0 0 20 20">
      <path
        d="M5 10h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Checkbox({
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

  function setInput(node) {
    if (node) node.indeterminate = state === 'mixed'
  }

  function handleChange(event) {
    if (disabled) return
    const next = nextChecked(state)
    if (!controlled) setUncontrolled(next)
    onCheckedChange?.(next)
    onChange?.(event)
  }

  return (
    <label className={checkboxClassName(disabled, className)} data-state={stateName(state)}>
      <span className="camellia-checkbox-control">
        <input
          {...attributes(rest)}
          ref={setInput}
          className="camellia-checkbox-input"
          type="checkbox"
          checked={state === true}
          disabled={disabled}
          onChange={handleChange}
        />
        <span className="camellia-checkbox-glyph" aria-hidden="true">
          {state === 'mixed' ? <DashMark /> : state === true ? <CheckMark /> : null}
        </span>
      </span>
      <span className="camellia-checkbox-label">{label}</span>
    </label>
  )
}

const DEMO_ITEMS = [
  ['Email', true],
  ['Push', false],
  ['Some devices', 'mixed'],
]

function stateWord(state) {
  if (state === 'mixed') return 'mixed'
  return state ? 'on' : 'off'
}

function selectionStatus(values) {
  const parts = [
    ...DEMO_ITEMS.map(([name]) => `${name} is ${stateWord(values[name])}`),
    'SMS is off',
  ]
  return `${parts.join('. ')}.`
}

export function CheckboxDemo() {
  const [values, setValues] = useState(() => Object.fromEntries(DEMO_ITEMS))

  function onCheckedChange(name, next) {
    setValues((current) => ({ ...current, [name]: next }))
  }

  return (
    <div className="camellia-checkbox-demo">
      <h2>Checkbox</h2>
      <fieldset className="camellia-checkbox-group">
        <legend>Notifications</legend>
        <div className="camellia-checkbox-list">
          {DEMO_ITEMS.map(([name]) => (
            <Checkbox
              key={name}
              checked={values[name]}
              onCheckedChange={(next) => onCheckedChange(name, next)}
            >
              {name}
            </Checkbox>
          ))}
          <Checkbox disabled>SMS</Checkbox>
        </div>
      </fieldset>
      <p className="note" aria-live="polite">
        {selectionStatus(values)}
      </p>
    </div>
  )
}
