import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../button/Button.jsx'
import { cssDurationMs } from '../hex-color-picker/model.js'
import { TextField } from '../text-field/TextField.jsx'
import { ToggleChip } from '../toggle-chip/ToggleChip.jsx'
import {
  COMMENT_LIMIT,
  ENDS,
  QUESTION,
  RATING_WORDS,
  askText,
  cancelDetails,
  bandOf,
  charactersLeft,
  commentTooLong,
  counterText,
  editAnnouncement,
  editReceipt,
  hoverTargets,
  initialFeedback,
  keepsCommentOnEscape,
  nextRating,
  openComment,
  pointerRating,
  radioName,
  rate,
  revealOverLimit,
  segmentFill,
  sendAnnouncement,
  setComment,
  submitFeedback,
  summaryText,
  toggleChip,
  CHIPS,
  smoothstep,
} from './model.js'
import './GuideFeedback.css'

const MEASURE_RATINGS = [1, 3, 5]

export const GUIDE_FEEDBACK_DESCRIPTION =
  'How clear was this guide? Rate it from 1 to 5, then optionally say why and leave a comment.'

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function cssValue(element, name) {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

function motionMs(name) {
  if (reducedMotion()) return 0
  return cssDurationMs(getComputedStyle(document.documentElement).getPropertyValue(name))
}

function announce(node, message) {
  if (!node) return
  node.textContent = ''
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.textContent = message
    })
  })
}

function CheckIcon() {
  return (
    <svg className="guide-feedback-check" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MeasureCard({ rating }) {
  return (
    <div className="guide-feedback">
      <div className="guide-feedback-body">
        <p className="guide-feedback-question">{QUESTION}</p>
        <div className="guide-feedback-scale">
          {RATING_WORDS.map((word, index) => (
            <span key={word} className="guide-feedback-segment">
              <span>{index + 1}</span>
            </span>
          ))}
        </div>
        <div className="guide-feedback-ends">
          <span>{ENDS[0]}</span>
          <span>{ENDS[1]}</span>
        </div>
        <div className="guide-feedback-details">
          <p className="guide-feedback-ask">{askText(rating)}</p>
          <div className="guide-feedback-chips">
            {CHIPS[bandOf(rating)].map((label) => (
              <ToggleChip key={label} pressed={false} tabIndex={-1}>
                {label}
              </ToggleChip>
            ))}
          </div>
          <div className="guide-feedback-slot">
            <div className="guide-feedback-comment">
              <TextField label="Comment" size="md" readOnly tabIndex={-1} defaultValue="" />
              <span className="guide-feedback-count is-over">281/280 · 1 over</span>
            </div>
          </div>
          <div className="guide-feedback-actions">
            <Button variant="secondary" size="md" tabIndex={-1}>
              Cancel
            </Button>
            <Button variant="primary" size="md" tabIndex={-1}>
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GuideFeedbackControls({ onReset }) {
  return (
    <div className="showcase-controls">
      <div className="showcase-controls-head">
        <h4>Controls</h4>
        <button type="button" className="showcase-reset" aria-label="Reset controls" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  )
}

export function GuideFeedback({ value, onChange }) {
  const questionId = useId()
  const askId = useId()
  const fieldId = useId()
  const commentId = useId()
  const countId = useId()
  const leftId = useId()
  const cardRef = useRef(null)
  const stageRef = useRef(null)
  const measureRef = useRef(null)
  const fieldRef = useRef(null)
  const submitRef = useRef(null)
  const receiptRef = useRef(null)
  const liveRef = useRef(null)
  const [internal, setInternal] = useState(initialFeedback)
  const model = value ?? internal
  const starting = model.phase === 'scale' ? 0 : model.rating
  const modelRef = useRef(model)
  const shownRef = useRef({ lit: starting, preview: starting })
  const animRef = useRef({ lit: 0, preview: 0 })
  const focusField = useRef(false)
  const focusSubmit = useRef(false)
  const focusInvalid = useRef(false)
  const focusScale = useRef(false)
  const commitRef = useRef(null)
  const [lit, setLit] = useState(starting)
  const [preview, setPreview] = useState(starting)
  const [settledOnMount, setSettledOnMount] = useState(
    () => model.phase === 'receipt' && model.announced === true,
  )
  const showSettled = settledOnMount && model.phase === 'receipt'

  useLayoutEffect(() => {
    modelRef.current = model
    commitRef.current = setModel
  })

  useLayoutEffect(() => {
    if (!showSettled) return
    const card = cardRef.current
    if (!card) return
    card.classList.remove('is-shrinking')
    card.classList.add('is-sending')
    card.style.height = cssValue(card, '--feedback-card-receipt-height')
  }, [showSettled])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const measure = measureRef.current
    if (!stage || !measure) return undefined
    let cancel = false
    const apply = () => {
      if (cancel) return
      let maxCard = 0
      for (const card of measure.querySelectorAll('.guide-feedback')) {
        maxCard = Math.max(maxCard, card.offsetHeight)
      }
      if (maxCard > 0) {
        const next = `${maxCard}px`
        if (stage.style.minBlockSize !== next) stage.style.minBlockSize = next
      }
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(stage)
    const fontsReady = document.fonts?.ready
    if (fontsReady && typeof fontsReady.then === 'function') {
      fontsReady.then(() => {
        if (!cancel) apply()
      })
    }
    return () => {
      cancel = true
      observer.disconnect()
    }
  }, [model.phase])

  function setModel(update) {
    const next = typeof update === 'function' ? update(modelRef.current) : update
    modelRef.current = next
    if (onChange) onChange(next)
    if (value === undefined) setInternal(next)
  }

  function paintValue(key, amount) {
    shownRef.current[key] = amount
    if (key === 'lit') setLit(amount)
    else setPreview(amount)
  }

  function animateTo(key, to, instant) {
    const previous = animRef.current[key]
    if (previous) cancelAnimationFrame(previous)
    const from = shownRef.current[key]
    const distance = Math.abs(to - from)
    const ms = distance * motionMs('--duration-fast')
    if (instant || reducedMotion() || distance === 0 || ms <= 0) {
      animRef.current[key] = 0
      paintValue(key, to)
      return
    }
    const start = performance.now()
    const eased = distance > 1.5
    const step = (now) => {
      const progress = Math.min(1, (now - start) / ms)
      const amount = eased ? smoothstep(progress) : progress
      paintValue(key, from + (to - from) * amount)
      if (progress < 1) animRef.current[key] = requestAnimationFrame(step)
      else animRef.current[key] = 0
    }
    animRef.current[key] = requestAnimationFrame(step)
  }

  function moveFill(rating, hoverRating, instant) {
    const target = hoverTargets(rating, hoverRating)
    animateTo('lit', target.lit, instant)
    animateTo('preview', target.preview, instant)
  }

  function choose(rating, instant) {
    setModel((current) => rate(current, rating))
    moveFill(rating, 0, instant)
  }

  function clearScale(instant) {
    focusScale.current = true
    setModel((current) => cancelDetails(current))
    moveFill(0, 0, instant)
  }

  function attemptSubmit() {
    const current = modelRef.current
    if (current.phase !== 'details') return
    if (commentTooLong(current.comment)) {
      focusInvalid.current = true
      setModel((latest) => revealOverLimit(latest))
      return
    }
    setModel((latest) => submitFeedback(latest))
  }

  function onRadioKeyDown(event, rating) {
    if (modelRef.current.phase === 'receipt') return
    const next = nextRating(rating, event.key)
    if (next == null) return
    event.preventDefault()
    choose(next, true)
    cardRef.current?.querySelector(`[data-rating="${next}"]`)?.focus()
  }

  function onRadioClick(event, rating) {
    if (modelRef.current.phase === 'receipt') return
    choose(rating, event.detail === 0)
  }

  function onRadioMove(event, rating) {
    if (event.pointerType !== 'mouse') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const current = modelRef.current
    const selected = current.phase === 'scale' ? 0 : current.rating
    const { left, width } = event.currentTarget.getBoundingClientRect()
    moveFill(selected, pointerRating(rating, event.clientX - left, width), true)
  }

  function onScaleLeave() {
    const current = modelRef.current
    if (current.phase === 'receipt') return
    const selected = current.phase === 'scale' ? 0 : current.rating
    moveFill(selected, 0, false)
  }

  function onCardKeyDown(event) {
    if (event.key !== 'Escape') return
    const current = modelRef.current
    if (current.phase !== 'details') return
    if (event.target === fieldRef.current && keepsCommentOnEscape(current)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    clearScale(true)
  }

  function sendForm() {
    const form = submitRef.current?.closest('form')
    if (!form || modelRef.current.phase !== 'details') return
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  function onFieldKeyDown(event) {
    if (event.key !== 'Enter' || event.repeat) return
    event.preventDefault()
    if (submitRef.current?.disabled) return
    sendForm()
  }

  function onSubmitKeyDown(event) {
    if (event.repeat) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    sendForm()
  }

  function onDetailsClickCapture(event) {
    const button = event.target?.closest?.('button')
    if (button !== submitRef.current) return
    sendForm()
  }

  function onAddComment() {
    focusField.current = true
    setModel((current) => openComment(current))
  }

  function onEdit() {
    focusSubmit.current = true
    announce(liveRef.current, editAnnouncement())
    const card = cardRef.current
    if (card) {
      card.classList.remove('is-sending', 'is-shrinking')
      card.style.height = ''
    }
    setSettledOnMount(false)
    setModel((current) => editReceipt(current))
  }

  useEffect(() => {
    const anim = animRef.current
    return () => {
      cancelAnimationFrame(anim.lit)
      cancelAnimationFrame(anim.preview)
    }
  }, [])

  useEffect(() => {
    if (model.phase === 'details' && model.commentOpen && focusField.current) {
      focusField.current = false
      fieldRef.current?.focus()
    }
  }, [model.phase, model.commentOpen])

  useEffect(() => {
    if (model.phase === 'details' && focusSubmit.current) {
      focusSubmit.current = false
      submitRef.current?.focus()
    }
  }, [model.phase, model.comment, model.chips, model.rating])

  useEffect(() => {
    if (model.phase === 'details' && model.overLimitShown && focusInvalid.current) {
      focusInvalid.current = false
      fieldRef.current?.focus()
    }
  }, [model.phase, model.overLimitShown])

  useEffect(() => {
    if (model.phase === 'scale' && focusScale.current) {
      focusScale.current = false
      cardRef.current?.querySelector('[data-rating="1"]')?.focus()
    }
  }, [model.phase])

  useEffect(() => {
    if (model.phase !== 'receipt') return undefined
    const card = cardRef.current
    const snapshot = modelRef.current
    if (!card || snapshot.phase !== 'receipt' || snapshot.announced) return undefined
    let shrinkTimer = 0
    const full = card.offsetHeight
    card.style.height = `${full}px`
    card.classList.add('is-sending')
    receiptRef.current?.focus()
    announce(liveRef.current, sendAnnouncement(snapshot))
    const exit = motionMs('--duration-fast')
    shrinkTimer = window.setTimeout(() => {
      card.classList.add('is-shrinking')
      void card.offsetHeight
      card.style.height = cssValue(card, '--feedback-card-receipt-height')
    }, exit)
    commitRef.current?.((current) => {
      if (current.phase !== 'receipt' || current.announced) return current
      return { ...current, announced: true }
    })
    return () => {
      window.clearTimeout(shrinkTimer)
    }
  }, [model.phase])

  const responded = model.phase !== 'scale'
  const rating = responded ? model.rating : 0
  const errorShown = model.phase === 'details' && model.overLimitShown
  const tooLong = responded && commentTooLong(model.comment)
  const summary = responded ? summaryText(model) : ''
  const chips = responded ? CHIPS[bandOf(model.rating)] : []

  return (
    <div className="guide-feedback-block">
      <div className="guide-feedback-live" aria-live="polite" aria-atomic="true" ref={liveRef} />
      <div className="guide-feedback-stage" data-feedback-stage="" ref={stageRef}>
      <div
        className={showSettled ? 'guide-feedback is-sending' : 'guide-feedback'}
        style={showSettled ? { height: 'var(--feedback-card-receipt-height)' } : undefined}
        ref={cardRef}
        onKeyDown={onCardKeyDown}
      >
        <div className="guide-feedback-body" inert={model.phase === 'receipt' ? true : undefined}>
          <p className="guide-feedback-question" id={questionId}>
            {QUESTION}
          </p>
          <div
            className="guide-feedback-scale"
            role="radiogroup"
            aria-labelledby={questionId}
            onPointerLeave={onScaleLeave}
          >
            {RATING_WORDS.map((word, index) => {
              const value = index + 1
              const litAmount = segmentFill(lit, index)
              const previewAmount = segmentFill(preview, index)
              const selected = rating === value
              const tab = (rating === 0 ? value === 1 : selected) ? 0 : -1
              const className = [
                'guide-feedback-segment',
                litAmount >= 0.5 ? 'is-lit' : '',
                litAmount < 0.5 && previewAmount >= 0.5 ? 'is-preview' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={word}
                  type="button"
                  className={className}
                  role="radio"
                  data-rating={value}
                  aria-checked={selected}
                  aria-label={radioName(value)}
                  tabIndex={tab}
                  onClick={(event) => onRadioClick(event, value)}
                  onKeyDown={(event) => onRadioKeyDown(event, value)}
                  onPointerMove={(event) => onRadioMove(event, value)}
                >
                  <i className="guide-feedback-wash" style={{ transform: `scaleX(${previewAmount})` }} />
                  <b className="guide-feedback-fill" style={{ transform: `scaleX(${litAmount})` }} />
                  <span>{value}</span>
                </button>
              )
            })}
          </div>
          <div className="guide-feedback-ends" aria-hidden="true">
            <span>{ENDS[0]}</span>
            <span>{ENDS[1]}</span>
          </div>
          {responded ? (
            <form
              className="guide-feedback-details"
              noValidate
              onClickCapture={onDetailsClickCapture}
              onSubmit={(event) => {
                event.preventDefault()
                attemptSubmit()
              }}
            >
              <p className="guide-feedback-ask" id={askId}>
                {askText(model.rating)}
              </p>
              <div className="guide-feedback-chips" role="group" aria-labelledby={askId}>
                {chips.map((label) => (
                  <ToggleChip
                    key={label}
                    pressed={model.chips.includes(label)}
                    onPressedChange={() => setModel((current) => toggleChip(current, label))}
                  >
                    {label}
                  </ToggleChip>
                ))}
              </div>
              <div className="guide-feedback-slot">
                <button
                  type="button"
                  className="guide-feedback-link"
                  hidden={model.commentOpen}
                  aria-expanded={model.commentOpen ? 'true' : 'false'}
                  aria-controls={commentId}
                  onClick={onAddComment}
                >
                  Add a comment
                </button>
                <div
                  className="guide-feedback-comment"
                  id={commentId}
                  hidden={!model.commentOpen}
                  inert={model.commentOpen ? undefined : true}
                >
                  <TextField
                    id={fieldId}
                    ref={fieldRef}
                    label="Comment"
                    name="comment"
                    size="md"
                    value={model.comment}
                    placeholder="Anything else? (optional)"
                    hint="Press Enter to submit."
                    error={commentTooLong(model.comment) ? 'Too long to send' : ''}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                    autoComplete="off"
                    spellCheck
                    autoCapitalize="sentences"
                    enterKeyHint="send"
                    onChange={(event) => setModel((current) => setComment(current, event.target.value))}
                    onBlur={() => {
                      const current = modelRef.current
                      if (current.phase !== 'details' || current.comment.length <= COMMENT_LIMIT) return
                      focusInvalid.current = true
                      setModel((next) => revealOverLimit(next))
                    }}
                    onKeyDown={onFieldKeyDown}
                  />
                  <span className={errorShown ? 'guide-feedback-count is-over' : 'guide-feedback-count'} id={countId}>
                    {counterText(model.comment)}
                  </span>
                  <span className="guide-feedback-sr" id={leftId} aria-live="polite">
                    {charactersLeft(model.comment)}
                  </span>
                </div>
              </div>
              <div className="guide-feedback-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={(event) => clearScale(event.detail === 0)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  ref={submitRef}
                  disabled={model.phase !== 'details'}
                  aria-disabled={tooLong ? 'true' : undefined}
                  onKeyDown={onSubmitKeyDown}
                >
                  Submit
                </Button>
              </div>
            </form>
          ) : null}
        </div>
        {model.phase === 'receipt' ? (
          <div
            className="guide-feedback-receipt"
            role="group"
            aria-label="Feedback sent"
            tabIndex={-1}
            ref={receiptRef}
          >
            <span className="guide-feedback-mark" aria-hidden="true">
              <CheckIcon />
            </span>
            <span className="guide-feedback-thanks">
              Thanks for rating
              <small title={summary}>{summary}</small>
            </span>
            <button type="button" className="guide-feedback-link guide-feedback-edit" onClick={onEdit}>
              Edit
            </button>
          </div>
        ) : null}
      </div>
      <div className="guide-feedback-measure" ref={measureRef} inert aria-hidden="true">
        {MEASURE_RATINGS.map((rating) => (
          <MeasureCard key={rating} rating={rating} />
        ))}
      </div>
      </div>
    </div>
  )
}
