// @vitest-environment jsdom
import * as React from "react"
import { act, render } from "@testing-library/react"
import { ThemeCanvas, useThemeCanvasColorMode } from "@siteinabox/site-renderer/theme"
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

    const ThemeModeProbe = () => <span data-probe={useThemeCanvasColorMode()} />
    const { container } = render(<ThemeCanvas theme={{ ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "system" } }}><ThemeModeProbe /></ThemeCanvas>)
    const canvas = container.firstElementChild
    const probe = container.querySelector("[data-probe]")
    expect(canvas?.getAttribute("data-siab-theme-mode")).toBe("system")
    expect(canvas?.getAttribute("data-rt-mode")).toBe("dark")
    expect(probe?.getAttribute("data-probe")).toBe("dark")

    act(() => {
      dark = false
      listeners.forEach((notify) => notify())
    })
    expect(canvas?.getAttribute("data-rt-mode")).toBe("light")
    expect(probe?.getAttribute("data-probe")).toBe("light")
  })
})
