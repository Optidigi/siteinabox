// @vitest-environment jsdom
import * as React from "react"
import { act, render } from "@testing-library/react"
import { applyThemeAttributes, ThemeCanvas } from "@siteinabox/site-renderer/theme"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { describe, expect, it } from "vitest"

describe("ThemeCanvas", () => {
  it("resolves system mode and follows operating-system changes", () => {
    let dark = true
    const listeners = new Set<() => void>()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        get matches() { return dark },
        media: "(prefers-color-scheme: dark)",
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      }),
    })

    const theme = { ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "system" as const } }
    const { container } = render(<ThemeCanvas className="rt-canvas" theme={theme}><span data-probe /></ThemeCanvas>)
    const canvas = container.firstElementChild
    expect(canvas?.getAttribute("data-siab-theme-mode")).toBe("system")
    const cleanup = applyThemeAttributes(document, theme)
    expect(canvas?.getAttribute("data-rt-mode")).toBe("dark")

    act(() => {
      dark = false
      listeners.forEach((notify) => notify())
    })
    expect(canvas?.getAttribute("data-rt-mode")).toBe("light")
    cleanup()
  })
})
