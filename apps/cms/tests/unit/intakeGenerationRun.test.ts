import { describe, expect, it } from "vitest"
import type { SiteGenerationProvider } from "@/lib/ai-generation/providers"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"
import { buildGenerationInput, hashStableValue, normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"
import {
  processIntakeSubmission,
  processReviewedIntakeSubmission,
  processStoredIntakeSubmission,
} from "@/lib/intake/processIntakeSubmission"

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
  type CollectionSlug =
    | "intake-submissions"
    | "site-generation-runs"
    | "tenants"
    | "pages"
    | "site-settings"
    | "media"
  const store: Record<CollectionSlug, any[]> = {
    "intake-submissions": [],
    "site-generation-runs": [],
    tenants: [],
    pages: [],
    "site-settings": [],
    media: [],
  }
  const payload = {
    find: async (args: any) => {
      const docs = store[args.collection as CollectionSlug].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: any) => {
      const doc = { ...args.data, id: nextId++ }
      store[args.collection as CollectionSlug].push(doc)
      return doc
    },
    findByID: async (args: any) => {
      const doc = store[args.collection as CollectionSlug].find((entry) => String(entry.id) === String(args.id))
      if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
      return doc
    },
    update: async (args: any) => {
      const docs = store[args.collection as CollectionSlug]
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const current = docs[index]!
      docs[index] = { ...current, ...args.data, id: current.id }
      return docs[index]!
    },
  }
  return { payload: payload as any, store }
}

const rawIntake = () => ({
  source: "public-intake",
  businessName: "Phase Six Bakery",
  domain: "phase-six-bakery.test",
  contactName: "Sam Intake",
  contactEmail: "sam@example.com",
  language: "nl",
  industry: "Bakery",
  serviceArea: ["Amsterdam"],
  goals: ["Launch preview"],
  pages: [{ slug: "home", title: "Home", purpose: "Homepage" }],
})

describe("processIntakeSubmission", () => {
  it("creates intake and generation-run records and applies mocked draft CMS data", async () => {
    const { payload, store } = createPayloadStub()

    const result = await processIntakeSubmission(payload, rawIntake())

    expect(result.ok).toBe(true)
    expect(result.status).toBe("preview_ready")
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages.length).toBeGreaterThan(0)
    expect(store["site-settings"]).toHaveLength(1)
    expect(store.tenants[0]).toMatchObject({
      name: "Phase Six Bakery",
      slug: "phase-six-bakery",
      domain: "phase-six-bakery.test",
      emailSending: {
        provider: "cloudflare",
        mode: "subdomain",
        status: "not_configured",
        sendingDomain: "mail.phase-six-bakery.test",
        senderEmail: "noreply@mail.phase-six-bakery.test",
      },
    })
    expect(store["site-settings"][0]?.contactEmail).toBe("sam@example.com")
    expect(store["site-settings"][0]?.chrome?.header?.variant).toBe("tailwindplus.marketing.header.with-stacked-flyout-menu")
    expect(store["site-settings"][0]?.chrome?.header?.cta).toMatchObject({ label: "Contact", href: "mailto:sam@example.com" })
    expect(store["site-settings"][0]?.chrome?.footer?.variant).toBe("default")
    expect(store["site-settings"][0]?.chrome?.banner?.variant).toBe("tailwindplus.marketing.banner.with-button")
    expect(store["site-settings"][0]?.chrome?.banner?.link).toMatchObject({ label: "Contact", href: "/#contact" })
    expect(store.pages.every((page) => page.status === "draft")).toBe(true)
    expect(store["site-generation-runs"][0]?.applyResult?.ok).toBe(true)
    expect(store["site-generation-runs"][0]?.provider).toBe("mock")
    expect(store["site-generation-runs"][0]?.model).toBe("fixture:generic")
    expect(store["site-generation-runs"][0]?.promptVersion).toBe("site-generation-v1")
    expect(store["site-generation-runs"][0]?.generationInputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store["site-generation-runs"][0]?.generationOutputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store["site-generation-runs"][0]?.parsedOutput?.schemaVersion).toBe(1)
    expect(JSON.stringify(store["site-generation-runs"][0]?.parsedOutput).toLowerCase()).not.toMatch(/amicare|ami-care/)
    expect(store["site-generation-runs"][0]?.normalizedIntake?.requestedPages[0]?.slug).toBe("index")
    expect(store["site-generation-runs"][0]?.statusTransitions.map((entry: any) => entry.status)).toContain("applying")
    expect(store.pages).toHaveLength(1)
    expect(store.pages[0]?.slug).toBe("index")
    expect(store.pages[0]?.blocks.map((block: any) => `${block.blockType}:${block.designVariant}`)).toEqual([
      "hero:tailwindplus.marketing.hero.simple-centered",
      "logoCloud:tailwindplus.marketing.logo-cloud.simple-with-heading",
      "featureList:tailwindplus.marketing.feature.centered-2x2-grid",
      "featureList:tailwindplus.marketing.feature.with-product-screenshot",
      "contentSection:tailwindplus.marketing.content.sticky-product-screenshot",
      "bentoGrid:tailwindplus.marketing.bento.three-column-bento-grid",
      "stats:tailwindplus.marketing.stats.simple",
      "hero:tailwindplus.marketing.hero.with-stats",
      "testimonials:tailwindplus.marketing.testimonial.simple-centered",
      "pricing:tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
      "team:tailwindplus.marketing.team.with-small-images",
      "blogCards:tailwindplus.marketing.blog.three-column",
      "newsletter:tailwindplus.marketing.newsletter.side-by-side-with-details",
      "cta:tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
      "contactSection:tailwindplus.marketing.contact.centered",
    ])
    const blocksByVariant = new Map<string, any>(store.pages[0]?.blocks.map((block: any) => [block.designVariant, block]))
    expect(blocksByVariant.get("tailwindplus.marketing.hero.simple-centered")).toMatchObject({
      cta: { label: "Bekijk workflow", href: "/#workflow" },
      secondary: { label: "Contact", href: "mailto:sam@example.com" },
    })
    expect(blocksByVariant.get("tailwindplus.marketing.hero.simple-centered")).not.toHaveProperty("image")
    expect(blocksByVariant.get("tailwindplus.marketing.hero.with-stats")?.links).toHaveLength(4)
    expect(blocksByVariant.get("tailwindplus.marketing.hero.with-stats")?.stats).toHaveLength(4)
    expect(blocksByVariant.get("tailwindplus.marketing.hero.with-stats")).not.toHaveProperty("cta")
    expect(blocksByVariant.get("tailwindplus.marketing.hero.with-stats")).not.toHaveProperty("secondary")
    expect(blocksByVariant.get("tailwindplus.marketing.feature.with-product-screenshot")?.features).toHaveLength(3)
    expect(blocksByVariant.get("tailwindplus.marketing.feature.with-product-screenshot")?.features.every((feature: any) => feature.description?.variant === "block")).toBe(true)
    expect(blocksByVariant.get("tailwindplus.marketing.content.sticky-product-screenshot")?.features).toHaveLength(3)
    expect(typeof blocksByVariant.get("tailwindplus.marketing.content.sticky-product-screenshot")?.image).toBe("number")
    expect(blocksByVariant.get("tailwindplus.marketing.content.sticky-product-screenshot")?.features.every((feature: any) => !("icon" in feature))).toBe(true)
    expect(blocksByVariant.get("tailwindplus.marketing.bento.three-column-bento-grid")?.items).toHaveLength(4)
    expect(blocksByVariant.get("tailwindplus.marketing.bento.three-column-bento-grid")?.items.every((item: any) => !("icon" in item) && !("cta" in item))).toBe(true)
    expect(blocksByVariant.get("tailwindplus.marketing.bento.three-column-bento-grid")?.items.filter((item: any) => typeof item.image === "number")).toHaveLength(3)
    expect(blocksByVariant.get("tailwindplus.marketing.newsletter.side-by-side-with-details")?.benefits).toHaveLength(2)
    expect(blocksByVariant.get("tailwindplus.marketing.newsletter.side-by-side-with-details")?.benefits.every((benefit: any) => !("icon" in benefit))).toBe(true)
    expect(blocksByVariant.get("tailwindplus.marketing.newsletter.side-by-side-with-details")).not.toHaveProperty("consentLabel")
    expect(blocksByVariant.get("tailwindplus.marketing.contact.centered")?.fields).toHaveLength(6)
    expect(store.media.length).toBeGreaterThan(0)
    expect(store["site-generation-runs"][0]?.parsedOutput?.blocks.map((block: any) => block.slug)).toEqual([
      "hero",
      "logoCloud",
      "featureList",
      "contentSection",
      "bentoGrid",
      "stats",
      "testimonials",
      "pricing",
      "team",
      "blogCards",
      "newsletter",
      "cta",
      "contactSection",
    ])
    expect(store.pages[0]?.blocks.every((block: any) => !("variant" in block))).toBe(true)
    expect(store.pages[0]?.blocks.every((block: any) => Object.keys(block.analytics ?? {}).every((key) => key !== "legacyVisualIdentity"))).toBe(true)
    expect(JSON.stringify(store.pages[0]?.blocks).toLowerCase()).not.toMatch(/preline|tailblocks|tailwindplussimpletiers|tailwindplusnewsletterdetails/)
    expect(JSON.stringify(store.pages[0]?.blocks).toLowerCase()).not.toContain("shadcn")
  })

  it("records failed state when mocked generation produces an invalid spec", async () => {
    const { payload, store } = createPayloadStub()

    const result = await processIntakeSubmission(payload, rawIntake(), { mockFixture: "invalid" })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("failed")
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-generation-runs"][0]?.errors?.message).toBe("Generated SiteGenerationSpec failed validation")
    expect(store["site-generation-runs"][0]?.validation?.issues.map((entry: any) => entry.code)).toContain("invalid_tenant_slug")
  })

  it("fails safely when a provider returns an unsupported block type", async () => {
    const { payload, store } = createPayloadStub()
    const provider: SiteGenerationProvider = {
      name: "mock",
      model: "fixture:unsupported-block",
      promptVersion: "site-generation-v1",
      async generate(request) {
        const spec = loadMockSiteGenerationSpec(request.normalized)
        spec.pages[0]!.blocks[0] = {
          ...spec.pages[0]!.blocks[0]!,
          blockType: "unsupportedBlock",
        } as any
        return {
          provider: "mock",
          model: "fixture:unsupported-block",
          promptVersion: "site-generation-v1",
          input: request.input,
          inputHash: request.inputHash,
          outputHash: "bad-output",
          rawOutput: JSON.stringify(spec),
          parsedOutput: spec,
          spec,
        }
      },
    }

    const result = await processIntakeSubmission(payload, rawIntake(), { provider })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("failed")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
    expect(store["site-generation-runs"][0]?.errors?.message).toBe("Generated SiteGenerationSpec failed validation")
    expect(store["site-generation-runs"][0]?.validation?.issues.map((entry: any) => entry.code)).toContain("unsupported_block_type")
  })

  it("fails safely before CMS writes when a future generated tenant uses tenant-exclusive variants or code payloads", async () => {
    const { payload, store } = createPayloadStub()
    const provider: SiteGenerationProvider = {
      name: "mock",
      model: "fixture:legacy-and-code",
      promptVersion: "site-generation-v1",
      async generate(request) {
        const spec = loadMockSiteGenerationSpec(request.normalized)
        spec.settings = {
          ...spec.settings,
          chrome: {
            header: { variant: "amicareZen" },
            footer: { variant: "amicareZen" },
            banner: { variant: "default", visible: false, message: "Preview ready" },
          },
        } as any
        spec.pages[0]!.blocks[0] = {
          ...spec.pages[0]!.blocks[0]!,
          designVariant: "amicareZenHero",
          rawHtml: "<section>Generated HTML is not allowed</section>",
        } as any
        return {
          provider: "mock",
          model: "fixture:legacy-and-code",
          promptVersion: "site-generation-v1",
          input: request.input,
          inputHash: request.inputHash,
          outputHash: "legacy-and-code-output",
          rawOutput: JSON.stringify(spec),
          parsedOutput: spec,
          spec,
        }
      },
    }

    const result = await processIntakeSubmission(payload, rawIntake(), { provider })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("failed")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
    expect(store["site-generation-runs"][0]?.validation?.issues.map((entry: any) => entry.code)).toEqual(expect.arrayContaining([
      "invalid_contract_shape",
      "tenant_exclusive_block_variant",
      "tenant_exclusive_chrome_variant",
    ]))
  })

  it("fails safely when a provider returns malformed contract output", async () => {
    const { payload, store } = createPayloadStub()
    const malformedOutput = { schemaVersion: 1, pages: [] }
    const provider: SiteGenerationProvider = {
      name: "mock",
      model: "fixture:malformed-output",
      promptVersion: "site-generation-v1",
      async generate(request) {
        return {
          provider: "mock",
          model: "fixture:malformed-output",
          promptVersion: "site-generation-v1",
          input: request.input,
          inputHash: request.inputHash,
          outputHash: "malformed-output",
          rawOutput: JSON.stringify(malformedOutput),
          parsedOutput: malformedOutput,
        }
      },
    }

    const result = await processIntakeSubmission(payload, rawIntake(), { provider })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("failed")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
    expect(store["site-generation-runs"][0]?.errors?.message).toBe("Generated SiteGenerationSpec failed validation")
    expect(store["site-generation-runs"][0]?.validation?.issues.map((entry: any) => entry.code)).toContain("invalid_contract_shape")
  })

  it("records failed state when the generation provider throws and reuses the failed run", async () => {
    const { payload, store } = createPayloadStub()
    let attempts = 0
    const provider: SiteGenerationProvider = {
      name: "openai",
      model: "provider-error",
      promptVersion: "site-generation-v1",
      async generate() {
        attempts += 1
        throw new Error("provider unavailable")
      },
    }

    const first = await processIntakeSubmission(payload, rawIntake(), { provider })
    const second = await processIntakeSubmission(payload, rawIntake(), { provider })

    expect(first.ok).toBe(false)
    expect(first.status).toBe("failed")
    expect(second.reused).toBe(true)
    expect(second.generationRunId).toBe(first.generationRunId)
    expect(attempts).toBe(1)
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store["site-generation-runs"][0]?.errors?.message).toBe("provider unavailable")
  })

  it("reuses an existing idempotency key on repeated calls without duplicating CMS records", async () => {
    const { payload, store } = createPayloadStub()

    const first = await processIntakeSubmission(payload, rawIntake())
    const second = await processIntakeSubmission(payload, rawIntake())

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.reused).toBe(true)
    expect(second.generationRunId).toBe(first.generationRunId)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store["site-settings"]).toHaveLength(1)
    expect(new Set(store.pages.map((page) => page.slug)).size).toBe(store.pages.length)
  })
})

describe("processStoredIntakeSubmission", () => {
  it("starts provider-backed generation from an existing stored intake without duplicating intake records", async () => {
    const { payload, store } = createPayloadStub()
    const normalized = normalizeIntakeSubmission(rawIntake())
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: "public-intake",
        status: "normalized",
        idempotencyKey: `public-intake:normalized:${hashStableValue({ raw: rawIntake(), normalized })}`,
        raw: rawIntake(),
        normalized,
        normalizedHash: hashStableValue(normalized),
        statusTransitions: [{ status: "submitted", at: "2026-07-02T09:00:00.000Z" }, { status: "normalized", at: "2026-07-02T09:00:01.000Z" }],
      },
    })

    const result = await processStoredIntakeSubmission(payload, intake.id)

    expect(result.ok).toBe(true)
    expect(result.status).toBe("preview_ready")
    expect(result.intakeSubmissionId).toBe(intake.id)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store["site-generation-runs"][0]?.intakeSubmission).toBe(intake.id)
    expect(store["site-generation-runs"][0]?.idempotencyKey).toContain(`stored:${intake.id}:mock:fixture:generic`)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(1)
    expect(store["site-settings"]).toHaveLength(1)
  })

  it("reuses the stored generation run on repeated calls", async () => {
    const { payload, store } = createPayloadStub()
    const normalized = normalizeIntakeSubmission(rawIntake())
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: "public-intake",
        status: "normalized",
        idempotencyKey: "public-intake:normalized:stored-reuse",
        raw: rawIntake(),
        normalized,
        normalizedHash: hashStableValue(normalized),
        statusTransitions: [{ status: "normalized", at: "2026-07-02T09:00:00.000Z" }],
      },
    })

    const first = await processStoredIntakeSubmission(payload, intake.id)
    const second = await processStoredIntakeSubmission(payload, intake.id)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.reused).toBe(true)
    expect(second.generationRunId).toBe(first.generationRunId)
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(1)
  })
})

describe("processReviewedIntakeSubmission", () => {
  it("rejects draft generation when the intake has no reviewed GenerationInput", async () => {
    const { payload } = createPayloadStub()
    const normalized = normalizeIntakeSubmission(rawIntake())
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: "public-intake",
        status: "normalized",
        idempotencyKey: "stored-only:no-review",
        raw: rawIntake(),
        normalized,
        normalizedHash: hashStableValue(normalized),
        statusTransitions: [{ status: "normalized", at: "2026-06-30T08:00:00.000Z" }],
      },
    })

    await expect(processReviewedIntakeSubmission(payload, intake.id)).rejects.toThrow(
      "Reviewed GenerationInput is required before draft generation.",
    )
  })

  it("creates a reviewed generation run and applies mocked draft CMS data", async () => {
    const { payload, store } = createPayloadStub()
    const normalized = normalizeIntakeSubmission(rawIntake())
    const reviewedGenerationInput = {
      ...buildGenerationInput(normalized, "admin-approved"),
      approvedAt: "2026-06-30T09:00:00.000Z",
      approvedBy: "7",
    }
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: "public-intake",
        status: "normalized",
        idempotencyKey: "stored-only:reviewed-success",
        raw: rawIntake(),
        normalized,
        normalizedHash: hashStableValue(normalized),
        reviewedGenerationInput,
        reviewedAt: "2026-06-30T09:00:00.000Z",
        reviewedBy: 7,
        statusTransitions: [{ status: "normalized", at: "2026-06-30T08:00:00.000Z" }],
      },
    })

    const result = await processReviewedIntakeSubmission(payload, intake.id)

    expect(result.ok).toBe(true)
    expect(result.status).toBe("preview_ready")
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store["site-generation-runs"][0]?.intakeSubmission).toBe(intake.id)
    expect(store["site-generation-runs"][0]?.idempotencyKey).toContain(`reviewed:${intake.id}:mock:fixture:generic`)
    expect(store["site-generation-runs"][0]?.generationInput?.generationInput).toMatchObject({
      status: "admin-approved",
      approvedBy: "7",
    })
    expect(store.tenants).toHaveLength(1)
    expect(store.pages.length).toBeGreaterThan(0)
    expect(store["intake-submissions"][0]?.generationRun).toBe(store["site-generation-runs"][0]?.id)
  })

  it("reuses the reviewed generation run for the same approved input", async () => {
    const { payload, store } = createPayloadStub()
    const normalized = normalizeIntakeSubmission(rawIntake())
    const reviewedGenerationInput = {
      ...buildGenerationInput(normalized, "admin-approved"),
      approvedAt: "2026-06-30T09:00:00.000Z",
      approvedBy: "7",
    }
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: "public-intake",
        status: "normalized",
        idempotencyKey: "stored-only:reviewed-reuse",
        raw: rawIntake(),
        normalized,
        normalizedHash: hashStableValue(normalized),
        reviewedGenerationInput,
        reviewedAt: "2026-06-30T09:00:00.000Z",
        reviewedBy: 7,
        statusTransitions: [{ status: "normalized", at: "2026-06-30T08:00:00.000Z" }],
      },
    })

    const first = await processReviewedIntakeSubmission(payload, intake.id)
    const second = await processReviewedIntakeSubmission(payload, intake.id)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.reused).toBe(true)
    expect(second.generationRunId).toBe(first.generationRunId)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store["site-settings"]).toHaveLength(1)
  })
})
