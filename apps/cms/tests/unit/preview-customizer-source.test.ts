import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("preview customizer source contract", () => {
  it("uses the shared site renderer directly and does not render an iframe", () => {
    const componentSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/preview/PreviewCustomizer.tsx"),
      "utf8",
    )
    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(frontend)/preview/[token]/page.tsx"),
      "utf8",
    )

    expect(componentSource).toContain('@siteinabox/site-renderer')
    expect(componentSource).toContain("<SitePageRenderer")
    expect(componentSource).toContain("densityLevels={DENSITY_PRESETS}")
    expect(componentSource).toContain("stylePresetLevels={STYLE_PRESETS}")
    expect(componentSource).toContain('aria-label="Preview pages"')
    expect(componentSource).toContain('access.type === "grant"')
    expect(componentSource).toContain("Expires {formatExpiry(access.exp)}")
    expect(componentSource).toContain("Approve preview")
    expect(componentSource).toContain("Payment gate")
    expect(componentSource).toContain("setPaymentState(next.payment)")
    expect(componentSource).toContain("paymentState?.status")
    expect(componentSource).not.toContain("Approve & Pay")
    expect(componentSource).not.toMatch(/<iframe\b/i)
    expect(routeSource).not.toMatch(/<iframe\b/i)
  })
})
