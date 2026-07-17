"use client"
import * as React from "react"

/**
 * iOS Safari, on input focus, **synchronously and natively** scrolls the layout
 * viewport to bring the focused input into the visual viewport. Our inspector is
 * a `position: fixed` bottom sheet — iOS's scroll drags it up and off-screen.
 *
 * Vaul ships a fix for exactly this (`preventScrollMobileSafari`), but gates it
 * behind `modal={true}`. The mobile inspector runs `modal={false}` (the canvas
 * must stay tappable while *selecting* an element), so vaul's fix never engages.
 *
 * This hook ports vaul's technique — itself from react-aria's `usePreventScroll`
 * (github.com/adobe/react-spectrum .../usePreventScroll.ts) — scoped to the
 * inspector. On touch/focus of an inspector input it briefly transforms the
 * input `translateY(-2000px)`, so iOS's "centre the focused input" math computes
 * a near-zero scroll; then it restores the input and reveals it within the
 * sheet's *own* scroll region (never the window). The canvas does not need to be
 * interactive while a field is focused, so this never conflicts with
 * `modal={false}`. No-op off iOS — other browsers handle the keyboard fine.
 *
 * Prior attempts failed by trying to *out-run* iOS's scroll (FE-67/68/70 moved
 * the sheet on focus); you cannot beat a synchronous native handler. This
 * *suppresses* the scroll instead. See backlog FE-71.
 */

// ── ported from vaul@1.1.2 (vaul/dist/index.mjs) ──────────────────────────────

function testPlatform(re: RegExp): boolean {
  return typeof window !== "undefined" && window.navigator != null
    ? re.test(window.navigator.platform)
    : false
}

/** iPhone, or iPadOS (which reports as Mac but exposes touch points). */
function isIOS(): boolean {
  return (
    testPlatform(/^iPhone/) ||
    testPlatform(/^iPad/) ||
    (testPlatform(/^Mac/) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)
  )
}

const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox", "radio", "range", "color", "file", "image", "button", "submit", "reset",
])

/** Text inputs, textareas, and contenteditable (the Lexical rich-text field). */
function isInput(target: EventTarget | null): target is HTMLElement {
  return (
    (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** The element to focus/lift: an input/textarea is itself; a node inside a
 *  contenteditable resolves to its editing host (a nested node is not focusable). */
function focusableHost(el: HTMLElement): HTMLElement {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el
  return el.closest<HTMLElement>('[contenteditable="true"],[contenteditable=""]') ?? el
}

function isScrollable(node: Element): boolean {
  const style = window.getComputedStyle(node)
  return /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)
}

function getScrollParent(node: Element): Element {
  let current: Element | null = node
  if (isScrollable(current)) current = current.parentElement
  while (current && !isScrollable(current)) current = current.parentElement
  return current || document.scrollingElement || document.documentElement
}

const KEYBOARD_BUFFER = 24

/** Scrolls the focused element into view within its nearest scrollable
 *  ancestors ONLY — never the window/document. (Ported from vaul.) */
function scrollIntoView(target: Element): void {
  const root = document.scrollingElement || document.documentElement
  let node: Element | null = target
  while (node && node !== root) {
    const scrollable = getScrollParent(node)
    if (
      scrollable !== document.documentElement &&
      scrollable !== document.body &&
      scrollable !== node
    ) {
      const scrollableTop = scrollable.getBoundingClientRect().top
      const targetTop = node.getBoundingClientRect().top
      const targetBottom = node.getBoundingClientRect().bottom
      const visibleBottom = scrollable.getBoundingClientRect().bottom + KEYBOARD_BUFFER
      if (targetBottom > visibleBottom) {
        scrollable.scrollTop += targetTop - scrollableTop
      }
    }
    node = scrollable.parentElement
  }
}

// ──────────────────────────────────────────────────────────────────────────────

const INSPECTOR_SELECTOR = "[data-mobile-inspector-bar]"
const LIFT = "translateY(-2000px)"

/**
 * Suppress iOS Safari's native focus-scroll for inputs inside the mobile
 * inspector sheet. `open` should be true while the sheet is open. No-op off iOS.
 */
export function useInspectorKeyboardLock(open: boolean): void {
  React.useEffect(() => {
    if (!open || !isIOS()) return

    // After the keyboard settles, reveal the field within the sheet's own
    // scroll region (the editor body) — never the window.
    const reveal = (host: HTMLElement) => {
      const vv = window.visualViewport
      if (!vv) return
      if (vv.height < window.innerHeight) {
        // Keyboard already up — reveal next frame.
        requestAnimationFrame(() => scrollIntoView(host))
      } else {
        // Keyboard not up yet — reveal once the visual viewport resizes.
        vv.addEventListener("resize", () => scrollIntoView(host), { once: true })
      }
    }

    // Tap-to-focus: cancel iOS's native focus-from-tap, lift the input out of
    // the viewport, focus it ourselves (so iOS's focus-scroll measures it
    // off-screen → ~zero scroll), then restore on the next frame.
    const onTouchEnd = (e: TouchEvent) => {
      if (!isInput(e.target) || !e.target.closest(INSPECTOR_SELECTOR)) return
      const host = focusableHost(e.target)
      // Already focused (e.g. a second tap inside a rich-text field) — let the
      // native tap position the caret; only the first focus needs suppressing.
      if (host === document.activeElement) return
      e.preventDefault()
      host.style.transform = LIFT
      host.focus({ preventScroll: true })
      requestAnimationFrame(() => { host.style.transform = "" })
    }

    // Focus moves with no preceding tap (keyboard next/previous, programmatic).
    const onFocusIn = (e: FocusEvent) => {
      if (!isInput(e.target) || !e.target.closest(INSPECTOR_SELECTOR)) return
      // Resolve to the focusable host (consistent with onTouchEnd) — a nested
      // node inside a contenteditable is not what iOS scrolls to.
      const host = focusableHost(e.target)
      host.style.transform = LIFT
      requestAnimationFrame(() => {
        host.style.transform = ""
        reveal(host)
      })
    }

    // Last resort: if iOS still nudged the layout viewport, snap it back.
    const onWindowScroll = () => { window.scrollTo(0, 0) }

    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false })
    document.addEventListener("focusin", onFocusIn, true)
    window.addEventListener("scroll", onWindowScroll)
    return () => {
      document.removeEventListener("touchend", onTouchEnd, true)
      document.removeEventListener("focusin", onFocusIn, true)
      window.removeEventListener("scroll", onWindowScroll)
    }
  }, [open])
}
