import { describe, expect, it, vi } from "vitest"

import {
  checkoutProgressDraftSchema,
  loadCheckoutProgressDraft,
  saveCheckoutProgressDraft,
} from "@/lib/checkout/checkoutProgress"
import type { PreviewGrantContext } from "@/lib/preview/previewAccess"
import { asPayload } from "../_helpers/mockPayload"

const contextWith = (payload: object): PreviewGrantContext => ({
  payload: asPayload(payload),
  grant: { id: 11, expiresAt: "2026-08-17T12:00:00.000Z" },
  tenant: { id: 7 },
  run: { id: 9 },
} as unknown as PreviewGrantContext)

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
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const create = vi.fn(async ({ data }) => ({ id: 42, ...data }))
    const context = contextWith({ find, create, update: vi.fn(), delete: vi.fn() })
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
    const remove = vi.fn().mockResolvedValue({ docs: [{ id: 42 }] })
    const context = contextWith({
      find: vi.fn().mockResolvedValue({ docs: [{
        id: 42,
        previewAccessGrant: 11,
        tenant: 7,
        generationRun: 9,
        expiresAt: "2026-08-03T11:59:59.000Z",
      }] }),
      create: vi.fn(),
      update: vi.fn(),
      delete: remove,
    })
    await expect(loadCheckoutProgressDraft({
      context,
      now: new Date("2026-08-03T12:00:00.000Z"),
    })).resolves.toBeNull()
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
  })
})
