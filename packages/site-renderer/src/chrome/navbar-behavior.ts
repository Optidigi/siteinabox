import {
  COLOR_MODE_STORAGE_KEY,
  SYSTEM_DARK_QUERY,
  normalizeColorMode,
  readStoredColorMode,
  resolveColorMode,
  writeStoredColorMode,
  type ResolvedColorMode,
  type ThemePreference,
} from "../theme/color-mode"

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "system" ? value : "light"
}

function storageFor(documentRef: Document): Storage | null {
  try {
    return documentRef.defaultView?.localStorage ?? null
  } catch {
    return null
  }
}

function applyModeAttributes(documentRef: Document, mode: ResolvedColorMode) {
  documentRef.documentElement.dataset.siabColorMode = mode
  documentRef.documentElement.dataset.rtMode = mode
  documentRef.querySelectorAll<HTMLElement>("[data-siab-theme-mode]").forEach((canvas) => {
    const preference = normalizeThemePreference(canvas.dataset.siabThemeMode)
    const systemPrefersDark = documentRef.defaultView?.matchMedia(SYSTEM_DARK_QUERY).matches ?? false
    canvas.dataset.rtMode = resolveColorMode(preference, mode, systemPrefersDark)
  })
}

function updateThemeToggleState(documentRef: Document, mode: ResolvedColorMode) {
  documentRef.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(mode === "dark"))
    toggle.setAttribute("aria-label", mode === "dark" ? "Use light theme" : "Use dark theme")
    toggle.dataset.themeMode = mode
  })
}

function updateActiveLinks(documentRef: Document) {
  const current = documentRef.defaultView?.location
  if (!current) return
  const currentUrl = new URL(current.href)

  const pageSlugFromPath = (pathname: string): string => {
    const segments = pathname.split("/").filter(Boolean)
    const pagesIndex = segments.indexOf("pages")
    const pageSegments = pagesIndex >= 0 ? segments.slice(pagesIndex + 1) : segments.slice(-1)
    const slug = pageSegments.join("/")
    return slug === "" || slug === "home" ? "index" : slug
  }

  documentRef.querySelectorAll<HTMLElement>("[data-siab-navbar-frame]").forEach((frame) => {
    const mode = frame.dataset.navbarActiveMode ?? "path"
    const configuredPageSlug = frame.dataset.navbarPageSlug?.trim()
    const currentPageSlug = configuredPageSlug
      ? (configuredPageSlug === "home" ? "index" : configuredPageSlug)
      : pageSlugFromPath(currentUrl.pathname)
    frame.querySelectorAll<HTMLAnchorElement>("[data-navbar-link]").forEach((link) => {
      link.removeAttribute("aria-current")
      const href = link.getAttribute("href")
      if (mode === "none" || !href) return

      let target: URL
      try {
        target = new URL(href, currentUrl.href)
      } catch {
        return
      }
      if (target.origin !== currentUrl.origin) return
      const matches = mode === "anchor"
        ? Boolean(target.hash && target.hash === currentUrl.hash)
        : !target.hash && (
          target.pathname === currentUrl.pathname
          || pageSlugFromPath(target.pathname) === currentPageSlug
        )
      if (matches) link.setAttribute("aria-current", "page")
    })
  })
}

function syncDisclosureState(details: HTMLDetailsElement) {
  details.querySelector<HTMLElement>(":scope > summary")?.setAttribute("aria-expanded", String(details.open))
}

function closeNavbarDetails(frame: HTMLElement) {
  frame.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
    details.removeAttribute("open")
    syncDisclosureState(details)
  })
}

const NAVBAR_SCROLL_THRESHOLD_PX = 12
const STICKY_NAVBAR_FRAME_SELECTOR = "[data-siab-navbar-frame].site-navbar-frame-sticky"

function readScrollY(documentRef: Document): number {
  const viewScrollY = documentRef.defaultView?.scrollY ?? 0
  const documentScrollY = documentRef.documentElement.scrollTop
  const bodyScrollY = documentRef.body?.scrollTop ?? 0
  return Math.max(viewScrollY, documentScrollY, bodyScrollY, 0)
}

function syncStickyNavbarScrollState(documentRef: Document) {
  const state = readScrollY(documentRef) > NAVBAR_SCROLL_THRESHOLD_PX ? "scrolled" : "top"
  documentRef.querySelectorAll<HTMLElement>(STICKY_NAVBAR_FRAME_SELECTOR).forEach((frame) => {
    if (frame.dataset.navbarScrollState !== state) {
      frame.dataset.navbarScrollState = state
    }
  })
}

export type NavbarColorModeAuthority = "stored" | "theme"

export type NavbarBehaviorOptions = {
  /**
   * Public sites persist the navbar toggle. CMS preview/editor canvases use
   * the incoming theme as the authority so the navbar cannot override the
   * theme toolbar through shared localStorage.
   */
  colorModeAuthority?: NavbarColorModeAuthority
}

export function initializeNavbarBehavior(
  documentRef: Document = document,
  options: NavbarBehaviorOptions = {},
): () => void {
  const colorModeAuthority = options.colorModeAuthority ?? "stored"
  const windowRef = documentRef.defaultView
  const systemColorMode = documentRef.defaultView?.matchMedia(SYSTEM_DARK_QUERY)
  const storage = colorModeAuthority === "stored" ? storageFor(documentRef) : null
  let themeCanvasOverride: ResolvedColorMode | null = null
  let scrollFrame: number | null = null

  const applyColorMode = () => {
    const preference = normalizeThemePreference(documentRef.documentElement.dataset.siabThemeMode)
    const override = colorModeAuthority === "stored"
      ? readStoredColorMode(storage)
      : themeCanvasOverride
    const mode = resolveColorMode(preference, override, systemColorMode?.matches ?? false)
    applyModeAttributes(documentRef, mode)
    updateThemeToggleState(documentRef, mode)
  }

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const toggle = target?.closest<HTMLButtonElement>("[data-theme-toggle]")
    if (toggle) {
      const current = normalizeColorMode(documentRef.documentElement.dataset.siabColorMode) ?? "light"
      const next = current === "dark" ? "light" : "dark"
      if (colorModeAuthority === "stored") writeStoredColorMode(storage, next)
      else themeCanvasOverride = next
      applyColorMode()
      return
    }

    const frame = target?.closest<HTMLElement>("[data-siab-navbar-frame]")
    const insideNavbarDisclosure = target?.closest("[data-siab-navbar-frame] details")
    if (!insideNavbarDisclosure) {
      if (frame) closeNavbarDetails(frame)
      else documentRef.querySelectorAll<HTMLElement>("[data-siab-navbar-frame]").forEach(closeNavbarDetails)
    }

    const link = target?.closest<HTMLAnchorElement>("[data-navbar-link]")
    if (link && link.closest(".site-navbar-mobile-menu")) {
      const linkFrame = link.closest<HTMLElement>("[data-siab-navbar-frame]")
      if (linkFrame) closeNavbarDetails(linkFrame)
    }
  }

  const onToggle = (event: Event) => {
    const details = event.target instanceof HTMLDetailsElement ? event.target : null
    const frame = details?.closest<HTMLElement>("[data-siab-navbar-frame]")
    if (!details || !frame) return

    syncDisclosureState(details)
    if (!details.open) return

    const selector = details.classList.contains("site-navbar-mobile-menu")
      ? "details.site-navbar-mobile-menu[open]"
      : "details.site-navbar-group[open]"
    frame.querySelectorAll<HTMLDetailsElement>(selector).forEach((other) => {
      if (other === details) return
      other.removeAttribute("open")
      syncDisclosureState(other)
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    const target = event.target instanceof Element ? event.target : null
    const details = target?.closest<HTMLDetailsElement>("[data-siab-navbar-frame] details[open]")
    if (!details) return
    details.removeAttribute("open")
    syncDisclosureState(details)
    details.querySelector<HTMLElement>(":scope > summary")?.focus()
  }

  const onFocusOut = (event: FocusEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const frame = target?.closest<HTMLElement>("[data-siab-navbar-frame]")
    if (!frame) return
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && frame.contains(nextTarget)) return
    closeNavbarDetails(frame)
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COLOR_MODE_STORAGE_KEY) applyColorMode()
  }

  const updateScrollState = () => {
    scrollFrame = null
    syncStickyNavbarScrollState(documentRef)
  }

  const onScroll = () => {
    if (!windowRef || scrollFrame !== null) return
    if (typeof windowRef.requestAnimationFrame !== "function") {
      syncStickyNavbarScrollState(documentRef)
      return
    }
    scrollFrame = windowRef.requestAnimationFrame(updateScrollState)
  }

  const observer = typeof MutationObserver === "undefined"
    ? null
    : new MutationObserver(() => {
      // A new toolbar theme is canonical in CMS canvases. Discard only the
      // transient navbar override when the theme preference changes.
      if (colorModeAuthority === "theme") themeCanvasOverride = null
      applyColorMode()
    })
  observer?.observe(documentRef.documentElement, { attributes: true, attributeFilter: ["data-siab-theme-mode"] })

  applyColorMode()
  updateActiveLinks(documentRef)
  syncStickyNavbarScrollState(documentRef)
  documentRef.querySelectorAll<HTMLDetailsElement>("[data-siab-navbar-frame] details").forEach(syncDisclosureState)
  documentRef.addEventListener("click", onClick)
  documentRef.addEventListener("toggle", onToggle, true)
  documentRef.addEventListener("keydown", onKeyDown)
  documentRef.addEventListener("focusout", onFocusOut)
  windowRef?.addEventListener("scroll", onScroll, { passive: true })
  if (colorModeAuthority === "stored") documentRef.defaultView?.addEventListener("storage", onStorage)
  systemColorMode?.addEventListener("change", applyColorMode)

  return () => {
    observer?.disconnect()
    if (scrollFrame !== null) {
      windowRef?.cancelAnimationFrame(scrollFrame)
      scrollFrame = null
    }
    documentRef.removeEventListener("click", onClick)
    documentRef.removeEventListener("toggle", onToggle, true)
    documentRef.removeEventListener("keydown", onKeyDown)
    documentRef.removeEventListener("focusout", onFocusOut)
    windowRef?.removeEventListener("scroll", onScroll)
    if (colorModeAuthority === "stored") documentRef.defaultView?.removeEventListener("storage", onStorage)
    systemColorMode?.removeEventListener("change", applyColorMode)
  }
}
