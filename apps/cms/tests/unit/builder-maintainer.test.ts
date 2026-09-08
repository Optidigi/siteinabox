import { describe, expect, it, vi } from "vitest"
import { interpretMaintainerIntent } from "@/lib/agent/interpretMaintainer"
import { applyMaintainerTurn } from "@/lib/agent/runMaintainerTurn"
import { themeTokenSpecFromFacts } from "@/lib/agent/themeFromFacts"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { appointmentsSettingsFromIntake, themeTokenSpecFromIntake } from "@/lib/sitegen/normalize"
import { buildRawIntakeFromBuilderFacts } from "@/lib/builder/rawIntake"
import { normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"

describe("maintainer intent", () => {
  it("routes theme and copy patches without a full regenerate", () => {
    expect(interpretMaintainerIntent("Maak het thema groen en donker.")).toEqual({ kind: "setTheme" })
    expect(interpretMaintainerIntent("titel: Knippen in Tilburg")).toEqual({
      kind: "updateSectionProps",
      field: "heading",
      value: "Knippen in Tilburg",
    })
    expect(interpretMaintainerIntent("gebruik hero-05")).toEqual({ kind: "replaceSection", variant: "hero-05" })
    expect(interpretMaintainerIntent("Openingstijden 09:00-17:00")).toEqual({
      kind: "setHours",
      open: "09:00",
      close: "17:00",
    })
    expect(interpretMaintainerIntent("begin opnieuw")).toEqual({ kind: "regenerate" })
    expect(interpretMaintainerIntent("Bezoekers kunnen een afspraak maken.")).toEqual({ kind: "setAppointments" })
    expect(interpretMaintainerIntent("Ziet er goed uit, dankjewel.")).toEqual({ kind: "none" })
  })

  it("does not write site-settings for editors", async () => {
    const payload = { find: vi.fn(), update: vi.fn() }
    const facts = heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen.", null)
    const result = await applyMaintainerTurn({
      payload: payload as never,
      tenantId: 7,
      message: "Bezoekers kunnen een afspraak maken.",
      facts,
      role: "editor",
      user: { id: 2, role: "editor" } as never,
    })
    expect(result.applied).toBe(false)
    expect(result.text).toMatch(/eigenaar/i)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe("theme and appointments from builder intake", () => {
  it("bridges scheme ids and arms weekday appointment windows", () => {
    const facts = heuristicExtractBuilderFacts(
      "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Groen en donker.",
      null,
    )
    const themed = {
      ...facts,
      formType: "appointment" as const,
      selectedActions: ["appointment" as const, "phone" as const],
      colorSchemeId: "emerald-calm" as const,
      appearanceMode: "dark" as const,
    }
    expect(themeTokenSpecFromFacts(themed)).toMatchObject({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
    })
    const intake = normalizeIntakeSubmission(buildRawIntakeFromBuilderFacts({
      facts: themed,
      contact: { name: "Anna", email: "anna@example.com", phone: "0612345678" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      recordedAt: "2026-09-05T10:00:00.000Z",
    }))
    expect(themeTokenSpecFromIntake(intake).colors.schemeId).toBe("emerald-calm")
    expect(themeTokenSpecFromIntake(intake).appearance.mode).toBe("dark")
    const appointments = appointmentsSettingsFromIntake(intake)
    expect(appointments?.enabled).toBe(true)
    expect(appointments?.weeklyAvailability).toHaveLength(5)
  })
})
