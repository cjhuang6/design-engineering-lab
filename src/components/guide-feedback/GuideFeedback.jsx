import { useEffect, useId, useRef, useState } from 'react'
import { cssDurationMs } from '../hex-color-picker/model.js'
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
  expireEdit,
  hoverTargets,
  initialFeedback,
  keepsCommentOnEscape,
  nextRating,
  openComment,
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

export const GUIDE_FEEDBACK_DESCRIPTION =
  'How clear was this guide? Rate it from 1 to 5, then optionally say why and leave a comment.'

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function rootValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function motionMs(name) {
  if (reducedMotion()) return 0
  return cssDurationMs(rootValue(name))
}

function pageHidden() {
  return document.hidden
}

function pauseableTimeout(ms, onDone) {
  let left = ms
  let started = Date.now()
  let timer = 0
  let stopped = false
  const remaining = () => (pageHidden() ? left : Math.max(0, left - (Date.now() - started)))
  const stop = () => {
    stopped = true
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
  const arm = () => {
    started = Date.now()
    timer = window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibility)
      onDone()
    }, left)
  }
  const onVisibility = () => {
    if (stopped) return
    if (pageHidden()) {
      window.clearTimeout(timer)
      left = remaining()
      return
    }
    arm()
  }
  document.addEventListener('visibilitychange', onVisibility)
  arm()
  return { stop, remaining }
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

function ChipMark() {
  return (
    <span className="guide-feedback-chip-mark" aria-hidden="true">
      <i />
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6.5l2.2 2.2L9.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
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
  const errorId = useId()
  const hintId = useId()
  const leftId = useId()
  const cardRef = useRef(null)
  const fieldRef = useRef(null)
  const submitRef = useRef(null)
  const receiptRef = useRef(null)
  const editRef = useRef(null)
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
  const receiptRun = useRef(0)
  const commitRef = useRef(null)
  const [lit, setLit] = useState(starting)
  const [preview, setPreview] = useState(starting)
  const [cue, setCue] = useState(starting)

  useEffect(() => {
    modelRef.current = model
    commitRef.current = setModel
  })

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
    setCue(rating)
    moveFill(rating, 0, instant)
  }

  function clearScale(instant) {
    focusScale.current = true
    setCue(0)
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

  function onRadioEnter(event, rating) {
    if (event.pointerType !== 'mouse') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const current = modelRef.current
    const selected = current.phase === 'scale' ? 0 : current.rating
    setCue(rating)
    moveFill(selected, rating, false)
  }

  function onScaleLeave() {
    const current = modelRef.current
    if (current.phase === 'receipt') return
    const selected = current.phase === 'scale' ? 0 : current.rating
    setCue(selected)
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

  function onFieldKeyDown(event) {
    if (event.key !== 'Enter' || event.repeat) return
    if (!event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    if (submitRef.current?.disabled) return
    attemptSubmit()
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
    if (!card || snapshot.phase !== 'receipt') return undefined
    let stopEdit = () => {}
    let remaining = () => 0
    const finishEdit = () => {
      const edit = editRef.current
      const receipt = receiptRef.current
      if (edit && document.activeElement === edit) receipt?.focus()
      commitRef.current?.((current) => expireEdit(current))
    }
    const armEdit = (ms) => {
      if (ms <= 0) {
        finishEdit()
        return
      }
      const handle = pauseableTimeout(ms, finishEdit)
      stopEdit = handle.stop
      remaining = handle.remaining
    }
    const run = receiptRun.current + 1
    receiptRun.current = run
    let shrinkTimer = 0
    if (snapshot.announced) {
      card.classList.add('is-sending', 'is-shrinking')
      card.style.height = rootValue('--size-receipt')
      if (snapshot.editOffered) armEdit(snapshot.editRemaining)
    } else {
      const full = card.offsetHeight
      card.style.height = `${full}px`
      card.classList.add('is-sending')
      receiptRef.current?.focus()
      announce(liveRef.current, sendAnnouncement(snapshot))
      const editWindow = cssDurationMs(rootValue('--duration-edit'))
      const exit = motionMs('--duration-fast')
      shrinkTimer = window.setTimeout(() => {
        card.classList.add('is-shrinking')
        void card.offsetHeight
        card.style.height = rootValue('--size-receipt')
      }, exit)
      armEdit(editWindow)
    }
    return () => {
      window.clearTimeout(shrinkTimer)
      const left = remaining()
      stopEdit()
      queueMicrotask(() => {
        if (receiptRun.current !== run) return
        if (modelRef.current.phase !== 'receipt') return
        commitRef.current?.((current) => {
          if (current.phase !== 'receipt') return current
          return { ...current, announced: true, editRemaining: left }
        })
      })
    }
  }, [model.phase, model.announced])

  const responded = model.phase !== 'scale'
  const rating = responded ? model.rating : 0
  const errorShown = model.phase === 'details' && model.overLimitShown
  const tooLong = responded && commentTooLong(model.comment)
  const summary = responded ? summaryText(model) : ''
  const chips = responded ? CHIPS[bandOf(model.rating)] : []

  return (
    <div className="guide-feedback-block">
      <div className="guide-feedback-live" aria-live="polite" aria-atomic="true" ref={liveRef} />
      <div className="guide-feedback" ref={cardRef} onKeyDown={onCardKeyDown}>
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
                  onPointerEnter={(event) => onRadioEnter(event, value)}
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
          <div className="guide-feedback-word" aria-hidden="true">
            <span className={cue === 0 ? 'is-on' : ''}>{'\u00a0'}</span>
            {RATING_WORDS.map((word, index) => (
              <span key={word} className={cue === index + 1 ? 'is-on' : ''}>
                {word}
              </span>
            ))}
          </div>
          {responded ? (
            <form
              className="guide-feedback-details"
              noValidate
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
                  <button
                    key={label}
                    type="button"
                    className="guide-feedback-chip"
                    aria-pressed={model.chips.includes(label)}
                    onClick={() => setModel((current) => toggleChip(current, label))}
                  >
                    <ChipMark />
                    {label}
                  </button>
                ))}
              </div>
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
                <label htmlFor={fieldId}>Comment</label>
                <textarea
                  id={fieldId}
                  ref={fieldRef}
                  className="guide-feedback-field"
                  name="comment"
                  rows={3}
                  value={model.comment}
                  placeholder="Anything else? (optional)"
                  aria-describedby={`${countId} ${errorId} ${hintId} ${leftId}`}
                  aria-invalid={errorShown ? 'true' : undefined}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                  autoComplete="off"
                  spellCheck
                  autoCapitalize="sentences"
                  enterKeyHint="enter"
                  onChange={(event) => setModel((current) => setComment(current, event.target.value))}
                  onBlur={() => {
                    const current = modelRef.current
                    if (current.phase !== 'details' || current.comment.length <= COMMENT_LIMIT) return
                    focusInvalid.current = true
                    setModel((next) => revealOverLimit(next))
                  }}
                  onKeyDown={onFieldKeyDown}
                />
                <div className="guide-feedback-meta">
                  <span className="guide-feedback-error" id={errorId} aria-live="assertive">
                    {errorShown ? 'Too long to send' : ''}
                  </span>
                  <span className={errorShown ? 'guide-feedback-count is-over' : 'guide-feedback-count'} id={countId}>
                    {counterText(model.comment)}
                  </span>
                </div>
                <span className="guide-feedback-sr" id={hintId}>
                  Press Command or Control and Enter to submit.
                </span>
                <span className="guide-feedback-sr" id={leftId} aria-live="polite">
                  {charactersLeft(model.comment)}
                </span>
              </div>
              <div className="guide-feedback-actions">
                <button
                  type="button"
                  className="guide-feedback-cancel"
                  onClick={(event) => clearScale(event.detail === 0)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="guide-feedback-send"
                  ref={submitRef}
                  disabled={model.phase !== 'details'}
                  aria-disabled={tooLong ? 'true' : undefined}
                  onClick={attemptSubmit}
                >
                  Submit
                </button>
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
            {model.editOffered ? (
              <button type="button" className="guide-feedback-link guide-feedback-edit" ref={editRef} onClick={onEdit}>
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
