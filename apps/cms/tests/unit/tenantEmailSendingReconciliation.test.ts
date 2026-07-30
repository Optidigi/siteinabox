import { describe, expect, it, vi } from "vitest"

import { reconcileTenantEmailSending } from "@/lib/tenants/emailSendingRefresh"
import { asPayload } from "../_helpers/mockPayload"

const tenant = {
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
}

const payloadStub = () => {
  const update = vi.fn(async ({ collection, data }: {
    collection: string
    data: Record<string, unknown>
  }) => collection === "tenants" ? { ...tenant, ...data } : data)
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "tenants" ? [tenant] : [],
    })),
    update,
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
  }
  return { payload: asPayload(payload), update, create: payload.create }
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
    expect(tenantUpdate?.data.emailSending).toMatchObject({
      status: "failed",
      cloudflareZoneId: "zone-12",
    })
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
