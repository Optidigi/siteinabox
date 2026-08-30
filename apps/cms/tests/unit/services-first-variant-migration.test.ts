import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { normalizeServicesVariantInJson } from "@/migrations/20260827_090000_services_first_variant"

describe("services first variant migration", () => {
  it("normalizes legacy and missing services variants without changing their content", () => {
    const source = {
      snapshot: {
        pages: [{
          blocks: [
            { blockType: "services", variant: "cards", heading: "Diensten", items: [{ title: "Advies" }] },
            { blockType: "hero", variant: "hero-01", heading: "Welkom" },
          ],
        }],
      },
      generation: { blockType: "services", heading: "Nogmaals helpen" },
    }

    expect(normalizeServicesVariantInJson(source)).toEqual({
      snapshot: {
        pages: [{
          blocks: [
            { blockType: "services", variant: "services-01", heading: "Diensten", items: [{ title: "Advies" }] },
            { blockType: "hero", variant: "hero-01", heading: "Welkom" },
          ],
        }],
      },
      generation: { blockType: "services", heading: "Nogmaals helpen", variant: "services-01" },
    })
  })

  it("is registered and creates the canonical enum and icon field", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/migrations/20260827_090000_services_first_variant.ts"),
      "utf8",
    )
    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")

    expect(index).toContain("20260827_090000_services_first_variant")
    expect(source).toContain("CREATE TYPE public.enum_pages_blocks_services_variant AS ENUM ('services-01')")
    expect(source).toContain("ADD COLUMN IF NOT EXISTS icon varchar")
    expect(source).toContain("UPDATE public.pages_blocks_services")
  })
})
