// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CspNonceProvider } from "@siteinabox/ui/lib/csp-nonce"
import { formatCssColorValue, formatCssPx, formatCssUrl, formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"

function StyleProbe({ declarations }: { declarations?: string | null }) {
  const { className, styleElement } = useCspStyleRule("probe", declarations)
  return (
    <>
      {styleElement}
      <div data-testid="target" className={className} />
    </>
  )
}

describe("CSP runtime style helper", () => {
  it("formats finite pixel values for generated CSS rules", () => {
    expect(formatCssPx(12.34567)).toBe("12.346px")
    expect(formatCssPx(-0)).toBe("0px")
    expect(formatCssPx(Number.NaN)).toBe("0px")
  })

  it("accepts runtime transform values and rejects declaration breaks", () => {
    expect(formatRuntimeCssValue("translate3d(1px, 2px, 0) scaleX(1)")).toBe("translate3d(1px, 2px, 0) scaleX(1)")
    expect(formatRuntimeCssValue("transform 250ms cubic-bezier(0.25, 1, 0.5, 1)")).toBe("transform 250ms cubic-bezier(0.25, 1, 0.5, 1)")
    expect(formatRuntimeCssValue("left:0")).toBeNull()
    expect(formatRuntimeCssValue("translateX(1px);color:red")).toBeNull()
  })

  it("escapes urls for generated CSS background rules", () => {
    expect(formatCssUrl('/media/hero.jpg')).toBe('url("/media/hero.jpg")')
    expect(formatCssUrl('/media/a"b.jpg')).toBe('url("/media/a\\"b.jpg")')
    expect(formatCssUrl("/media/a\nb.jpg")).toBe('url("/media/ab.jpg")')
  })

  it("accepts constrained CSS color values", () => {
    expect(formatCssColorValue("#ff00aa")).toBe("#ff00aa")
    expect(formatCssColorValue("oklch(80% 0.1 120)")).toBe("oklch(80% 0.1 120)")
    expect(formatCssColorValue("var(--chart-1, #333)")).toBe("var(--chart-1, #333)")
    expect(formatCssColorValue("red;left:0")).toBeNull()
  })

  it("renders a nonce-bearing style tag scoped to the generated class", () => {
    render(
      <CspNonceProvider nonce="nonce-for-runtime-css">
        <StyleProbe declarations="left:12px;top:20px;" />
      </CspNonceProvider>,
    )

    const targetClass = screen.getByTestId("target").className
    const style = document.querySelector<HTMLStyleElement>('style[data-siab-csp-style="probe"]')

    expect(targetClass).toMatch(/^siab-csp-probe-/)
    expect(style?.nonce).toBe("nonce-for-runtime-css")
    expect(style?.textContent).toBe(`.${targetClass}{left:12px;top:20px;}`)
  })

  it("omits the style tag when no declarations are needed", () => {
    render(
      <CspNonceProvider nonce="nonce-for-runtime-css">
        <StyleProbe declarations={null} />
      </CspNonceProvider>,
    )

    expect(document.querySelector('style[data-siab-csp-style="probe"]')).toBeNull()
  })
})
