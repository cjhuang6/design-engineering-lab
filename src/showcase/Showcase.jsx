import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGuideFeedbackBlock, useHexBlock, useSlotCodeBlock } from './blocks.jsx'
import {
  closeMotion,
  expandedFrame,
  feedColumnPlan,
  frameFromStyle,
  isMobileWidth,
  masonrySpan,
  mobileFrame,
  motionFromStyle,
  openPanelDelay,
  overlapWindow,
  uniformScale,
} from './layout.js'
import './showcase.css'

function rootStyle() {
  return getComputedStyle(document.documentElement)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function paddingOf(style) {
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  }
}

function stagePoint(rect, origin, scrollTop) {
  return {
    x: rect.x - origin.left,
    y: rect.y - origin.top + scrollTop,
    w: rect.w,
    h: rect.h,
  }
}

function cardFrames(from, to, fromPad, toPad) {
  return [
    {
      left: `${from.x}px`,
      top: `${from.y}px`,
      width: `${from.w}px`,
      height: `${from.h}px`,
      paddingTop: `${fromPad.top}px`,
      paddingRight: `${fromPad.right}px`,
      paddingBottom: `${fromPad.bottom}px`,
      paddingLeft: `${fromPad.left}px`,
    },
    {
      left: `${to.x}px`,
      top: `${to.y}px`,
      width: `${to.w}px`,
      height: `${to.h}px`,
      paddingTop: `${toPad.top}px`,
      paddingRight: `${toPad.right}px`,
      paddingBottom: `${toPad.bottom}px`,
      paddingLeft: `${toPad.left}px`,
    },
  ]
}

function panelFrames(fromScale) {
  return [
    { opacity: 0, transform: `scale(${fromScale})` },
    { opacity: 1, transform: 'scale(1)' },
  ]
}

function fitTransform(scale) {
  return `translate(-50%, -50%) scale(${scale})`
}

function applyCard(card, fit, box, padding, scale) {
  card.style.left = `${box.x}px`
  card.style.top = `${box.y}px`
  card.style.width = `${box.w}px`
  card.style.height = `${box.h}px`
  card.style.paddingTop = `${padding.top}px`
  card.style.paddingRight = `${padding.right}px`
  card.style.paddingBottom = `${padding.bottom}px`
  card.style.paddingLeft = `${padding.left}px`
  fit.style.transform = fitTransform(scale)
}

function applyPanel(panel, box) {
  panel.style.left = `${box.x}px`
  panel.style.top = `${box.y}px`
  panel.style.width = `${box.w}px`
  panel.style.height = `${box.h}px`
}

function readSafeArea(probe) {
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 }
  const style = getComputedStyle(probe)
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  }
}

function markFeed(mobile) {
  if (mobile) document.documentElement.setAttribute('data-showcase-feed', '')
  else document.documentElement.removeAttribute('data-showcase-feed')
}

// iOS Safari rubber-bands a page that only sets overflow:hidden.
function lockPageScroll(lockRef) {
  if (lockRef.current != null) return
  const y = window.scrollY || window.pageYOffset || 0
  const bar = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
  document.documentElement.classList.add('showcase-scroll-lock')
  document.body.style.top = `-${y}px`
  document.body.style.paddingRight = bar > 0 ? `${bar}px` : ''
  lockRef.current = y
}

function unlockPageScroll(lockRef) {
  if (lockRef.current == null) return
  const y = lockRef.current
  lockRef.current = null
  const root = document.documentElement
  root.style.overflowAnchor = 'none'
  root.classList.remove('showcase-scroll-lock')
  document.body.style.top = ''
  document.body.style.paddingRight = ''
  // Chrome ignores scrollTo until it has laid out the body without position:fixed,
  // then scroll anchoring shifts the restored offset.
  void root.offsetHeight
  window.scrollTo(0, y)
  requestAnimationFrame(() => {
    root.style.overflowAnchor = ''
  })
}

function tabbables(root) {
  return [...root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((node) => {
    if (node.hasAttribute('disabled') || node.closest('[hidden]')) return false
    if (node.tabIndex < 0) return false
    const style = getComputedStyle(node)
    return style.visibility !== 'hidden' && style.display !== 'none'
  })
}

function markPanelScrolled(event) {
  const scroller = event.currentTarget
  const panel = scroller?.closest?.('.showcase-panel')
  if (!panel) return
  const scrolled = scroller.scrollTop > 0
  if (panel.hasAttribute('data-scrolled') === scrolled) return
  if (scrolled) panel.setAttribute('data-scrolled', '')
  else panel.removeAttribute('data-scrolled')
}

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function Card({ block, open, cardRef, fitRef, onOpen }) {
  return (
    <article className="showcase-card" data-open={open ? '' : undefined} ref={cardRef}>
      <div className="showcase-card-viewport">
        <div className="showcase-card-fit" ref={fitRef}>
          {block.content}
        </div>
      </div>
      <div className="showcase-actions" hidden={open || undefined}>
        <span className="showcase-name" aria-hidden="true">
          {block.name}
        </span>
        <button
          type="button"
          className="showcase-icon"
          data-showcase-trigger={block.id}
          aria-haspopup="dialog"
          aria-label={`Open ${block.name} details`}
          onClick={onOpen}
        >
          <MaximizeIcon />
        </button>
      </div>
    </article>
  )
}

function Slot({ block, reserved, onBeforeMeasure, onOpen }) {
  const cardRef = useRef(null)
  const fitRef = useRef(null)

  function handleOpen() {
    const card = cardRef.current
    const fit = fitRef.current
    if (!card || !fit) return
    onBeforeMeasure()
    const rect = card.getBoundingClientRect()
    const padding = paddingOf(getComputedStyle(card))
    const natural = { w: fit.offsetWidth, h: fit.offsetHeight }
    const feedScale = Number.parseFloat(fit.getAttribute('data-feed-scale'))
    onOpen({
      from: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      natural,
      feedScale: Number.isFinite(feedScale) && feedScale > 0 ? feedScale : 1,
      restPadding: padding,
      slotHeight: card.offsetHeight,
    })
  }

  return (
    <div
      className="showcase-slot"
      data-showcase-slot={block.id}
      style={reserved == null ? undefined : { height: reserved }}
    >
      {reserved == null ? (
        <Card block={block} open={false} cardRef={cardRef} fitRef={fitRef} onOpen={handleOpen} />
      ) : null}
    </div>
  )
}

export function Showcase({ blocks: blocksProp }) {
  const hex = useHexBlock()
  const slotCode = useSlotCodeBlock()
  const guideFeedback = useGuideFeedbackBlock()
  const blocks = blocksProp ?? [slotCode, hex, guideFeedback]
  const [session, setSession] = useState(null)
  const pendingClose = useRef(false)
  const returnFocusId = useRef(null)
  const gridRef = useRef(null)
  const dialogRef = useRef(null)
  const cardRef = useRef(null)
  const fitRef = useRef(null)
  const panelRef = useRef(null)
  const scrimRef = useRef(null)
  const titleRef = useRef(null)
  const stageRef = useRef(null)
  const naturals = useRef(new Map())
  const measureRef = useRef(() => {})
  const closeRef = useRef(() => {})
  const sessionRef = useRef(null)
  const placedRef = useRef(null)
  const relayoutRef = useRef(() => {})
  const scrollLock = useRef(null)
  const safeProbeRef = useRef(null)
  const titleId = useId()
  const descId = useId()
  const active = session ? blocks.find((block) => block.id === session.id) : null

  function openBlock(id, measurement) {
    if (sessionRef.current) return
    pendingClose.current = false
    const next = { id, phase: 'opening', measurement }
    sessionRef.current = next
    setSession(next)
  }

  function requestClose() {
    setSession((current) => {
      if (!current || current.phase === 'closing') return current
      returnFocusId.current = current.id
      if (current.phase === 'opening') {
        pendingClose.current = true
        return current
      }
      return { ...current, phase: 'closing' }
    })
  }

  function readNatural(fit) {
    const width = fit.style.width
    const maxWidth = fit.style.maxWidth
    fit.style.width = 'max-content'
    fit.style.maxWidth = 'none'
    const size = { w: fit.offsetWidth, h: fit.offsetHeight }
    fit.style.width = width
    fit.style.maxWidth = maxWidth
    return size
  }

  function settleNatural(id, next) {
    const previous = naturals.current.get(id)
    const settled =
      previous && Math.abs(previous.w - next.w) <= 1 && Math.abs(previous.h - next.h) <= 1 ? previous : next
    naturals.current.set(id, settled)
    return settled
  }

  function clearFeedFit(viewport, fit) {
    viewport.removeAttribute('data-feed-fit')
    viewport.style.height = ''
    fit.style.transform = ''
    fit.removeAttribute('data-feed-scale')
  }

  function parkFeedFit(viewport, fit, natural, scale) {
    viewport.setAttribute('data-feed-fit', '')
    viewport.style.height = `${Math.round(natural.h * scale)}px`
    fit.style.transform = `translateX(-50%) scale(${scale})`
    fit.setAttribute('data-feed-scale', String(scale))
  }

  function measureGrid() {
    const grid = gridRef.current
    if (!grid) return
    const style = rootStyle()
    const tokens = frameFromStyle(style)
    const rowValue = Number.parseFloat(style.getPropertyValue('--showcase-masonry-row'))
    const row = rowValue > 0 ? rowValue : 1
    const slots = [...grid.querySelectorAll('[data-showcase-slot]')]
    const mobile = isMobileWidth(window.innerWidth, tokens.breakpointSm)
    markFeed(mobile)
    const measured = []
    for (const slot of slots) {
      const id = slot.getAttribute('data-showcase-slot')
      const fit = slot.querySelector('.showcase-card-fit')
      const card = slot.querySelector('.showcase-card')
      const viewport = slot.querySelector('.showcase-card-viewport')
      if (fit && card && viewport) {
        const natural = settleNatural(id, readNatural(fit))
        measured.push({ card, fit, viewport, natural })
      }
    }
    let widest = 0
    for (const size of naturals.current.values()) widest = Math.max(widest, size.w)
    const gap = mobile ? tokens.space4 : tokens.space6
    const available = grid.clientWidth
    const plan = mobile
      ? { columns: 1, scale: 1, padding: tokens.space4 }
      : feedColumnPlan(available, gap, widest, { padding: tokens.space6, tightPadding: tokens.space4 })
    const track = plan.columns > 0 ? (available - gap * (plan.columns - 1)) / plan.columns : available
    // external: browsers read inline style 0 back as 0px, so the settle loop compares normalized values.
    grid.style.gridTemplateColumns = `repeat(${plan.columns}, minmax(0, 1fr))`
    for (const item of measured) {
      const tight = !mobile && plan.padding < tokens.space6 - 0.5
      if (tight) item.card.setAttribute('data-feed-pad', 'tight')
      else item.card.removeAttribute('data-feed-pad')
      const inner = track - (mobile ? tokens.space4 : plan.padding) * 2
      const scale = !mobile && item.natural.w > 0 && inner > 0 ? Math.min(1, inner / item.natural.w) : 1
      if (!mobile && scale < 1 - 1e-4) parkFeedFit(item.viewport, item.fit, item.natural, scale)
      else clearFeedFit(item.viewport, item.fit)
    }
    for (const slot of slots) {
      slot.style.gridRowEnd = `span ${masonrySpan(slot.offsetHeight, gap, row)}`
    }
  }

  function placedFrame(measurement) {
    const layer = dialogRef.current
    const stage = stageRef.current
    const tokens = frameFromStyle(rootStyle())
    const motion = motionFromStyle(rootStyle())
    const viewport = { width: layer.clientWidth, height: layer.clientHeight }
    const mobile = isMobileWidth(window.innerWidth, tokens.breakpointSm)
    layer.setAttribute('data-mode', mobile ? 'mobile' : 'desktop')
    const frame = mobile
      ? mobileFrame(viewport, tokens, readSafeArea(safeProbeRef.current))
      : expandedFrame(viewport, tokens)
    const origin = stage.getBoundingClientRect()
    const scrollTop = layer.scrollTop || 0
    const shift = (box) => stagePoint(box, origin, scrollTop)
    const card = shift(frame.card)
    const panel = shift(frame.panel)
    const from = shift(measurement.from)
    const padding = { top: tokens.space6, right: tokens.space6, bottom: tokens.space6, left: tokens.space6 }
    const scale = uniformScale(measurement.natural, {
      w: card.w - padding.left - padding.right,
      h: card.h - padding.top - padding.bottom,
    })
    if (mobile) {
      stage.style.minHeight = ''
    } else {
      const bottom = Math.max(card.y + card.h, panel.y + panel.h)
      stage.style.minHeight = `${Math.max(layer.clientHeight, bottom + tokens.space8)}px`
    }
    return { card, panel, from, padding, scale, motion }
  }

  function rememberPlace(placed) {
    placedRef.current = {
      card: placed.card,
      panel: placed.panel,
      padding: placed.padding,
      scale: placed.scale,
    }
  }

  function applyRemembered() {
    const placed = placedRef.current
    if (!placed || !cardRef.current || !fitRef.current || !panelRef.current) return
    applyCard(cardRef.current, fitRef.current, placed.card, placed.padding, placed.scale)
    applyPanel(panelRef.current, placed.panel)
    if (scrimRef.current) scrimRef.current.style.opacity = '1'
    panelRef.current.style.opacity = '1'
    panelRef.current.style.transform = 'none'
  }

  function relayoutOpen() {
    const current = sessionRef.current
    if (current?.phase !== 'open' || !dialogRef.current) return
    rememberPlace(placedFrame(current.measurement))
    applyRemembered()
  }

  useLayoutEffect(() => {
    sessionRef.current = session
    closeRef.current = requestClose
    measureRef.current = measureGrid
    relayoutRef.current = relayoutOpen
    measureGrid()
    if (session?.phase === 'open') applyRemembered()
  })

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return undefined
    const run = () => {
      measureRef.current()
      relayoutRef.current()
    }
    const observer = new ResizeObserver(run)
    observer.observe(grid)
    window.addEventListener('resize', run)
    const visual = window.visualViewport
    if (visual) visual.addEventListener('resize', run)
    let cancelFonts = false
    const fontsReady = document.fonts?.ready
    if (fontsReady && typeof fontsReady.then === 'function') {
      fontsReady.then(() => {
        if (!cancelFonts) measureRef.current()
      })
    }
    return () => {
      cancelFonts = true
      observer.disconnect()
      window.removeEventListener('resize', run)
      if (visual) visual.removeEventListener('resize', run)
      markFeed(false)
    }
  }, [])

  useLayoutEffect(() => {
    const header = document.querySelector('.showcase-bar')
    const page = document.querySelector('.showcase-page')
    if (session) {
      lockPageScroll(scrollLock)
      if (header) header.inert = true
      if (page) page.inert = true
      return undefined
    }
    if (header) header.inert = false
    if (page) page.inert = false
    unlockPageScroll(scrollLock)
    const id = returnFocusId.current
    if (!id) return undefined
    returnFocusId.current = null
    document.querySelector(`[data-showcase-trigger="${id}"]`)?.focus({ preventScroll: true })
    return undefined
  }, [session])

  useLayoutEffect(() => {
    if (!session || !dialogRef.current || !cardRef.current || !fitRef.current || !panelRef.current || !scrimRef.current) {
      return undefined
    }
    const card = cardRef.current
    const fit = fitRef.current
    const panel = panelRef.current
    const scrim = scrimRef.current
    const measurement = session.measurement
    const fromScale = measurement.feedScale > 0 ? measurement.feedScale : 1
    const reduced = prefersReducedMotion()
    const animations = []
    const play = (element, keyframes, options) => {
      const animation = element.animate(keyframes, { fill: 'both', ...options })
      animations.push(animation)
      return animation
    }
    let cancelled = false

    if (session.phase === 'opening') {
      const placed = placedFrame(measurement)
      applyPanel(panel, placed.panel)
      if (reduced) {
        applyCard(card, fit, placed.card, placed.padding, placed.scale)
        play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: placed.motion.fade, easing: 'linear' })
        play(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: placed.motion.fade, easing: 'linear' })
      } else {
        const overlap = overlapWindow(placed.from, placed.card, placed.panel, placed.motion.card, placed.motion.ease)
        const delay = openPanelDelay(placed.motion.panelDelay, overlap)
        applyCard(card, fit, placed.from, measurement.restPadding, fromScale)
        play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: placed.motion.card, easing: 'linear' })
        play(card, cardFrames(placed.from, placed.card, measurement.restPadding, placed.padding), {
          duration: placed.motion.card,
          easing: placed.motion.ease,
        })
        play(fit, [{ transform: fitTransform(fromScale) }, { transform: fitTransform(placed.scale) }], {
          duration: placed.motion.card,
          easing: placed.motion.ease,
        })
        play(panel, panelFrames(placed.motion.panelFrom), {
          duration: placed.motion.panelDuration,
          delay,
          easing: placed.motion.ease,
        })
      }
      titleRef.current?.focus({ preventScroll: true, focusVisible: false })
      Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(() => {
        if (cancelled) return
        animations.forEach((animation) => animation.cancel())
        const finalPlace = placedFrame(measurement)
        rememberPlace(finalPlace)
        applyCard(card, fit, finalPlace.card, finalPlace.padding, finalPlace.scale)
        applyPanel(panel, finalPlace.panel)
        scrim.style.opacity = '1'
        panel.style.opacity = '1'
        panel.style.transform = 'none'
        if (pendingClose.current) {
          pendingClose.current = false
          setSession((current) => (current ? { ...current, phase: 'closing' } : current))
        } else {
          setSession((current) => (current && current.phase === 'opening' ? { ...current, phase: 'open' } : current))
        }
      })
    }

    if (session.phase === 'closing') {
      const placed = placedFrame(measurement)
      const slot = document.querySelector(`[data-showcase-slot="${session.id}"]`)
      const origin = stageRef.current.getBoundingClientRect()
      const slotRect = slot.getBoundingClientRect()
      const home = stagePoint(
        { x: slotRect.left, y: slotRect.top, w: slotRect.width, h: slotRect.height },
        origin,
        dialogRef.current.scrollTop || 0,
      )
      if (reduced) {
        play(panel, [{ opacity: 1 }, { opacity: 0 }], { duration: placed.motion.fade, easing: 'linear' })
        play(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: placed.motion.fade, easing: 'linear' })
      } else {
        const cardDuration = Math.round(placed.motion.card * placed.motion.closeRate)
        const overlap = overlapWindow(placed.card, home, placed.panel, cardDuration, placed.motion.ease)
        const timing = closeMotion(
          placed.motion.panelDelay,
          placed.motion.panelDuration,
          placed.motion.card,
          placed.motion.closeRate,
          overlap,
        )
        play(panel, panelFrames(placed.motion.panelFrom), {
          duration: timing.panelDuration,
          delay: timing.panelDelay,
          easing: placed.motion.ease,
          direction: 'reverse',
        })
        play(card, cardFrames(placed.card, home, placed.padding, measurement.restPadding), {
          duration: timing.cardDuration,
          delay: timing.cardDelay,
          easing: placed.motion.ease,
        })
        play(fit, [{ transform: fitTransform(placed.scale) }, { transform: fitTransform(fromScale) }], {
          duration: timing.cardDuration,
          delay: timing.cardDelay,
          easing: placed.motion.ease,
        })
        play(scrim, [{ opacity: 1 }, { opacity: 0 }], {
          duration: timing.scrimDuration,
          delay: timing.scrimDelay,
          easing: 'linear',
        })
      }
      Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(() => {
        if (cancelled) return
        const keepFinishedFillOnClose = (current) =>
          current && current.phase === 'closing' ? null : current
        setSession(keepFinishedFillOnClose)
      })
    }

    return () => {
      cancelled = true
      animations.forEach((animation) => animation.cancel())
    }
  }, [session])

  useEffect(() => {
    return () => unlockPageScroll(scrollLock)
  }, [])

  useEffect(() => {
    const layer = dialogRef.current
    if (!session || !layer) return undefined
    function onTouchMove(event) {
      if (layer.getAttribute('data-mode') !== 'mobile') return
      if (event.touches && event.touches.length > 1) return
      const target = event.target
      if (target && typeof target.closest === 'function') {
        const scroller = target.closest('[data-showcase-panel-scroll]')
        if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) return
        if (target.closest('.hex-picker-slider, .showcase-slider')) return
      }
      event.preventDefault()
    }
    layer.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => layer.removeEventListener('touchmove', onTouchMove)
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    function onKey(event) {
      const dialog = dialogRef.current
      if (!dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = tabbables(dialog)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const index = items.indexOf(document.activeElement)
      if (index === -1) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && index === 0) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && index === items.length - 1) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [session])

  const mobileOpen = isMobileWidth(window.innerWidth, frameFromStyle(rootStyle()).breakpointSm)

  return (
    <main className="showcase-page">
      <div className="showcase-safe-probe" ref={safeProbeRef} aria-hidden="true" />
      <div className="showcase-main">
        <h1 className="showcase-sr">Blocks</h1>
        <div className="showcase-grid" ref={gridRef}>
          {blocks.map((block) => (
            <Slot
              key={block.id}
              block={block}
              reserved={session?.id === block.id ? session.measurement.slotHeight : null}
              onBeforeMeasure={() => {
                if (sessionRef.current) return
                lockPageScroll(scrollLock)
              }}
              onOpen={(measurement) => openBlock(block.id, measurement)}
            />
          ))}
        </div>
      </div>
      {active
        ? createPortal(
            <div
              className="showcase-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              data-mode={mobileOpen ? 'mobile' : 'desktop'}
              ref={dialogRef}
            >
              <div className="showcase-scrim" ref={scrimRef} onClick={requestClose} />
              <div
                className="showcase-stage"
                ref={stageRef}
                onClick={(event) => {
                  if (event.target === event.currentTarget) requestClose()
                }}
              >
                <Card block={active} open cardRef={cardRef} fitRef={fitRef} />
                <div className="showcase-panel" ref={panelRef}>
                  <div className="showcase-panel-body">
                    <div className="showcase-panel-head">
                      <h2 id={titleId} tabIndex={-1} ref={titleRef}>
                        {active.name}
                      </h2>
                      <button type="button" className="showcase-icon" aria-label="Close" onClick={requestClose}>
                        <CloseIcon />
                      </button>
                    </div>
                    <div className="showcase-panel-scroll" data-showcase-panel-scroll="" onScroll={markPanelScrolled}>
                      <p id={descId} className="note">
                        {active.description}
                      </p>
                      {active.controls}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  )
}
