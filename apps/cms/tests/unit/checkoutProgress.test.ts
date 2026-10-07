import { payloadDeleteFixture } from "../_helpers/payloadDeleteFixture"
import { generationRunFixture, previewGrantFixture, tenantFixture, checkoutProgressFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { describe, expect, it, vi } from "vitest"

import {
  checkoutProgressDraftSchema,
  loadCheckoutProgressDraft,
  saveCheckoutProgressDraft,
} from "@/lib/checkout/checkoutProgress"
import type { PreviewGrantContext } from "@/lib/preview/previewAccess"
import type { Payload } from "payload"
import { createTestPayload } from "../_helpers/testPayload"

const contextWith = (payload: Payload): PreviewGrantContext => ({
  payload,
  grant: previewGrantFixture({ id: 11, expiresAt: "2026-08-17T12:00:00.000Z" }),
  tenant: tenantFixture({ id: 7 }),
  run: generationRunFixture({ id: 9 }),
  pages: [],
  customerEmail: "fixture@example.com",
  clientSlug: "fixture",
})

describe("checkout progress drafts", () => {
  it("accepts incomplete whitelisted profile engagement but rejects payment and legal data", () => {
    expect(checkoutProgressDraftSchema.parse({
      domainMode: "existing_domain",
      domainQuery: "Acme.nl",
      selectedDomain: "https://www.acme.nl/",
      decision: "review",
      billingPeriod: "annual",
      migrationSourceMechanism: "cloudflare_api_v1",
      profileDraft: { firstName: "Ada", phoneAreaCode: "" },
    })).toMatchObject({
      selectedDomain: "acme.nl",
      profileDraft: { firstName: "Ada", phoneAreaCode: "" },
    })
    expect(checkoutProgressDraftSchema.safeParse({
      quoteToken: "must-not-persist",
    }).success).toBe(false)
    expect(checkoutProgressDraftSchema.safeParse({
      legalAcceptance: true,
    }).success).toBe(false)
  })

  it("derives authority and expiry exclusively from the active preview grant", async () => {
    const payload = createTestPayload()
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([]))
    const create = vi.spyOn(payload, "create").mockResolvedValue(checkoutProgressFixture({ id: 42, previewAccessGrant: 11, tenant: 7, generationRun: 9, expiresAt: "2026-08-17T12:00:00.000Z", domainQuery: "acme", selectedDomain: "acme.nl", profileDraft: { city: "Utrecht" } }))
    const context = contextWith(payload)
    const saved = await saveCheckoutProgressDraft({
      context,
      now: new Date("2026-08-03T12:00:00.000Z"),
      draft: {
        domainQuery: "acme",
        selectedDomain: "acme.nl",
        profileDraft: { city: "Utrecht" },
      },
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "checkout-progress-drafts",
      data: expect.objectContaining({
        previewAccessGrant: 11,
        tenant: 7,
        generationRun: 9,
        expiresAt: "2026-08-17T12:00:00.000Z",
      }),
      context: { checkoutProgressDraftLifecycle: true },
    }))
    expect(saved.profileDraft).toEqual({ city: "Utrecht" })
  })

  it("deletes expired PII progress instead of returning it", async () => {
    const payload = createTestPayload()
    const draft = checkoutProgressFixture({ id: 42, previewAccessGrant: 11, tenant: 7, generationRun: 9, expiresAt: "2026-08-03T11:59:59.000Z" })
    const remove = vi.spyOn(payload, "delete").mockImplementation(payloadDeleteFixture(async args => args.where ? { docs: [draft], errors: [] } : draft))
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([draft]))
    const context = contextWith(payload)
    await expect(loadCheckoutProgressDraft({
      context,
      now: new Date("2026-08-03T12:00:00.000Z"),
    })).resolves.toBeNull()
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
  })
})
