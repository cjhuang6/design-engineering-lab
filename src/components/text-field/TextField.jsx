import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../button/Button.jsx'
import './TextField.css'

const SIZES = new Set(['sm', 'md', 'lg'])
const REQUIRED_MESSAGE = 'Fill in this field.'

function visibleLabel(label) {
  if (typeof label !== 'string' || label.trim() === '') {
    throw new Error('TextField requires a label.')
  }
  return label
}

function customError(error) {
  if (typeof error !== 'string' || error.trim() === '') return ''
  return error
}

function fieldMessage(value, error, required) {
  const custom = customError(error)
  if (custom) return custom
  if (required && value === '') return REQUIRED_MESSAGE
  return ''
}

function textValue(value) {
  if (value == null) return ''
  return String(value)
}

function fieldClassName(size, disabled, className) {
  const names = ['camellia-text-field']
  if (SIZES.has(size)) names.push(`camellia-text-field-${size}`)
  if (disabled) names.push('camellia-text-field-disabled')
  if (className) names.push(className)
  return names.join(' ')
}

export function TextField({
  label,
  hint,
  error,
  size = 'md',
  disabled = false,
  required = false,
  type = 'text',
  id,
  className,
  value,
  defaultValue,
  ref,
  onChange,
  onBlur,
  ...rest
}) {
  const generatedId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef(null)
  const [uncontrolled, setUncontrolled] = useState(() => textValue(defaultValue))
  const controlled = value !== undefined
  const current = controlled ? textValue(value) : uncontrolled
  const message = fieldMessage(current, error, required)
  const blocked = message !== ''
  const [revealed, setRevealed] = useState(false)
  const [trackedBlocked, setTrackedBlocked] = useState(blocked)
  if (blocked !== trackedBlocked) {
    setTrackedBlocked(blocked)
    if (!blocked) setRevealed(false)
  }
  const show = !disabled && revealed && blocked
  const described = []
  if (show) described.push(errorId)
  if (typeof hint === 'string' && hint.trim() !== '') described.push(hintId)
  const describedBy = described.length > 0 ? described.join(' ') : undefined

  useEffect(() => {
    const input = inputRef.current
    if (!input) return undefined
    function onInvalid(event) {
      if (disabled || !blocked) return
      event.preventDefault()
      setRevealed(true)
    }
    input.addEventListener('invalid', onInvalid)
    const form = input.closest('form')
    if (!form) return () => input.removeEventListener('invalid', onInvalid)
    function onSubmit(event) {
      if (disabled || !blocked) return
      event.preventDefault()
      setRevealed(true)
    }
    form.addEventListener('submit', onSubmit, true)
    return () => {
      input.removeEventListener('invalid', onInvalid)
      form.removeEventListener('submit', onSubmit, true)
    }
  }, [blocked, disabled])

  function handleChange(event) {
    if (!controlled) setUncontrolled(event.target.value)
    onChange?.(event)
  }

  function handleBlur(event) {
    if (!disabled && fieldMessage(event.target.value, error, required) !== '') setRevealed(true)
    onBlur?.(event)
  }

  return (
    <div className={fieldClassName(size, disabled, className)}>
      <label className="camellia-text-field-label" htmlFor={inputId}>
        <span className="camellia-text-field-label-text">{visibleLabel(label)}</span>
        <span className="camellia-text-field-control">
          <input
            {...rest}
            ref={(node) => {
              inputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            id={inputId}
            className="camellia-text-field-input"
            type={type}
            disabled={disabled}
            required={required}
            {...(controlled ? { value: current } : { defaultValue })}
            aria-invalid={show ? 'true' : undefined}
            aria-describedby={describedBy}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </span>
      </label>
      {typeof hint === 'string' && hint.trim() !== '' ? (
        <p className="camellia-text-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <p className="camellia-text-field-error" id={errorId} aria-live="polite">
        {show ? message : ''}
      </p>
    </div>
  )
}

function emailError(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return ''
  return 'Enter an email address.'
}

const DEMO_SIZES = [
  ['sm', 'Small'],
  ['md', 'Medium'],
  ['lg', 'Large'],
]

export function TextFieldDemo() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')

  return (
    <div className="camellia-text-field-demo">
      <h2 id="text-field-demo-title">Text field</h2>
      <form
        className="camellia-text-field-example"
        onSubmit={(event) => {
          if (event.defaultPrevented) return
          event.preventDefault()
          setSent(email)
        }}
      >
        <TextField
          label="Email"
          type="email"
          name="email"
          size="md"
          required
          autoComplete="email"
          placeholder="name@example.com"
          hint="We'll reply to this address."
          error={emailError(email)}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setSent('')
          }}
        />
        <Button type="submit">Send</Button>
      </form>
      <p className="note" aria-live="polite">
        {sent ? `Sent to ${sent}.` : 'Nothing sent.'}
      </p>
      <section className="camellia-text-field-demo-group" aria-labelledby="text-field-demo-sizes">
        <h2 id="text-field-demo-sizes">Sizes</h2>
        {DEMO_SIZES.map(([size, name]) => (
          <TextField key={size} label={name} size={size} placeholder={name} />
        ))}
      </section>
      <section className="camellia-text-field-demo-group" aria-labelledby="text-field-demo-disabled">
        <h2 id="text-field-demo-disabled">Disabled</h2>
        <TextField label="Company" size="md" disabled defaultValue="Camellia" hint="This field is off." />
      </section>
    </div>
  )
}
