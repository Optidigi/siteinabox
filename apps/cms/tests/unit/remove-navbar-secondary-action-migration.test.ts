import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { normalizeNavbarActionsInStoredJson } from "@/migrations/20260826_100000_remove_navbar_secondary_action"

describe("remove navbar secondary action migration", () => {
  it("promotes a usable old secondary action and leaves content secondary actions intact", () => {
    const normalized = normalizeNavbarActionsInStoredJson({
      settings: {
        chrome: {
          navbar: {
            cta: { label: "", href: "" },
            secondaryAction: { label: "Bekijk diensten", href: "#services", external: false },
          },
        },
        blocks: [{ secondaryAction: { label: "Meer", href: "#more" } }],
      },
    }) as {
      settings: {
        chrome: { navbar: Record<string, unknown> }
        blocks: Array<Record<string, unknown>>
      }
    }

    expect(normalized.settings.chrome.navbar.cta).toEqual({
      label: "Bekijk diensten",
      href: "#services",
      external: false,
    })
    expect(normalized.settings.chrome.navbar).not.toHaveProperty("secondaryAction")
    expect(normalized.settings.blocks[0]).toHaveProperty("secondaryAction")
  })

  it("keeps an existing usable CTA over the old secondary action", () => {
    const normalized = normalizeNavbarActionsInStoredJson({
      chrome: {
        navbar: {
          cta: { label: "Neem contact op", href: "#contact", external: false },
          secondaryAction: { label: "Diensten", href: "#services", external: false },
        },
      },
    }) as { chrome: { navbar: Record<string, unknown> } }

    expect(normalized.chrome.navbar.cta).toEqual({
      label: "Neem contact op",
      href: "#contact",
      external: false,
    })
    expect(normalized.chrome.navbar).not.toHaveProperty("secondaryAction")
  })

  it("is wired into the migration chain and drops the legacy physical columns", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/migrations/20260826_100000_remove_navbar_secondary_action.ts"),
      "utf8",
    )
    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")
    expect(index).toContain("20260826_100000_remove_navbar_secondary_action")
    expect(source).toContain("DROP COLUMN IF EXISTS chrome_navbar_secondary_action_label")
    expect(source).toContain("DROP COLUMN IF EXISTS chrome_navbar_secondary_action_href")
    expect(source).toContain("DROP COLUMN IF EXISTS chrome_navbar_secondary_action_external")
  })
})
