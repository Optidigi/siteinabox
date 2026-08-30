import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { normalizeCtaVariantInJson } from "@/migrations/20260827_100000_cta_first_variant"

describe("CTA first variant migration", () => {
  it("normalizes legacy and missing CTA variants without changing their content", () => {
    const source = {
      snapshot: {
        pages: [{
          blocks: [
            { blockType: "cta", variant: "old-card", heading: "Contact", primaryAction: { label: "Mail", href: "/mail" } },
            { blockType: "hero", variant: "hero-01", heading: "Welkom" },
          ],
        }],
      },
      generation: { blockType: "cta", heading: "Nog een stap" },
    }

    expect(normalizeCtaVariantInJson(source)).toEqual({
      snapshot: {
        pages: [{
          blocks: [
            { blockType: "cta", variant: "cta-01", heading: "Contact", primaryAction: { label: "Mail", href: "/mail" } },
            { blockType: "hero", variant: "hero-01", heading: "Welkom" },
          ],
        }],
      },
      generation: { blockType: "cta", heading: "Nog een stap", variant: "cta-01" },
    })
  })

  it("is registered and creates the canonical CTA enum", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/migrations/20260827_100000_cta_first_variant.ts"),
      "utf8",
    )
    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")

    expect(index).toContain("20260827_100000_cta_first_variant")
    expect(source).toContain("CREATE TYPE public.enum_pages_blocks_cta_variant AS ENUM ('cta-01')")
    expect(source).toContain("UPDATE public.pages_blocks_cta")
    expect(source).toContain("published_site_snapshots")
  })
})
