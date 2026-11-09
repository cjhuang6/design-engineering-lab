import { useState } from 'react'
import { Button } from '../button/Button.jsx'
import './IconButton.css'

const DEMO_VARIANTS = [
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['ghost', 'Ghost'],
]

const DEMO_SIZES = ['sm', 'md', 'lg']

function accessibleLabel(label) {
  if (typeof label !== 'string' || label.trim() === '') {
    throw new Error('IconButton requires a label for its accessible name.')
  }
  return label
}

function attributes(rest) {
  const next = { ...rest }
  delete next['aria-label']
  delete next['aria-labelledby']
  return next
}

function iconClassName(className) {
  return className ? `camellia-icon-button ${className}` : 'camellia-icon-button'
}

export function IconButton({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <Button
      {...attributes(rest)}
      variant={variant}
      size={size}
      disabled={disabled}
      type={type}
      className={iconClassName(className)}
      aria-label={accessibleLabel(label)}
    >
      <span className="camellia-icon-button-icon" aria-hidden="true">
        {children}
      </span>
    </Button>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M10.25 4.5h3.5v5.75H19.5v3.5h-5.75V19.5h-3.5v-5.75H4.5v-3.5h5.75V4.5z"
      />
    </svg>
  )
}

export function IconButtonDemo() {
  const [activated, setActivated] = useState('')

  return (
    <div className="camellia-icon-button-demo">
      <h2 id="icon-button-demo-title">Icon button</h2>
      {DEMO_VARIANTS.map(([variant, label]) => (
        <section key={variant} className="camellia-icon-button-demo-group" aria-labelledby={`icon-button-demo-${variant}`}>
          <h2 id={`icon-button-demo-${variant}`}>{label}</h2>
          <div className="camellia-icon-button-row">
            {DEMO_SIZES.map((size) => (
              <IconButton
                key={size}
                variant={variant}
                size={size}
                label={`${label} ${size}`}
                onClick={() => setActivated(`${label} ${size}`)}
              >
                <PlusIcon />
              </IconButton>
            ))}
          </div>
        </section>
      ))}
      <section className="camellia-icon-button-demo-group" aria-labelledby="icon-button-demo-disabled">
        <h2 id="icon-button-demo-disabled">Disabled</h2>
        <div className="camellia-icon-button-row">
          {DEMO_VARIANTS.map(([variant, label]) => (
            <IconButton
              key={variant}
              variant={variant}
              size="md"
              disabled
              label={`${label} disabled`}
              onClick={() => setActivated(`${label} disabled`)}
            >
              <PlusIcon />
            </IconButton>
          ))}
        </div>
      </section>
      <section className="camellia-icon-button-demo-group" aria-labelledby="icon-button-demo-unavailable">
        <h2 id="icon-button-demo-unavailable">Unavailable</h2>
        <div className="camellia-icon-button-row">
          {DEMO_VARIANTS.map(([variant, label]) => (
            <IconButton
              key={variant}
              variant={variant}
              size="md"
              aria-disabled="true"
              label={`${label} unavailable`}
              onClick={() => setActivated(`${label} unavailable`)}
            >
              <PlusIcon />
            </IconButton>
          ))}
        </div>
      </section>
      <p className="note" aria-live="polite">
        {activated ? `Activated icon ${activated}.` : 'No icon button activated.'}
      </p>
    </div>
  )
}
