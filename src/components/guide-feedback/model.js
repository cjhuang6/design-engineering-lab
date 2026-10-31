export const QUESTION = 'How clear was this guide?'
export const RATING_WORDS = ['Confusing', 'Hard to follow', 'Okay', 'Clear', 'Crystal clear']
export const ENDS = ['Confusing', 'Crystal clear']
export const COMMENT_LIMIT = 280
export const COUNTER_FROM = 200
export const POLITE_WITHIN = 20
export const CHIPS = {
  low: ['Hard to follow', 'Missing example', 'Outdated', 'Wrong token name', 'Too long'],
  mid: ['Needs an example', 'Too brief', 'Hard to find', 'Partly outdated'],
  high: ['Clear steps', 'Good examples', 'Saved me time', 'Easy to copy'],
}
export const ASK = {
  low: 'What got in the way?',
  mid: 'What would make it better?',
  high: 'What worked well?',
}

export function bandOf(rating) {
  if (rating <= 2) return 'low'
  if (rating === 3) return 'mid'
  return 'high'
}

export function askText(rating) {
  return `${ASK[bandOf(rating)]} (optional)`
}

export function wordFor(rating) {
  return RATING_WORDS[rating - 1] ?? ''
}

export function radioName(rating) {
  return `${rating} of 5, ${wordFor(rating)}`
}

export function initialFeedback() {
  return { phase: 'scale' }
}

export function rate(state, rating) {
  if (state.phase === 'receipt') return state
  if (rating < 1 || rating > 5) return state
  if (state.phase === 'scale') {
    return {
      phase: 'details',
      rating,
      chips: [],
      comment: '',
      commentOpen: false,
      overLimitShown: false,
    }
  }
  const chips = bandOf(state.rating) === bandOf(rating) ? state.chips : []
  return { ...state, rating, chips }
}

export function toggleChip(state, label) {
  if (state.phase !== 'details') return state
  const allowed = CHIPS[bandOf(state.rating)]
  if (!allowed.includes(label)) return state
  const picked = state.chips.includes(label)
    ? state.chips.filter((item) => item !== label)
    : [...state.chips, label]
  return { ...state, chips: allowed.filter((item) => picked.includes(item)) }
}

export function setComment(state, comment) {
  if (state.phase !== 'details') return state
  const overLimitShown = state.overLimitShown && comment.length > COMMENT_LIMIT
  return { ...state, comment, overLimitShown }
}

export function openComment(state) {
  if (state.phase !== 'details' || state.commentOpen) return state
  return { ...state, commentOpen: true }
}

export function revealOverLimit(state) {
  if (state.phase !== 'details' || state.comment.length <= COMMENT_LIMIT) return state
  return { ...state, overLimitShown: true }
}

export function cancelDetails(state) {
  if (state.phase !== 'details') return state
  return { phase: 'scale' }
}

export function keepsCommentOnEscape(state) {
  return state.phase === 'details' && state.comment.trim() !== ''
}

export function submitFeedback(state) {
  if (state.phase !== 'details' || state.comment.length > COMMENT_LIMIT) return state
  return {
    phase: 'receipt',
    rating: state.rating,
    chips: state.chips,
    comment: state.comment,
    commentOpen: state.commentOpen,
    editOffered: true,
    announced: false,
    editRemaining: 0,
  }
}

export function expireEdit(state) {
  if (state.phase !== 'receipt' || !state.editOffered) return state
  return { ...state, editOffered: false }
}

export function editReceipt(state) {
  if (state.phase !== 'receipt') return state
  return {
    phase: 'details',
    rating: state.rating,
    chips: state.chips,
    comment: state.comment,
    commentOpen: state.commentOpen,
    overLimitShown: false,
  }
}

export function orderedChips(state) {
  const picked = new Set(state.chips)
  return CHIPS[bandOf(state.rating)].filter((label) => picked.has(label))
}

export function summaryText(state) {
  const chips = orderedChips(state)
  const bits = [`${state.rating}/5`]
  if (chips.length > 0) {
    const extra = chips.length > 1 ? ` +${chips.length - 1}` : ''
    bits.push(`${chips[0]}${extra}`)
  } else {
    bits.push(wordFor(state.rating))
  }
  if (state.comment.trim() !== '') bits.push('with comment')
  return bits.join(' · ')
}

export function sendAnnouncement(state) {
  const summary = summaryText(state).replaceAll(' · ', ', ')
  return `Thanks for rating. ${summary}. Edit is available for 6 seconds.`
}

export function editAnnouncement() {
  return 'Editing your response. Your rating, reasons and comment are kept.'
}

export function counterText(comment) {
  const length = comment.length
  if (length < COUNTER_FROM) return ''
  const over = length - COMMENT_LIMIT
  if (over > 0) return `${length}/${COMMENT_LIMIT} · ${over} over`
  return `${length}/${COMMENT_LIMIT}`
}

export function charactersLeft(comment) {
  const length = comment.length
  if (length > COMMENT_LIMIT) return ''
  if (length < COMMENT_LIMIT - POLITE_WITHIN) return ''
  return `${COMMENT_LIMIT - length} characters left`
}

export function commentTooLong(comment) {
  return comment.length > COMMENT_LIMIT
}

export function segmentFill(cursor, index) {
  return Math.min(1, Math.max(0, cursor - index))
}

export function smoothstep(amount) {
  if (amount <= 0) return 0
  if (amount >= 1) return 1
  return amount < 0.5 ? 2 * amount * amount : 1 - ((-2 * amount + 2) ** 2) / 2
}

export function nextRating(fromRating, key) {
  const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[key]
  if (delta) return Math.min(5, Math.max(1, fromRating + delta))
  if (key === 'Home') return 1
  if (key === 'End') return 5
  if (key >= '1' && key <= '5') return Number(key)
  return null
}

export function hoverTargets(rating, hoverRating) {
  const drain = hoverRating > 0 && hoverRating < rating
  return {
    lit: drain ? hoverRating : rating,
    preview: Math.max(rating, hoverRating),
  }
}
