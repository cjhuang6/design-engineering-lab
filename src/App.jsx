import { useState } from 'react'
import { HexColorPickerDemo } from './components/hex-color-picker/HexColorPicker.jsx'
import tokensCss from './styles/tokens.css?raw'
import { catalogFromCss, frostProperties, previewKind } from './parseTokenCss.js'

const sections = catalogFromCss(tokensCss)
const tokenNames = sections.flatMap((section) =>
  section.subgroups.flatMap((group) => group.tokens.map((token) => token.name)),
)

function readComputed(names) {
  const style = getComputedStyle(document.documentElement)
  const values = {}
  for (const name of names) values[name] = style.getPropertyValue(name).trim()
  return values
}

function lengthWidth(name, tokens, computed) {
  const lengths = tokens
    .filter((token) => previewKind(token.name) === 'length')
    .map((token) => Number.parseFloat(computed[token.name]))
    .filter((value) => Number.isFinite(value))
  const max = Math.max(0, ...lengths)
  const value = Number.parseFloat(computed[name])
  if (!Number.isFinite(value) || max <= 0) return '0%'
  return `${(value / max) * 100}%`
}

function isTrackingCompanion(name) {
  return name.endsWith('-letter-spacing') && /^--(display|heading|body|label|code)-/.test(name)
}

function TokenPreview({ token }) {
  const kind = previewKind(token.name)
  if (kind === 'color') {
    return <div className="swatch" style={{ background: `var(${token.name})` }} aria-hidden="true" />
  }
  if (kind === 'radius') {
    return (
      <div
        className="swatch"
        style={{ borderRadius: `var(${token.name})`, background: 'var(--color-surface-subtle)' }}
        aria-hidden="true"
      />
    )
  }
  if (kind === 'shadow') {
    return (
      <div
        className="swatch"
        style={{ boxShadow: `var(${token.name})`, background: 'var(--color-surface-primary)' }}
        aria-hidden="true"
      />
    )
  }
  if (kind === 'opacity') {
    return (
      <div
        className="swatch"
        style={{ background: 'var(--color-action-primary)', opacity: `var(${token.name})` }}
        aria-hidden="true"
      />
    )
  }
  if (kind === 'border') {
    return (
      <div
        className="swatch"
        style={{ border: `var(${token.name})`, background: 'var(--color-surface-primary)' }}
        aria-hidden="true"
      />
    )
  }
  if (kind === 'expression') {
    return (
      <div className="expression-swatch" style={{ background: `var(${token.name})` }} aria-hidden="true" />
    )
  }
  return null
}

function TypeSample({ token }) {
  const kind = previewKind(token.name)
  if (kind === 'type') {
    return (
      <p
        className="type-sample"
        aria-hidden="true"
        style={{ font: `var(${token.name})`, letterSpacing: `var(${token.name}-letter-spacing)` }}
      >
        The quick brown fox
      </p>
    )
  }
  if (kind === 'tracking' && !isTrackingCompanion(token.name)) {
    return (
      <p
        className="type-sample"
        aria-hidden="true"
        style={{ font: 'var(--body-md)', letterSpacing: `var(${token.name})` }}
      >
        The quick brown fox
      </p>
    )
  }
  if (kind === 'family') {
    return (
      <p
        className="type-sample"
        aria-hidden="true"
        style={{ font: 'var(--body-lg)', fontFamily: `var(${token.name})` }}
      >
        The quick brown fox
      </p>
    )
  }
  if (kind === 'weight') {
    return (
      <p
        className="type-sample"
        aria-hidden="true"
        style={{ font: 'var(--body-lg)', fontWeight: `var(${token.name})` }}
      >
        The quick brown fox
      </p>
    )
  }
  return null
}

function SourceValues({ token }) {
  if (token.darkValue && token.darkValue !== token.lightValue) {
    return (
      <>
        <p>
          <span className="meta">Light</span> <code>{token.lightValue}</code>
        </p>
        <p>
          <span className="meta">Dark</span> <code>{token.darkValue}</code>
        </p>
      </>
    )
  }
  return (
    <p>
      <span className="meta">Source</span> <code>{token.lightValue ?? token.darkValue}</code>
    </p>
  )
}

function TokenRow({ token, tokens, computed }) {
  const kind = previewKind(token.name)
  const stacked = kind === 'expression' || kind === 'type' || kind === 'family' || kind === 'weight'
  return (
    <div className="token">
      <dt>
        <code>{token.name}</code>
      </dt>
      <dd className={stacked ? 'token-details token-details-stack' : 'token-details'}>
        <TokenPreview token={token} />
        <div className="token-values">
          <SourceValues token={token} />
          <p>
            <span className="meta">This theme</span>{' '}
            <code>{computed[token.name] || 'Not resolved'}</code>
          </p>
          {kind === 'length' ? (
            <span className="length-track" aria-hidden="true">
              <span className="length-bar" style={{ width: lengthWidth(token.name, tokens, computed) }} />
            </span>
          ) : null}
          <TypeSample token={token} />
        </div>
      </dd>
    </div>
  )
}

function FrostPreview({ tokens }) {
  const props = frostProperties(tokens)
  const style = {}
  if (props.background) style.background = `var(${props.background})`
  if (props.border) style.border = `var(${props.border})`
  if (props['backdrop-filter']) {
    const filter = `var(${props['backdrop-filter']})`
    style.backdropFilter = filter
    style.WebkitBackdropFilter = filter
  }
  return (
    <div className="frost-stage" aria-hidden="true">
      <div className="frost-panel" style={style} />
    </div>
  )
}

function sectionNote(id) {
  if (id === 'typography') {
    return 'Geist and Geist Mono are the families named in the tokens. This page does not load those font files, so the browser uses the next family in each stack.'
  }
  if (id === 'frost') {
    return 'Each material is shown on the Ice expression field so the blur is visible. The field itself does not change with the theme.'
  }
  return null
}

function App() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const [computed, setComputed] = useState(() => readComputed(tokenNames))

  function applyTheme(next) {
    document.documentElement.dataset.theme = next
    setTheme(next)
    setComputed(readComputed(tokenNames))
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-inner">
          <h1>Camellia tokens</h1>
          <p className="lede">
            {tokenNames.length} custom properties read from the generated stylesheet. Swatches use
            the active theme. Where light and dark differ, both source values are listed. The theme
            change fades color unless the system asks for reduced motion.
          </p>
          <p className="meta">Showing {theme} theme.</p>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
          </button>
        </div>
      </header>
      <main className="page">
        <HexColorPickerDemo />
        {sections.map((section) => {
          const note = sectionNote(section.id)
          const showGroups = section.subgroups.length > 1
          return (
            <section key={section.id} className="section" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {note ? <p className="note">{note}</p> : null}
              {section.subgroups.map((group) => (
                <div key={group.id} className="subgroup">
                  {showGroups ? <h3>{group.title}</h3> : null}
                  {section.id === 'frost' ? <FrostPreview tokens={group.tokens} /> : null}
                  <dl className="token-list">
                    {group.tokens.map((token) => (
                      <TokenRow key={token.name} token={token} tokens={group.tokens} computed={computed} />
                    ))}
                  </dl>
                </div>
              ))}
            </section>
          )
        })}
      </main>
    </>
  )
}

export default App
