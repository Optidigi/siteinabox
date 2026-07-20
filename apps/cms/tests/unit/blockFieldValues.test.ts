import { describe, expect, it } from "vitest"
import {
  asCtaValue,
  asIconValue,
  resolveMediaDisplayUrl,
  updateCtaHref,
  updateCtaLabel,
} from "@/lib/editor/blockFieldValues"

describe("blockFieldValues", () => {
  it("normalizes CTA values and updates fields immutably", () => {
    const cta = asCtaValue({ label: "Go", href: "/x" })
    expect(updateCtaLabel(cta, "Next").label).toBe("Next")
    expect(updateCtaHref(cta, "/y").href).toBe("/y")
    expect(asCtaValue(null)).toEqual({})
  })

  it("normalizes icon values", () => {
    expect(asIconValue("star")).toBe("star")
    expect(asIconValue("  ")).toBeNull()
    expect(asIconValue(42)).toBeNull()
  })

  it("resolves media display URLs", () => {
    expect(resolveMediaDisplayUrl("/img.png")).toBe("/img.png")
    expect(resolveMediaDisplayUrl({ url: "https://cdn.test/a.png" })).toBe("https://cdn.test/a.png")
    expect(resolveMediaDisplayUrl({ filename: "hero.jpg" })).toBe("/media/hero.jpg")
    expect(resolveMediaDisplayUrl(null)).toBeNull()
  })
})
