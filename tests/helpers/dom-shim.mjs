const VARS = {
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '20px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--space-24': '96px',
  '--size-content-sm': '640px',
  '--size-content-md': '960px',
  '--breakpoint-sm': '640px',
  '--duration-fast': '100ms',
  '--duration-normal': '200ms',
  '--ease-enter': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
  '--showcase-masonry-row': '1px',
  '--showcase-hit': '44px',
  '--showcase-card-move': '250ms',
  '--showcase-panel-duration': '150ms',
  '--showcase-panel-scale-from': '0.97',
  '--showcase-close-rate': '0.8',
  '--hex-picker-scale-hover': '1.15',
  '--hex-picker-darken': '0',
  '--hex-picker-radius': '80px',
  '--color-base-white': '#ffffff',
  '--color-primitive-ice-900': '#0e1c36',
}

const FOCUSABLE = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'])

function createStyle() {
  const style = {}
  const define = (name, value) => {
    Object.defineProperty(style, name, { value, enumerable: false })
  }
  define('setProperty', (name, value) => {
    style[name] = value == null ? '' : String(value)
  })
  define('getPropertyValue', (name) => (style[name] == null ? '' : String(style[name])))
  define('removeProperty', (name) => {
    const previous = style[name] ?? ''
    style[name] = ''
    return previous
  })
  return style
}

function boxFor(element) {
  const cls = element.className || ''
  if (cls.includes('showcase-layer') || cls.includes('showcase-stage')) return { x: 0, y: 0, w: 1280, h: 800 }
  if (cls.includes('showcase-card-fit')) return { x: 144, y: 184, w: 260, h: 300 }
  if (cls.includes('showcase-card')) return { x: 120, y: 160, w: 340, h: 460 }
  if (cls.includes('showcase-slot') || cls.includes('showcase-grid')) return { x: 80, y: 120, w: 1100, h: 460 }
  if (cls.includes('showcase-panel')) return { x: 720, y: 160, w: 320, h: 460 }
  if (cls.includes('hex-picker-cell')) return { x: 0, y: 0, w: 40, h: 46 }
  return { x: 0, y: 0, w: 120, h: 40 }
}

function rectOf(element) {
  const box = boxFor(element)
  const left = Number.parseFloat(element.style.left)
  const top = Number.parseFloat(element.style.top)
  const width = Number.parseFloat(element.style.width)
  const height = Number.parseFloat(element.style.height)
  const x = Number.isFinite(left) ? left : box.x
  const y = Number.isFinite(top) ? top : box.y
  const w = Number.isFinite(width) ? width : box.w
  const h = Number.isFinite(height) ? height : box.h
  return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h }
}

function captureFlag(options) {
  return options === true || (options != null && options.capture === true)
}

class DomEvent {
  constructor(type, init = {}) {
    this.type = type
    this.bubbles = init.bubbles ?? true
    this.cancelable = init.cancelable ?? true
    this.defaultPrevented = false
    this.target = null
    this.currentTarget = null
    this.eventPhase = 0
    this.timeStamp = Date.now()
    this.key = init.key
    this.code = init.code ?? init.key ?? ''
    this.shiftKey = !!init.shiftKey
    this.altKey = !!init.altKey
    this.ctrlKey = !!init.ctrlKey
    this.metaKey = !!init.metaKey
    this.repeat = !!init.repeat
    this.button = init.button ?? 0
    this.buttons = init.buttons ?? 0
    this.detail = init.detail ?? 1
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
    this.pointerId = init.pointerId ?? 1
    this.pointerType = init.pointerType ?? ''
    this.touches = init.touches ?? []
    this.view = globalThis.window ?? null
    this.isTrusted = false
    this._stopped = false
    this._immediate = false
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true
  }

  stopPropagation() {
    this._stopped = true
  }

  stopImmediatePropagation() {
    this._stopped = true
    this._immediate = true
  }

  getModifierState() {
    return false
  }
}

function fire(node, event, capture) {
  const list = node._listeners?.get(event.type)
  if (!list) return
  for (const item of [...list]) {
    if (event._immediate) return
    if (item.capture !== capture) continue
    event.currentTarget = node
    item.fn.call(node, event)
  }
}

class Node {
  constructor() {
    this.parentNode = null
    this.childNodes = []
    this.ownerDocument = null
    this.nodeType = 0
    this.nodeName = ''
    this._listeners = new Map()
  }

  get firstChild() {
    return this.childNodes[0] ?? null
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null
  }

  get nextSibling() {
    const siblings = this.parentNode?.childNodes
    if (!siblings) return null
    const index = siblings.indexOf(this)
    return siblings[index + 1] ?? null
  }

  get previousSibling() {
    const siblings = this.parentNode?.childNodes
    if (!siblings) return null
    const index = siblings.indexOf(this)
    return siblings[index - 1] ?? null
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null
  }

  get isConnected() {
    let node = this
    while (node) {
      if (node.nodeType === 9) return true
      node = node.parentNode
    }
    return false
  }

  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.data ?? ''
    return this.childNodes.map((child) => child.textContent ?? '').join('')
  }

  set textContent(value) {
    if (this.nodeType === 3 || this.nodeType === 8) {
      this.data = value == null ? '' : String(value)
      this.nodeValue = this.data
      return
    }
    for (const child of [...this.childNodes]) this.removeChild(child)
    if (value != null && value !== '') {
      const text = this.ownerDocument?.createTextNode(String(value))
      if (text) this.appendChild(text)
    }
  }

  contains(node) {
    let current = node
    while (current) {
      if (current === this) return true
      current = current.parentNode
    }
    return false
  }

  hasChildNodes() {
    return this.childNodes.length > 0
  }

  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node)
    node.parentNode = this
    this.childNodes.push(node)
    return node
  }

  insertBefore(node, ref) {
    if (ref == null) return this.appendChild(node)
    if (node === ref) return node
    if (node.parentNode) node.parentNode.removeChild(node)
    const index = this.childNodes.indexOf(ref)
    if (index < 0) throw new Error('NotFoundError')
    node.parentNode = this
    this.childNodes.splice(index, 0, node)
    return node
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node)
    if (index < 0) throw new Error('NotFoundError')
    this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  replaceChild(node, ref) {
    this.insertBefore(node, ref)
    return this.removeChild(ref)
  }

  addEventListener(type, fn, options) {
    if (typeof fn !== 'function') return
    const capture = captureFlag(options)
    const list = this._listeners.get(type) ?? []
    if (list.some((item) => item.fn === fn && item.capture === capture)) return
    list.push({ fn, capture })
    this._listeners.set(type, list)
  }

  removeEventListener(type, fn, options) {
    const capture = captureFlag(options)
    const list = this._listeners.get(type) ?? []
    this._listeners.set(
      type,
      list.filter((item) => item.fn !== fn || item.capture !== capture),
    )
  }

  dispatchEvent(event) {
    const path = []
    let node = this
    while (node) {
      path.push(node)
      node = node.parentNode
    }
    event.target = this
    for (let index = path.length - 1; index >= 0; index -= 1) {
      if (event._stopped) return !event.defaultPrevented
      event.eventPhase = index === 0 ? 2 : 1
      fire(path[index], event, true)
    }
    if (event.bubbles) {
      for (let index = 0; index < path.length; index += 1) {
        if (event._stopped) return !event.defaultPrevented
        event.eventPhase = index === 0 ? 2 : 3
        fire(path[index], event, false)
      }
    }
    return !event.defaultPrevented
  }

  compareDocumentPosition() {
    return 0
  }

  getRootNode() {
    return this.isConnected ? this.ownerDocument : this
  }
}

class Element extends Node {
  constructor(tag, namespaceURI = null) {
    super()
    this.nodeType = 1
    this.namespaceURI = namespaceURI
    this.tagName = namespaceURI ? String(tag) : String(tag).toUpperCase()
    this.nodeName = this.tagName
    this.style = createStyle()
    this.attributes = new Map()
    this.scrollTop = 0
    this.scrollLeft = 0
    this.inert = false
  }

  get dataset() {
    if (this._dataset) return this._dataset
    const element = this
    const attrName = (prop) => `data-${String(prop).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
    this._dataset = new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop !== 'string') return undefined
          const value = element.getAttribute(attrName(prop))
          return value == null ? undefined : value
        },
        set(_target, prop, value) {
          if (typeof prop !== 'string') return false
          if (value == null) element.removeAttribute(attrName(prop))
          else element.setAttribute(attrName(prop), String(value))
          return true
        },
      },
    )
    return this._dataset
  }

  get className() {
    return this.getAttribute('class') ?? ''
  }

  set className(value) {
    this.setAttribute('class', value == null ? '' : String(value))
  }

  get id() {
    return this.getAttribute('id') ?? ''
  }

  set id(value) {
    this.setAttribute('id', value == null ? '' : String(value))
  }

  get classList() {
    const element = this
    const tokens = () => (element.className ? element.className.split(/\s+/).filter(Boolean) : [])
    return {
      contains: (name) => tokens().includes(name),
      add: (...names) => {
        element.className = [...new Set([...tokens(), ...names])].join(' ')
      },
      remove: (...names) => {
        element.className = tokens().filter((token) => !names.includes(token)).join(' ')
      },
    }
  }

  get tabIndex() {
    if (this.hasAttribute('tabindex')) return Number(this.getAttribute('tabindex'))
    return FOCUSABLE.has(this.tagName) ? 0 : -1
  }

  set tabIndex(value) {
    if (value == null) this.removeAttribute('tabindex')
    else this.setAttribute('tabindex', String(value))
  }

  get value() {
    return this._value ?? ''
  }

  set value(next) {
    this._value = next == null ? '' : String(next)
  }

  get valueAsNumber() {
    const number = Number(this.value)
    return Number.isFinite(number) ? number : Number.NaN
  }

  set valueAsNumber(next) {
    this.value = String(next)
  }

  get hidden() {
    return this.hasAttribute('hidden')
  }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '')
    else this.removeAttribute('hidden')
  }

  setAttribute(name, value) {
    this.attributes.set(String(name).toLowerCase(), value == null ? '' : String(value))
  }

  getAttribute(name) {
    const key = String(name).toLowerCase()
    return this.attributes.has(key) ? this.attributes.get(key) : null
  }

  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase())
  }

  removeAttribute(name) {
    this.attributes.delete(String(name).toLowerCase())
  }

  setAttributeNS(_namespace, name, value) {
    this.setAttribute(name, value)
  }

  getAttributeNS(_namespace, name) {
    return this.getAttribute(name)
  }

  removeAttributeNS(_namespace, name) {
    this.removeAttribute(name)
  }

  matches(selector) {
    return matches(this, selector)
  }

  closest(selector) {
    let node = this
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node
      node = node.parentElement
    }
    return null
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector) {
    return queryAll(this, selector)
  }

  getElementsByTagName(tag) {
    const wanted = String(tag).toUpperCase()
    return collect(this).filter((element) => wanted === '*' || element.tagName.toUpperCase() === wanted)
  }

  getBoundingClientRect() {
    return rectOf(this)
  }

  get clientWidth() {
    if (this.ownerDocument && this === this.ownerDocument.documentElement) {
      return Math.max(0, window.innerWidth - (globalThis.__showcaseScrollbar || 0))
    }
    if (this.className.includes('showcase-grid')) return Math.max(0, window.innerWidth - 32)
    if (this.className.includes('showcase-layer')) return window.innerWidth
    return rectOf(this).width
  }

  get clientHeight() {
    if (this.className.includes('showcase-layer')) return window.innerHeight
    return rectOf(this).height
  }

  get scrollHeight() {
    let children = 0
    for (const child of this.childNodes) {
      if (child.nodeType === 1) children += child.offsetHeight
    }
    return Math.max(this.clientHeight, children)
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  get offsetWidth() {
    if (this.className.includes('showcase-card-fit')) {
      return typeof globalThis.__showcaseFitWidth === 'number' ? globalThis.__showcaseFitWidth : 260
    }
    return rectOf(this).width
  }

  get offsetHeight() {
    const styled = Number.parseFloat(this.style.height)
    if (Number.isFinite(styled) && styled > 0) return styled
    return rectOf(this).height
  }

  focus() {
    const explicit = this.hasAttribute('tabindex')
    const natural = FOCUSABLE.has(this.tagName)
    if ((!explicit && !natural) || this.hasAttribute('disabled')) return
    if (this.ownerDocument) this.ownerDocument.activeElement = this
    this.dispatchEvent(new DomEvent('focus', { bubbles: false }))
  }

  blur() {
    if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body
  }

  click() {
    this.dispatchEvent(new DomEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 }))
  }

  get innerHTML() {
    return ''
  }

  set innerHTML(_value) {
    for (const child of [...this.childNodes]) this.removeChild(child)
  }

  remove() {
    this.parentNode?.removeChild(this)
  }
}

class HTMLElement extends Element {}

class HTMLIFrameElement extends HTMLElement {}

class SVGElement extends Element {
  constructor(tag) {
    super(tag, 'http://www.w3.org/2000/svg')
  }
}

class TextNode extends Node {
  constructor(text) {
    super()
    this.nodeType = 3
    this.nodeName = '#text'
    this.data = String(text)
  }

  get nodeValue() {
    return this.data
  }

  set nodeValue(value) {
    this.data = value == null ? '' : String(value)
  }
}

class CommentNode extends Node {
  constructor(text) {
    super()
    this.nodeType = 8
    this.nodeName = '#comment'
    this.data = String(text)
  }

  get nodeValue() {
    return this.data
  }

  set nodeValue(value) {
    this.data = value == null ? '' : String(value)
  }
}

class DocumentFragment extends Node {
  constructor() {
    super()
    this.nodeType = 11
    this.nodeName = '#document-fragment'
  }
}

class DocumentNode extends Node {
  constructor() {
    super()
    this.nodeType = 9
    this.nodeName = '#document'
    this.ownerDocument = this
    this.defaultView = null
    this.documentElement = new HTMLElement('html')
    this.head = new HTMLElement('head')
    this.body = new HTMLElement('body')
    for (const element of [this.documentElement, this.head, this.body]) element.ownerDocument = this
    this.appendChild(this.documentElement)
    this.documentElement.appendChild(this.head)
    this.documentElement.appendChild(this.body)
    this.activeElement = this.body
    this.compatMode = 'CSS1Compat'
    this.readyState = 'complete'
    this.visibilityState = 'visible'
  }

  createElement(tag) {
    const element = new HTMLElement(tag)
    element.ownerDocument = this
    return element
  }

  createElementNS(namespace, tag) {
    const element = namespace === 'http://www.w3.org/2000/svg' ? new SVGElement(tag) : new HTMLElement(tag)
    element.namespaceURI = namespace
    element.ownerDocument = this
    return element
  }

  createTextNode(text) {
    const node = new TextNode(text)
    node.ownerDocument = this
    return node
  }

  createComment(text) {
    const node = new CommentNode(text)
    node.ownerDocument = this
    return node
  }

  createDocumentFragment() {
    const fragment = new DocumentFragment()
    fragment.ownerDocument = this
    return fragment
  }

  getElementById(id) {
    return collect(this).find((element) => element.id === id) ?? null
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector) {
    return queryAll(this, selector)
  }

  getElementsByTagName(tag) {
    return this.documentElement.getElementsByTagName(tag)
  }

  elementFromPoint() {
    return this.body
  }
}

function collect(root) {
  const found = []
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue
      found.push(child)
      walk(child)
    }
  }
  walk(root)
  return found
}

function splitSelectors(selector) {
  const parts = []
  let current = ''
  let quote = ''
  for (const char of selector) {
    if (quote) {
      current += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === ',') {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function selectorSteps(selector) {
  const steps = []
  const pattern = /\s*(>| )\s*|\s+/g
  let last = 0
  let match = pattern.exec(selector)
  let relation = 'desc'
  while (match) {
    const part = selector.slice(last, match.index).trim()
    if (part) steps.push({ relation, selector: part })
    relation = match[1] === '>' ? 'child' : 'desc'
    last = match.index + match[0].length
    match = pattern.exec(selector)
  }
  const tail = selector.slice(last).trim()
  if (tail) steps.push({ relation, selector: tail })
  return steps
}

function matches(element, selector) {
  let rest = selector.trim()
  if (!rest || rest.includes(':')) return false
  if (/^[a-zA-Z]/.test(rest)) {
    const tag = /^[a-zA-Z][\w-]*/.exec(rest)[0]
    if (element.tagName.toUpperCase() !== tag.toUpperCase()) return false
    rest = rest.slice(tag.length)
  } else if (rest.startsWith('*')) {
    rest = rest.slice(1)
  }
  while (rest) {
    if (rest.startsWith('.')) {
      const name = /^\.([^\s.#[\]]+)/.exec(rest)?.[1]
      if (!name || !element.className.split(/\s+/).includes(name)) return false
      rest = rest.slice(name.length + 1)
      continue
    }
    if (rest.startsWith('#')) {
      const name = /^#([^\s.#[\]]+)/.exec(rest)?.[1]
      if (!name || element.id !== name) return false
      rest = rest.slice(name.length + 1)
      continue
    }
    if (rest.startsWith('[')) {
      const body = /^\[([^\]]+)\]/.exec(rest)?.[1]
      if (!body) return false
      const equals = body.indexOf('=')
      if (equals === -1) {
        if (!element.hasAttribute(body.trim())) return false
      } else {
        let name = body.slice(0, equals).trim()
        if (/[~|^$*]$/.test(name)) name = name.slice(0, -1)
        let value = body.slice(equals + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (element.getAttribute(name) !== value) return false
      }
      rest = rest.slice(body.length + 2)
      continue
    }
    return false
  }
  return true
}

function queryAll(root, selector) {
  const found = []
  for (const group of splitSelectors(selector)) {
    const steps = selectorSteps(group)
    if (steps.length === 0) continue
    let current = [root]
    for (const step of steps) {
      const next = []
      for (const base of current) {
        const candidates = step.relation === 'child'
          ? base.childNodes.filter((node) => node.nodeType === 1)
          : collect(base)
        for (const candidate of candidates) {
          if (matches(candidate, step.selector)) next.push(candidate)
        }
      }
      current = next
    }
    found.push(...current)
  }
  return [...new Set(found)]
}

function getComputedStyle(element) {
  const inline = element?.style
  return {
    getPropertyValue(name) {
      const own = inline?.getPropertyValue?.(name)
      if (own) return own
      return VARS[name] ?? ''
    },
    get paddingTop() {
      if (inline?.paddingTop) return inline.paddingTop
      if (element?.className?.includes('showcase-safe-probe')) return '0px'
      return '24px'
    },
    get paddingRight() {
      if (inline?.paddingRight) return inline.paddingRight
      if (element?.className?.includes('showcase-safe-probe')) return '0px'
      return '24px'
    },
    get paddingBottom() {
      if (inline?.paddingBottom) return inline.paddingBottom
      if (element?.className?.includes('showcase-safe-probe')) return '0px'
      return '72px'
    },
    get paddingLeft() {
      if (inline?.paddingLeft) return inline.paddingLeft
      if (element?.className?.includes('showcase-safe-probe')) return '0px'
      return '24px'
    },
    get visibility() {
      return 'visible'
    },
    get display() {
      return element?.hasAttribute?.('hidden') ? 'none' : 'block'
    },
    get backgroundColor() {
      return 'rgb(255, 255, 255)'
    },
    get transform() {
      return inline?.transform || 'none'
    },
    get opacity() {
      return inline?.opacity || '1'
    },
    get position() {
      return inline?.position || 'static'
    },
    get overflow() {
      return 'visible'
    },
    get filter() {
      return 'none'
    },
    get clipPath() {
      return 'none'
    },
    get mask() {
      return 'none'
    },
    get borderRadius() {
      return '0px'
    },
  }
}

const listeners = new Map()

function addWindowListener(type, fn, options) {
  if (typeof fn !== 'function') return
  const capture = captureFlag(options)
  const list = listeners.get(type) ?? []
  if (list.some((item) => item.fn === fn && item.capture === capture)) return
  list.push({ fn, capture })
  listeners.set(type, list)
}

function removeWindowListener(type, fn, options) {
  const capture = captureFlag(options)
  const list = listeners.get(type) ?? []
  listeners.set(
    type,
    list.filter((item) => item.fn !== fn || item.capture !== capture),
  )
}

const document = new DocumentNode()

const window = {
  document,
  HTMLElement,
  HTMLIFrameElement,
  Element,
  Node,
  SVGElement,
  Document: DocumentNode,
  DocumentFragment,
  Comment: CommentNode,
  Text: TextNode,
  Event: DomEvent,
  KeyboardEvent: DomEvent,
  MouseEvent: DomEvent,
  getComputedStyle,
  matchMedia(query) {
    return {
      media: query,
      matches: query.includes('prefers-reduced-motion') ? globalThis.__showcaseReducedMotion === true : false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }
  },
  ResizeObserver: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  requestAnimationFrame(callback) {
    return setTimeout(() => callback(Date.now()), 16)
  },
  cancelAnimationFrame(id) {
    clearTimeout(id)
  },
  getSelection() {
    return { rangeCount: 0, removeAllRanges() {}, addRange() {} }
  },
  addEventListener: addWindowListener,
  removeEventListener: removeWindowListener,
  dispatchEvent(event) {
    const list = listeners.get(event.type) ?? []
    for (const item of [...list]) {
      if (event._immediate) break
      event.currentTarget = this
      item.fn.call(this, event)
    }
    return !event.defaultPrevented
  },
  scrollTo(x, y) {
    if (typeof x === 'object' && x) {
      if ('left' in x) this.scrollX = x.left
      if ('top' in x) this.scrollY = x.top
    } else {
      this.scrollX = Number(x) || 0
      this.scrollY = Number(y) || 0
    }
    this.pageXOffset = this.scrollX
    this.pageYOffset = this.scrollY
  },
  setTimeout(fn, delay, ...args) {
    return globalThis.setTimeout(fn, delay, ...args)
  },
  clearTimeout(id) {
    globalThis.clearTimeout(id)
  },
  innerWidth: 1280,
  innerHeight: 800,
  scrollX: 0,
  scrollY: 0,
  pageXOffset: 0,
  pageYOffset: 0,
  devicePixelRatio: 1,
  location: { hash: '', href: 'http://localhost/', pathname: '/' },
  navigator: globalThis.navigator,
}

document.defaultView = window
HTMLElement.prototype.animate = function animate() {
  return {
    playState: 'finished',
    effect: { target: this },
    cancel() {},
    pause() {},
    play() {},
    finish() {},
    finished: Promise.resolve(),
  }
}

globalThis.window = window
globalThis.document = document
globalThis.HTMLElement = HTMLElement
globalThis.HTMLIFrameElement = HTMLIFrameElement
globalThis.Element = Element
globalThis.Node = Node
globalThis.SVGElement = SVGElement
globalThis.Document = DocumentNode
globalThis.DocumentFragment = DocumentFragment
globalThis.Comment = CommentNode
globalThis.Text = TextNode
globalThis.Event = DomEvent
globalThis.KeyboardEvent = DomEvent
globalThis.MouseEvent = DomEvent
globalThis.getComputedStyle = getComputedStyle
globalThis.ResizeObserver = window.ResizeObserver
globalThis.requestAnimationFrame = window.requestAnimationFrame
globalThis.cancelAnimationFrame = window.cancelAnimationFrame
globalThis.IS_REACT_ACT_ENVIRONMENT = true

export function installDomShim() {
  return { window, document }
}
