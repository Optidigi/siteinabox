import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PublicIntakeSubmission } from "@siteinabox/contracts/generation"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/email/sendEmail", async () => {
  const actual = await vi.importActual<any>("@/lib/email/sendEmail")
  return {
    ...actual,
    getPlatformMailSender: () => "noreply@siteinabox.nl",
    sendEmail: mocks.sendEmail,
  }
})

import { storeIntakeSubmission } from "@/lib/intake/storeIntakeSubmission"

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as any).equals)
    }
    return doc[field] === condition
  })
}

const createPayloadStub = () => {
  let nextId = 1
  type CollectionSlug = "intake-submissions" | "site-generation-runs" | "communication-preferences" | "communication-preference-events"
  const store: Record<CollectionSlug, any[]> = {
    "intake-submissions": [],
    "site-generation-runs": [],
    "communication-preferences": [],
    "communication-preference-events": [],
  }
  const payload = {
    db: {
      beginTransaction: async () => "tx-intake",
      commitTransaction: async () => undefined,
      rollbackTransaction: async () => undefined,
    },
    find: async (args: any) => {
      const docs = store[args.collection as CollectionSlug].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: any) => {
      const doc = { ...args.data, id: nextId++ }
      store[args.collection as CollectionSlug].push(doc)
      return doc
    },
    update: async (args: any) => {
      const doc = store[args.collection as CollectionSlug].find((entry) => String(entry.id) === String(args.id))
      if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
      Object.assign(doc, args.data)
      return doc
    },
    logger: { warn: vi.fn() },
  }
  return { payload: payload as any, store }
}

const rawIntake = (): PublicIntakeSubmission => ({
  submittedAt: "2026-06-29T10:00:00.000Z",
  source: "public-intake",
  company: {
    source: "kvk",
    companyName: "Storage Demo",
    kvkNumber: "12345678",
    address: "Stationsplein 1, Roermond",
    website: "https://storage-demo.nl",
    mainActivity: "Interieuradvies",
    secondaryActivities: ["Projectbegeleiding"],
  },
  content: {
    intro: "Wij helpen ondernemers met praktische interieurplannen.",
    offers: [{ value: "Interieuradvies" }],
    audience: "Lokale ondernemers",
    situation: "Klanten willen hun ruimte professioneler maken.",
    approach: "We starten met een intake en concreet plan.",
    workModes: ["on_location", "fixed_region"],
    region: "Limburg",
    notes: "",
  },
  contact: {
    selectedActions: ["message", "quote"],
    formType: "multiple",
    formOptions: ["message", "quote"],
    primaryAction: "quote",
    phoneNumber: "0612345678",
    whatsappMode: "same",
    whatsappNumber: "",
    locationOptions: ["region"],
    publicRegion: "Limburg",
    publicAddress: "",
    availabilityMode: "appointment_only",
    openingHours: "",
  },
  visual: {
    logo: { mode: "textlogo", file: null, text: "Storage Demo" },
    color: {
      sourceType: "preset",
      sourceValue: "green",
      selectedPalette: "palette_1",
      tokens: {
        background: "#ffffff",
        foreground: "#111111",
        card: "#ffffff",
        cardForeground: "#111111",
        primary: "#146c43",
        primaryForeground: "#ffffff",
        secondary: "#e7f3ed",
        secondaryForeground: "#111111",
        muted: "#f3f4f6",
        mutedForeground: "#4b5563",
        accent: "#d1fae5",
        accentForeground: "#111111",
        border: "#d1d5db",
        input: "#d1d5db",
        ring: "#146c43",
        destructive: "#dc2626",
        destructiveForeground: "#ffffff",
      },
    },
    shape: "slightly_rounded",
    typography: "clear",
  },
  finalDetails: {
    name: "Demo Contact",
    email: "demo@example.com",
    phone: "0612345678",
  },
  legal: {
    businessUseDeclaration: {
      accepted: true,
      statementVersion: "business-use-2026-07-07.1",
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    termsAcceptance: {
      accepted: true,
      ...CURRENT_INTAKE_TERMS_ACCEPTANCE,
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    marketingConsent: {
      granted: false,
      statementVersion: "marketing-opt-in-2026-07-07.1",
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    privacyNotice: {
      documentVersion: "2026-07-07.1",
      url: "https://www.siteinabox.nl/privacy-en-cookieverklaring",
    },
  },
  domain: "storage-demo.nl",
  email: "demo@example.com",
  addOns: [],
  notes: null,
})

describe("storeIntakeSubmission", () => {
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ provider: "test", providerMessageId: "msg_1" })
  })

  it("stores raw and normalized public intake without creating a generation run", async () => {
    const { payload, store } = createPayloadStub()

    const result = await storeIntakeSubmission(payload, rawIntake())

    expect(result.ok).toBe(true)
    expect(result.status).toBe("normalized")
    expect(result.intakeSubmissionId).toBe(1)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(0)
    expect(store["communication-preferences"]).toHaveLength(1)
    expect(store["communication-preferences"][0]).toMatchObject({
      email: "demo@example.com",
      marketing: false,
      suppressed: false,
      statementVersion: "marketing-opt-in-2026-07-07.1",
    })
    expect(store["communication-preference-events"][0]).toMatchObject({
      action: "opt_out",
      source: "public-intake",
    })
    expect(store["intake-submissions"][0]).toMatchObject({
      businessName: "Storage Demo",
      contactName: "Demo Contact",
      contactEmail: "demo@example.com",
      status: "normalized",
      raw: rawIntake(),
      normalized: {
        businessName: "Storage Demo",
        tenantSlug: "storage-demo",
        companyFacts: {
          source: "kvk",
          companyName: "Storage Demo",
          kvkNumber: "12345678",
        },
      },
    })
    expect(store["intake-submissions"][0]?.normalizedHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store["intake-submissions"][0]?.idempotencyKey).toMatch(/^public-intake:normalized:/)
    expect(store["intake-submissions"][0]?.statusTransitions.map((entry: any) => entry.status)).toEqual([
      "submitted",
      "normalized",
    ])
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@siteinabox.nl",
      from: "noreply@siteinabox.nl",
      intent: "intake.internal_notification",
      payload,
    }))
  })

  it("reuses the staged intake record for the same raw and normalized body", async () => {
    const { payload, store } = createPayloadStub()

    const first = await storeIntakeSubmission(payload, rawIntake())
    const second = await storeIntakeSubmission(payload, rawIntake())

    expect(first.reused).toBe(false)
    expect(second.reused).toBe(true)
    expect(second.intakeSubmissionId).toBe(first.intakeSubmissionId)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(0)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it("keeps intake storage non-blocking when internal notification fails", async () => {
    const { payload, store } = createPayloadStub()
    mocks.sendEmail.mockRejectedValueOnce(new Error("smtp down"))

    const result = await storeIntakeSubmission(payload, rawIntake())

    expect(result.ok).toBe(true)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      intakeSubmissionId: 1,
      status: "normalized",
      error: "smtp down",
    }), "[intake] internal notification failed")
  })
})
