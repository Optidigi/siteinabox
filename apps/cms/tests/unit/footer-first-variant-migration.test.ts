import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { normalizeFooterVariantInStoredJson } from "@/migrations/20260828_090000_footer_first_variant"

describe("footer first variant migration", () => {
  it("assigns the owned footer variant without changing footer content", () => {
    const input = {
      settings: {
        chrome: {
          footer: {
            copyright: "© Studio Noord",
            legalLinks: [{ label: "Privacy", href: "/privacy" }],
            variant: "shadcnui-blocks.footer-07",
          },
        },
        navigation: { footer: [{ label: "Contact", href: "/#contact" }] },
      },
    }

    expect(normalizeFooterVariantInStoredJson(input)).toEqual({
      settings: {
        chrome: {
          footer: {
            copyright: "© Studio Noord",
            legalLinks: [{ label: "Privacy", href: "/privacy" }],
            variant: "footer-01",
          },
        },
        navigation: { footer: [{ label: "Contact", href: "/#contact" }] },
      },
    })
  })

  it("defaults a missing chrome footer variant and leaves non-chrome footer keys alone", () => {
    const value = normalizeFooterVariantInStoredJson({
      chrome: { footer: { tagline: "Welkom" } },
      navigation: { footer: { variant: "legacy-navigation-value" } },
    }) as { chrome: { footer: Record<string, unknown> }; navigation: { footer: Record<string, unknown> } }

    expect(value.chrome.footer.variant).toBe("footer-01")
    expect(value.navigation.footer.variant).toBe("legacy-navigation-value")
  })

  it("is registered with the migration chain and creates the canonical enum", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/migrations/20260828_090000_footer_first_variant.ts"),
      "utf8",
    )
    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")
    expect(index).toContain("20260828_090000_footer_first_variant")
    expect(source).toContain("ADD COLUMN IF NOT EXISTS chrome_footer_variant text")
    expect(source).toContain("CREATE TYPE public.enum_site_settings_chrome_footer_variant AS ENUM ('footer-01')")
    expect(source).toContain("published_site_snapshots")
    expect(source).toContain("site_generation_runs")
  })
})
