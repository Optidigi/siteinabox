import { describe, expect, it } from "vitest"
import { renameBackgroundModeKey } from "@/migrations/20260828_110000_rename_theme_background_mode"

describe("rename theme background mode migration", () => {
  it("renames the persisted nested theme key without changing other data", () => {
    const legacy = {
      theme: { version: 3, appearance: { mode: "dark", heroBackground: "mesh" } },
      spec: {
        blocks: [{ blockType: "hero", variant: "hero-01", heading: "Welkom" }],
      },
    }

    expect(renameBackgroundModeKey(legacy)).toEqual({
      theme: { version: 3, appearance: { mode: "dark", backgroundMode: "mesh" } },
      spec: {
        blocks: [{ blockType: "hero", variant: "hero-01", heading: "Welkom" }],
      },
    })
  })

  it("keeps the canonical value when both spellings are present", () => {
    const mixed = {
      appearance: { heroBackground: "grid", backgroundMode: "none" },
    }

    expect(renameBackgroundModeKey(mixed)).toEqual({
      appearance: { backgroundMode: "none" },
    })
  })

  it("supports a reversible down migration", () => {
    const canonical = { appearance: { mode: "light", backgroundMode: "animation" } }

    expect(renameBackgroundModeKey(canonical, true)).toEqual({
      appearance: { mode: "light", heroBackground: "animation" },
    })
  })
})
