import { describe, expect, it } from "vitest"
import { stripCanvasConsent } from "@/lib/stripCanvasConsent"

describe("stripCanvasConsent", () => {
  it("disables analytics capture and hides the public consent presentation", () => {
    const next = stripCanvasConsent({
      siteName: "Site",
      analyticsConsent: { enabled: true, version: 1 },
      chrome: { navbar: {}, announcement: { visible: true, message: "Sale" } },
      consent: { visible: true, message: "Cookies" },
    })
    expect(next.analyticsConsent).toEqual({ enabled: false, version: 1 })
    expect(next.consent).toMatchObject({ visible: false, message: "Cookies" })
    expect(next.chrome?.navbar).toEqual({})
    expect(next.chrome?.announcement).toMatchObject({ visible: true, message: "Sale" })
  })

  it("leaves announcement banners alone when consent is off", () => {
    const settings = {
      analyticsConsent: { enabled: false },
      chrome: { announcement: { visible: true, message: "Sale" } },
    }
    expect(stripCanvasConsent(settings)).toBe(settings)
  })

  it("can preserve the consent rail for customer preview while disabling analytics", () => {
    const settings = {
      analyticsConsent: { enabled: true },
      consent: { visible: true, message: "Cookies" },
    }

    expect(stripCanvasConsent(settings, { hidePresentation: false })).toEqual({
      analyticsConsent: { enabled: false },
      consent: { visible: true, message: "Cookies" },
    })
  })
})
