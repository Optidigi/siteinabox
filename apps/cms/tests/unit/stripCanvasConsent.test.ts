import { describe, expect, it } from "vitest"
import { stripCanvasConsent } from "@/lib/stripCanvasConsent"

describe("stripCanvasConsent", () => {
  it("disables consent and hides banner when consent was enabled", () => {
    const next = stripCanvasConsent({
      siteName: "Site",
      analyticsConsent: { enabled: true, version: 1 },
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01" },
        banner: { variant: "shadcnui-blocks.banner-03", visible: true, message: "Cookies" },
      },
    })
    expect(next.analyticsConsent).toEqual({ enabled: false, version: 1 })
    expect(next.chrome?.banner).toMatchObject({ visible: false, message: "Cookies" })
    expect(next.chrome?.header).toEqual({ variant: "shadcnui-blocks.navbar-01" })
  })

  it("leaves announcement banners alone when consent is off", () => {
    const settings = {
      analyticsConsent: { enabled: false },
      chrome: { banner: { variant: "shadcnui-blocks.banner-01", visible: true, message: "Sale" } },
    }
    expect(stripCanvasConsent(settings)).toBe(settings)
  })
})
