import type {
  ConsentSelection,
  ConsentSelectionInput,
  ConsentSnapshot,
} from "@siteinabox/contracts"

export type {
  ConsentSelection,
  ConsentSelectionInput,
  ConsentSnapshot,
} from "@siteinabox/contracts"

export type ConsentAnalyticsApi = {
  getConsent: () => ConsentSnapshot
  applyConsent: (selection: ConsentSelectionInput) => void
}

export type ConsentRuntime = ConsentAnalyticsApi & {
  subscribe?: (listener: () => void) => () => void
}

type ConsentWindow = Window & { SIABAnalytics?: ConsentAnalyticsApi }

const noop = () => {}

/**
 * Creates the non-persistent consent state used by the customer preview.
 * It deliberately has no storage, analytics, or network dependency: preview
 * controls rehearse the shared consent UI without changing a real visitor's
 * receipt or the tenant's public analytics configuration.
 */
export function createPreviewConsentRuntime(
  initial: Partial<ConsentSnapshot> = {},
): ConsentRuntime {
  let snapshot: ConsentSnapshot = {
    necessary: true,
    preferences: initial.preferences === true,
    analytics: initial.analytics === true,
    marketing: initial.marketing === true,
    decided: initial.decided === true,
  }
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const normalizeSelection = (selection: ConsentSelectionInput): ConsentSelection => ({
    preferences: selection.preferences === true,
    analytics: selection.analytics === true,
    marketing: selection.marketing === true,
  })

  return {
    getConsent: () => ({ ...snapshot }),
    applyConsent: (selection) => {
      snapshot = { necessary: true, ...normalizeSelection(selection), decided: true }
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Attaches the shared consent interaction to either the public analytics
 * runtime or an explicitly supplied preview runtime. The markup remains
 * server-rendered in both cases; only this small behavior layer is browser
 * code.
 */
export function initializeConsentBehavior(
  root: Document = document,
  runtime?: ConsentRuntime,
): () => void {
  const frame = root.querySelector<HTMLElement>("[data-siab-consent-frame='true']")
  const windowRef = root.defaultView as ConsentWindow | null
  const api: ConsentRuntime | undefined = runtime ?? windowRef?.SIABAnalytics
  if (!frame || !windowRef || !api) return noop

  const banner = frame.querySelector<HTMLElement>("[data-siab-cookie-consent='true']")
  const preferences = frame.querySelector<HTMLInputElement>("[data-siab-consent-category='preferences']")
  const analytics = frame.querySelector<HTMLInputElement>("[data-siab-consent-category='analytics']")
  const marketing = frame.querySelector<HTMLInputElement>("[data-siab-consent-category='marketing']")
  if (!banner || !analytics) return noop

  const setOpen = (open: boolean) => {
    banner.hidden = !open
    banner.setAttribute("aria-hidden", String(!open))
    frame.dataset.siabConsentState = open ? "open" : "closed"
  }

  const sync = () => {
    const consent = api.getConsent()
    if (preferences) preferences.checked = consent.preferences
    analytics.checked = consent.analytics
    if (marketing) marketing.checked = consent.marketing
    setOpen(!consent.decided)
  }

  const currentSelection = (): ConsentSelection => ({
    preferences: preferences?.checked === true,
    analytics: analytics.checked,
    marketing: marketing?.checked === true,
  })

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (!target || !frame.contains(target)) return

    const action = target.closest<HTMLButtonElement>("[data-siab-consent-action]")
    if (!action) return
    event.preventDefault()
    const focusedElement = root.activeElement
    const actionName = action.dataset.siabConsentAction
    if (actionName === "all") {
      if (preferences) preferences.checked = true
      analytics.checked = true
      if (marketing) marketing.checked = true
      api.applyConsent({ preferences: true, analytics: true, marketing: true })
    } else if (actionName === "reject") {
      if (preferences) preferences.checked = false
      analytics.checked = false
      if (marketing) marketing.checked = false
      api.applyConsent({ preferences: false, analytics: false, marketing: false })
    } else if (actionName === "selection") {
      api.applyConsent(currentSelection())
    } else {
      return
    }
    setOpen(false)
    if (focusedElement instanceof HTMLElement && banner.contains(focusedElement)) focusedElement.blur()
  }

  root.addEventListener("click", onClick)
  const unsubscribe = api.subscribe?.(sync)
  sync()
  return () => {
    root.removeEventListener("click", onClick)
    unsubscribe?.()
  }
}
