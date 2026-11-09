import { useState } from 'react'
import './Button.css'

const VARIANTS = new Set(['primary', 'secondary', 'ghost'])
const SIZES = new Set(['sm', 'md', 'lg'])

const DEMO_VARIANTS = [
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['ghost', 'Ghost'],
]

const DEMO_SIZES = ['sm', 'md', 'lg']

function buttonClassName(variant, size, className) {
  const names = ['camellia-button']
  if (VARIANTS.has(variant)) names.push(`camellia-button-${variant}`)
  if (SIZES.has(size)) names.push(`camellia-button-${size}`)
  if (className) names.push(className)
  return names.join(' ')
}

function isAriaDisabled(value) {
  return value === true || value === 'true'
}

function blocksKeys(event) {
  return event.key === 'Enter' || event.key === ' '
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className,
  children,
  onClick,
  onKeyDown,
  onKeyUp,
  ...rest
}) {
  const unavailable = isAriaDisabled(rest['aria-disabled'])

  function handleClick(event) {
    if (disabled || unavailable) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
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
      {...rest}
      type={type}
      disabled={disabled}
      className={buttonClassName(variant, size, className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {children}
    </button>
  )
}

export function ButtonDemo() {
  const [activated, setActivated] = useState('')

  return (
    <div className="camellia-button-demo">
      {DEMO_VARIANTS.map(([variant, label]) => (
        <section key={variant} className="camellia-button-demo-group" aria-labelledby={`button-demo-${variant}`}>
          <h2 id={`button-demo-${variant}`}>{label}</h2>
          <div className="camellia-button-row">
            {DEMO_SIZES.map((size) => (
              <Button
                key={size}
                variant={variant}
                size={size}
                onClick={() => setActivated(`${label} ${size}`)}
              >
                {label} {size}
              </Button>
            ))}
          </div>
        </section>
      ))}
      <section className="camellia-button-demo-group" aria-labelledby="button-demo-disabled">
        <h2 id="button-demo-disabled">Disabled</h2>
        <div className="camellia-button-row">
          {DEMO_VARIANTS.map(([variant, label]) => (
            <Button
              key={variant}
              variant={variant}
              size="md"
              disabled
              onClick={() => setActivated(`${label} disabled`)}
            >
              {label} disabled
            </Button>
          ))}
        </div>
      </section>
      <section className="camellia-button-demo-group" aria-labelledby="button-demo-unavailable">
        <h2 id="button-demo-unavailable">Unavailable</h2>
        <div className="camellia-button-row">
          {DEMO_VARIANTS.map(([variant, label]) => (
            <Button
              key={variant}
              variant={variant}
              size="md"
              aria-disabled="true"
              onClick={() => setActivated(`${label} unavailable`)}
            >
              {label} unavailable
            </Button>
          ))}
        </div>
      </section>
      <p className="note" aria-live="polite">
        {activated ? `Activated ${activated}.` : 'No button activated.'}
      </p>
    </div>
  )
}
