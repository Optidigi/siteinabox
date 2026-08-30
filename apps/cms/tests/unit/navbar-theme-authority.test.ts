/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import { initializeNavbarBehavior } from "@siteinabox/site-renderer"

const mediaQuery = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

function mountThemeFixture() {
  const values = new Map<string, string>()
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      clear: () => values.clear(),
    },
  })
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => mediaQuery,
  })
  document.documentElement.dataset.siabThemeMode = "light"
  const canvas = document.createElement("div")
  canvas.dataset.siabThemeMode = "light"
  const toggle = document.createElement("button")
  toggle.dataset.themeToggle = "true"
  document.body.append(canvas, toggle)
  return { canvas, toggle }
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute("data-siab-theme-mode")
  document.documentElement.removeAttribute("data-siab-color-mode")
  document.documentElement.removeAttribute("data-rt-mode")
  window.localStorage.clear()
})

async function flushNavbarScrollFrame() {
  if (typeof window.requestAnimationFrame === "function") {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    return
  }
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

describe("navbar color-mode authority", () => {
  it("lets the CMS theme remain authoritative over the navbar toggle", async () => {
    const { canvas, toggle } = mountThemeFixture()
    window.localStorage.setItem("siab-color-mode", "dark")

    const cleanup = initializeNavbarBehavior(document, { colorModeAuthority: "theme" })
    expect(document.documentElement.dataset.siabColorMode).toBe("light")
    expect(canvas.dataset.rtMode).toBe("light")

    toggle.click()
    expect(document.documentElement.dataset.siabColorMode).toBe("dark")
    expect(window.localStorage.getItem("siab-color-mode")).toBe("dark")

    document.documentElement.dataset.siabThemeMode = "light"
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.documentElement.dataset.siabColorMode).toBe("light")
    expect(canvas.dataset.rtMode).toBe("light")
    cleanup()
  })

  it("persists the navbar toggle for public rendering by default", () => {
    const { toggle } = mountThemeFixture()
    window.localStorage.setItem("siab-color-mode", "dark")

    const cleanup = initializeNavbarBehavior(document)
    expect(document.documentElement.dataset.siabColorMode).toBe("dark")

    toggle.click()
    expect(document.documentElement.dataset.siabColorMode).toBe("light")
    expect(window.localStorage.getItem("siab-color-mode")).toBe("light")
    cleanup()
  })

  it("lifts sticky navbar surfaces after the scroll threshold only", async () => {
    mountThemeFixture()
    const stickyFrame = document.createElement("div")
    stickyFrame.className = "site-navbar-frame site-navbar-frame-sticky"
    stickyFrame.dataset.siabNavbarFrame = "true"
    stickyFrame.dataset.navbarVariant = "navbar-01"
    const overlayFrame = document.createElement("div")
    overlayFrame.className = "site-navbar-frame site-navbar-frame-hero-overlay"
    overlayFrame.dataset.siabNavbarFrame = "true"
    overlayFrame.dataset.navbarVariant = "navbar-02"
    document.body.append(stickyFrame, overlayFrame)

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 })
    const cleanup = initializeNavbarBehavior(document)
    expect(stickyFrame.dataset.navbarScrollState).toBe("top")
    expect(overlayFrame.dataset.navbarScrollState).toBeUndefined()

    Object.defineProperty(window, "scrollY", { configurable: true, value: 12 })
    window.dispatchEvent(new Event("scroll"))
    await flushNavbarScrollFrame()
    expect(stickyFrame.dataset.navbarScrollState).toBe("top")

    Object.defineProperty(window, "scrollY", { configurable: true, value: 13 })
    window.dispatchEvent(new Event("scroll"))
    await flushNavbarScrollFrame()
    expect(stickyFrame.dataset.navbarScrollState).toBe("scrolled")
    expect(overlayFrame.dataset.navbarScrollState).toBeUndefined()
    cleanup()
  })
})
