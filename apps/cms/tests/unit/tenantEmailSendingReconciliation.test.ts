import { describe, expect, it, vi } from "vitest"

import { reconcileTenantEmailSending } from "@/lib/tenants/emailSendingRefresh"
import { createTestPayload } from "../_helpers/testPayload"
import { tenantFixture, paginatedFixture } from "../_helpers/generatedDocs"

const tenant = tenantFixture({
  id: 12,
  domain: "client.nl",
  status: "active",
  domainVerification: { status: "verified" },
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "failed",
    sendingDomain: "mail.client.nl",
    senderEmail: "noreply@mail.client.nl",
    cloudflareZoneId: "zone-12",
  },
})

const payloadStub = () => {
  const payload = createTestPayload()
  const update = vi.spyOn(payload, "update").mockResolvedValue(tenant)
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => {
    if (collection === "tenants") return paginatedFixture([tenant])
    if (collection === "operational-alerts") return paginatedFixture([])
    throw new Error(`Unexpected collection ${collection}`)
  })
  const create = vi.spyOn(payload, "create").mockResolvedValue({
    id: 1, severity: "warning", status: "open", source: "domains", dedupeKey: "fixture", message: "Fixture alert", occurrenceCount: 1, firstSeenAt: "2026-07-30T10:00:00.000Z", lastSeenAt: "2026-07-30T10:00:00.000Z", createdAt: "2026-07-30T10:00:00.000Z", updatedAt: "2026-07-30T10:00:00.000Z",
  })
  return { payload, update, create }
}

describe("optional tenant-branded email reconciliation", () => {
  it("uses list-before-create authority and resolves a verified sender", async () => {
    const { payload, update, create } = payloadStub()
    const createOrReuse = vi.fn(async () => ({
      id: "subdomain-12",
      name: "mail.client.nl",
      enabled: true,
      dkimSelector: "cf-dkim",
      returnPathDomain: "bounce.mail.client.nl",
      raw: {},
    }))

    await expect(reconcileTenantEmailSending(payload, {
      createOrReuse,
      now: new Date("2026-07-30T10:00:00.000Z"),
    })).resolves.toEqual({
      examined: 1,
      verified: 1,
      pending: 0,
      failed: 0,
    })

    expect(createOrReuse).toHaveBeenCalledWith(
      "zone-12",
      "mail.client.nl",
    )
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      id: 12,
      data: {
        emailSending: expect.objectContaining({
          status: "verified",
          cloudflareSubdomainId: "subdomain-12",
        }),
      },
    }))
    expect(create).not.toHaveBeenCalled()
  })

  it("records redacted optional failure without changing website authority", async () => {
    const { payload, update, create } = payloadStub()
    const createOrReuse = vi.fn(async () => {
      throw new Error(
        "Provider rejected CLOUDFLARE_API_TOKEN=secret customer@example.test",
      )
    })

    await expect(reconcileTenantEmailSending(payload, {
      createOrReuse,
      now: new Date("2026-07-30T10:00:00.000Z"),
    })).resolves.toEqual({
      examined: 1,
      verified: 0,
      pending: 0,
      failed: 1,
    })

    const tenantUpdate = update.mock.calls.find(
      ([input]) => input.collection === "tenants",
    )?.[0]
    expect(tenantUpdate?.data).toMatchObject({ emailSending: {
      status: "failed",
      cloudflareZoneId: "zone-12",
    } })
    expect(JSON.stringify(tenantUpdate)).not.toContain("secret")
    expect(JSON.stringify(tenantUpdate)).not.toContain("customer@example.test")
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "operational-alerts",
      data: expect.objectContaining({
        severity: "warning",
        message: expect.stringContaining("platform mail remains active"),
      }),
    }))
  })
})
