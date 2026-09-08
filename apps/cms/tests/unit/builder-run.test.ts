import { beforeEach, describe, expect, it, vi } from "vitest"
import { BuilderChatRequestSchema, runBuilderTurn } from "@/lib/builder/runBuilderTurn"
import { allowPreviewMagicLinkWithoutGrant } from "@/lib/builder/magicLinkPolicy"

vi.mock("@/lib/intake/storeIntakeSubmission", () => ({
  storeIntakeSubmission: vi.fn(async () => ({ ok: true, reused: false, status: "submitted", intakeSubmissionId: 9 })),
}))
vi.mock("@/lib/intake/processIntakeSubmission", () => ({
  processStoredIntakeSubmission: vi.fn(async () => ({
    ok: true,
    reused: false,
    status: "preview_ready",
    intakeSubmissionId: 9,
    generationRunId: 44,
    tenantId: 3,
  })),
}))
vi.mock("@/lib/preview/previewAccess", () => ({
  createOrRefreshPreviewGrant: vi.fn(async () => ({
    id: 70,
    clientSlug: "tilburg-kapper",
  })),
}))

describe("runBuilderTurn", () => {
  beforeEach(() => {
    process.env.SITE_GENERATION_PROVIDER = "mock"
    delete process.env.OPENAI_API_KEY
  })
  it("creates a self-serve preview grant without a HMAC cookie", async () => {
    const { createOrRefreshPreviewGrant } = await import("@/lib/preview/previewAccess")
    process.env.SITE_GENERATION_PROVIDER = "mock"

    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken. Strak blauw, modern.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      contactPhone: "0612345678",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.clientSlug).toBe("tilburg-kapper")
    expect(result).not.toHaveProperty("previewToken")
    expect(createOrRefreshPreviewGrant).toHaveBeenCalledWith(expect.objectContaining({
      generationRunId: 44,
      customerEmail: "anna@example.com",
      sendEmail: false,
    }))
  })

  it("asks which module to arm before the first generate", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("needs_brief")
    expect(result.text).toMatch(/contact|optie|WhatsApp|bellen|afspraak|formulier/i)
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("keeps a stored brief when the module answer is short", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const previous = {
      businessName: "Loodgieter Eindhoven",
      intro: "Ik ben loodgieter in Eindhoven en doe keukens en badkamers voor lokale klanten.",
      offers: [{ value: "Keukens" }, { value: "Badkamers" }],
      audience: "Lokale klanten in Eindhoven",
      situation: "Klanten zoeken een duidelijke, professionele eerste indruk online.",
      approach: "We luisteren, geven helder advies en lossen het praktisch op.",
      region: "Eindhoven",
      notes: "",
      selectedActions: ["phone" as const],
      formType: "message" as const,
      briefStage: "modules" as const,
      colorSchemeId: "monochrome" as const,
      fontSchemeId: "clear-modern" as const,
      shapeSchemeId: "soft" as const,
      appearanceMode: "light" as const,
      lookConfirmed: true as const,
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "whatsappen alsjeblieft",
      contactName: "Jan",
      contactEmail: "jan@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      previousFacts: previous,
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.clientSlug).toBe("tilburg-kapper")
    expect(processStoredIntakeSubmission).toHaveBeenCalled()
  })

  it("does not rebuild from a ready brief on an unrelated message", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const previous = {
      businessName: "Loodgieter Eindhoven",
      intro: "Ik ben loodgieter in Eindhoven en doe keukens en badkamers voor lokale klanten.",
      offers: [{ value: "Keukens" }, { value: "Badkamers" }],
      audience: "Lokale klanten in Eindhoven",
      situation: "Klanten zoeken een duidelijke, professionele eerste indruk online.",
      approach: "We luisteren, geven helder advies en lossen het praktisch op.",
      region: "Eindhoven",
      notes: "",
      selectedActions: ["whatsapp" as const],
      formType: "message" as const,
      briefStage: "ready" as const,
      colorSchemeId: "monochrome" as const,
      fontSchemeId: "clear-modern" as const,
      shapeSchemeId: "soft" as const,
      appearanceMode: "light" as const,
      lookConfirmed: true as const,
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "wat vind je van een kringspier",
      contactName: "Jan",
      contactEmail: "jan@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      previousFacts: previous,
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.clientSlug).toBeUndefined()
    expect(result.text).toMatch(/homepage/i)
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("reuses an existing preview site instead of provisioning again", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 3, slug: "tilburg-kapper" }] })),
      update: vi.fn(),
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      existingClientSlug: "tilburg-kapper",
    })
    const result = await runBuilderTurn(payload as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("maintaining")
    expect(result.clientSlug).toBe("tilburg-kapper")
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("applies theme patches on an existing site without asking for a new brief", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 3, slug: "tilburg-kapper" }] })),
      update: vi.fn(async ({ id }: { id: string | number }) => ({ id, slug: "tilburg-kapper" })),
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "Maak het thema groen en donker.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      existingClientSlug: "tilburg-kapper",
    })
    const result = await runBuilderTurn(payload as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("maintaining")
    expect(result.text).toMatch(/thema/i)
    expect(payload.update).toHaveBeenCalled()
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("refuses maintainer writes when the existing tenant is missing", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    const payload = {
      find: vi.fn(async () => ({ docs: [] })),
      findByID: vi.fn(async () => {
        throw new Error("not found")
      }),
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      existingClientSlug: "tilburg-kapper",
      existingTenantId: 3,
    })
    const result = await runBuilderTurn(payload as never, parsed)
    expect(result.ok).toBe(false)
    expect(result.error).toBe("tenant_not_found")
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("regenerates on the same tenant when asked to start over", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 3, slug: "tilburg-kapper" }] })),
      update: vi.fn(),
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "begin opnieuw alsjeblieft",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      existingClientSlug: "tilburg-kapper",
      previousFacts: {
        businessName: "Kapper Tilburg",
        intro: "Wij helpen klanten lokaal en persoonlijk verder met knippen.",
        offers: [{ value: "Knippen" }, { value: "Kleur" }],
        audience: "Lokale klanten en ondernemers in de buurt",
        situation: "Klanten zoeken een duidelijke, professionele eerste indruk online.",
        approach: "We luisteren, geven helder advies en lossen het praktisch op.",
        region: "Tilburg",
        notes: "",
        selectedActions: ["appointment", "phone"],
        formType: "appointment",
        briefStage: "ready",
        colorSchemeId: "monochrome",
        fontSchemeId: "clear-modern",
        shapeSchemeId: "soft",
        appearanceMode: "light",
      },
    })
    const result = await runBuilderTurn(payload as never, parsed)
    expect(result.ok).toBe(true)
    expect(processStoredIntakeSubmission).toHaveBeenCalledWith(
      payload,
      9,
      expect.objectContaining({ retireUnspecifiedPages: true, pinTenantId: 3 }),
    )
    expect(result.clientSlug).toBe("tilburg-kapper")
  })

  it("asks for a real brief instead of generating from a greeting", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const parsed = BuilderChatRequestSchema.parse({
      message: "hey, help",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("needs_brief")
    expect(result.clientSlug).toBeUndefined()
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("asks for legal acceptance before generating", async () => {
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: false, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(false)
    expect(result.error).toBe("legal_required")
  })

  it("uses stored facts so a short module answer can generate", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const previous = {
      businessName: "Kapper Tilburg",
      intro: "Ik ben kapper in Tilburg en doe knippen, kleur en baard voor lokale klanten.",
      offers: [{ value: "Knippen" }, { value: "Kleur" }, { value: "Baard" }],
      audience: "Lokale klanten in Tilburg",
      situation: "Klanten zoeken een duidelijke, professionele eerste indruk online.",
      approach: "We luisteren, geven helder advies en lossen het praktisch op.",
      region: "Tilburg",
      notes: "",
      selectedActions: ["phone" as const],
      formType: "message" as const,
      briefStage: "modules" as const,
      colorSchemeId: "monochrome" as const,
      fontSchemeId: "clear-modern" as const,
      shapeSchemeId: "soft" as const,
      appearanceMode: "light" as const,
      lookConfirmed: true as const,
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "Bezoekers mogen WhatsAppen.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      previousFacts: previous,
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.clientSlug).toBe("tilburg-kapper")
    expect(result.text).toMatch(/homepage|catalogus|FAQ|portfolio/i)
    expect(processStoredIntakeSubmission).toHaveBeenCalled()
  })

  it("does not sell unavailable FAQ or portfolio families", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik wil een FAQ pagina en een portfolio.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("unavailable")
    expect(result.text).toMatch(/catalogus/i)
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })

  it("generates a homepage and stays honest when a ready brief also asks for FAQ", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken. Strak blauw, modern. Ik wil ook een FAQ.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.clientSlug).toBe("tilburg-kapper")
    expect(result.text).toMatch(/FAQ|catalogus/i)
    expect(result.text).not.toMatch(/volledige website/i)
    expect(processStoredIntakeSubmission).toHaveBeenCalled()
  })

  it("refuses FAQ-only follow-ups even when stored facts are already ready", async () => {
    const { processStoredIntakeSubmission } = await import("@/lib/intake/processIntakeSubmission")
    vi.mocked(processStoredIntakeSubmission).mockClear()
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const previous = {
      businessName: "Kapper Tilburg",
      intro: "Ik ben kapper in Tilburg en doe knippen, kleur en baard voor lokale klanten.",
      offers: [{ value: "Knippen" }, { value: "Kleur" }, { value: "Baard" }],
      audience: "Lokale klanten in Tilburg",
      situation: "Klanten zoeken een duidelijke, professionele eerste indruk online.",
      region: "Tilburg",
      notes: "",
      approach: "We luisteren, geven helder advies en lossen het praktisch op.",
      selectedActions: ["appointment" as const],
      formType: "appointment" as const,
      briefStage: "ready" as const,
      colorSchemeId: "monochrome" as const,
      fontSchemeId: "clear-modern" as const,
      shapeSchemeId: "soft" as const,
      appearanceMode: "light" as const,
    }
    const parsed = BuilderChatRequestSchema.parse({
      message: "Ik wil een FAQ pagina en een portfolio.",
      contactName: "Anna",
      contactEmail: "anna@example.com",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      previousFacts: previous,
    })
    const result = await runBuilderTurn({} as never, parsed)
    expect(result.ok).toBe(true)
    expect(result.status).toBe("unavailable")
    expect(result.clientSlug).toBeUndefined()
    expect(processStoredIntakeSubmission).not.toHaveBeenCalled()
  })
})

describe("builder magic-link policy", () => {
  it("allows first-time builder access without a grant", () => {
    expect(allowPreviewMagicLinkWithoutGrant({})).toBe(true)
  })

  it("still requires a grant when a preview slug is present", () => {
    expect(allowPreviewMagicLinkWithoutGrant({
      previewClientSlug: "tilburg-kapper",
    })).toBe(false)
  })
})
