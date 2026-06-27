import { describe, expect, it } from "vitest"
import type { SiteGenerationProvider } from "@/lib/ai-generation/providers"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"
import { processIntakeSubmission } from "@/lib/intake/processIntakeSubmission"

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
    })
    expect(store.pages.every((page) => page.status === "draft")).toBe(true)
    expect(store["site-generation-runs"][0]?.applyResult?.ok).toBe(true)
    expect(store["site-generation-runs"][0]?.provider).toBe("mock")
    expect(store["site-generation-runs"][0]?.model).toBe("fixture:amblast")
    expect(store["site-generation-runs"][0]?.promptVersion).toBe("site-generation-v1")
    expect(store["site-generation-runs"][0]?.generationInputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store["site-generation-runs"][0]?.generationOutputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store["site-generation-runs"][0]?.parsedOutput?.schemaVersion).toBe(1)
    expect(store["site-generation-runs"][0]?.normalizedIntake?.requestedPages[0]?.slug).toBe("index")
    expect(store["site-generation-runs"][0]?.statusTransitions.map((entry: any) => entry.status)).toContain("applying")
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
