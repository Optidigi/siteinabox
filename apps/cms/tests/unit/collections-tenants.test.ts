import { describe, it, expect } from "vitest"
import { Tenants } from "@/collections/Tenants"
import {
  buildDefaultTenantEmailSending,
  buildTenantEmailSendingFromCloudflareSubdomain,
  hasVerifiedTenantSender,
  resolveVerifiedTenantSender,
  tenantEmailSendingStatuses,
} from "@/lib/tenants/emailSending"

describe("Tenants collection config", () => {
  it("uses 'tenants' slug", () => { expect(Tenants.slug).toBe("tenants") })

  it("has unique domain field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "domain")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
    expect((f as any).required).toBe(true)
  })

  it("has unique slug field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "slug")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
  })

  it("status defaults to provisioning", () => {
    const f = Tenants.fields.find((x: any) => x.name === "status") as any
    expect(f.defaultValue).toBe("provisioning")
    expect(f.options.map((o: any) => o.value)).toEqual([
      "provisioning", "active", "suspended", "archived"
    ])
  })

  it("models tenant email sending state without secrets", () => {
    const group = Tenants.fields.find((x: any) => x.name === "emailSending") as any
    expect(group).toBeDefined()
    expect(group.type).toBe("group")
    expect(group.admin.description).toContain("no secrets")

    const fields = Object.fromEntries(group.fields.map((field: any) => [field.name, field]))
    expect(fields.provider).toMatchObject({ type: "select", defaultValue: "cloudflare" })
    expect(fields.mode).toMatchObject({ type: "select", defaultValue: "subdomain" })
    expect(fields.status.defaultValue).toBe("not_configured")
    expect(fields.status.options.map((option: any) => option.value)).toEqual([...tenantEmailSendingStatuses])
    expect(fields.sendingDomain.type).toBe("text")
    expect(fields.senderEmail.type).toBe("email")
    expect(fields.verifiedAt.admin.readOnly).toBe(true)
    expect(fields.lastCheckedAt.admin.readOnly).toBe(true)
    expect(fields.lastError.admin.readOnly).toBe(true)
    expect(fields.cloudflareZoneId.admin.readOnly).toBe(true)
    expect(fields.cloudflareSubdomainId.admin.readOnly).toBe(true)
    expect(fields.returnPathDomain.admin.readOnly).toBe(true)
    expect(fields.dkimSelector.admin.readOnly).toBe(true)
    expect(fields.testMessageId.admin.readOnly).toBe(true)
    expect(Object.keys(fields).some((name) => /secret|token|key/i.test(name))).toBe(false)
  })

  it("makes tenant email sender state practical to scan, search, and filter in admin", () => {
    expect(Tenants.admin?.defaultColumns).toEqual([
      "name",
      "domain",
      "status",
      "emailSending.status",
      "emailSending.mode",
      "emailSending.sendingDomain",
    ])
    expect(Tenants.admin?.listSearchableFields).toEqual(["name", "slug", "domain", "emailSending.sendingDomain"])

    const group = Tenants.fields.find((x: any) => x.name === "emailSending") as any
    const fields = Object.fromEntries(group.fields.map((field: any) => [field.name, field]))
    expect(fields.status).toMatchObject({ index: true })
    expect(fields.mode).toMatchObject({ index: true })
    expect(fields.sendingDomain).toMatchObject({ index: true })
  })

  it("builds conservative Cloudflare subdomain sender defaults from the tenant domain", () => {
    expect(buildDefaultTenantEmailSending("TenantDomain.NL ")).toEqual({
      provider: "cloudflare",
      mode: "subdomain",
      status: "not_configured",
      sendingDomain: "mail.tenantdomain.nl",
      senderEmail: "noreply@mail.tenantdomain.nl",
    })
    expect(buildDefaultTenantEmailSending(null)).toEqual({
      provider: "cloudflare",
      mode: "subdomain",
      status: "not_configured",
      sendingDomain: undefined,
      senderEmail: undefined,
    })
  })

  it("resolves only verified tenant senders for generated-site mail", () => {
    const pending = buildTenantEmailSendingFromCloudflareSubdomain("tenantdomain.nl", "zone-123", {
      id: "subdomain-123",
      name: "mail.tenantdomain.nl",
      enabled: false,
      dkimSelector: "cf-bounce",
      returnPathDomain: "cf-bounce.mail.tenantdomain.nl",
      raw: {},
    }, { now: "2026-07-01T10:00:00.000Z" })
    expect(pending.status).toBe("pending")
    expect(hasVerifiedTenantSender({ emailSending: pending } as any)).toBe(false)

    const verified = { ...pending, status: "verified" as const, verifiedAt: "2026-07-01T10:05:00.000Z" }
    expect(resolveVerifiedTenantSender({ emailSending: verified } as any)).toEqual({
      provider: "cloudflare",
      mode: "subdomain",
      senderEmail: "noreply@mail.tenantdomain.nl",
      sendingDomain: "mail.tenantdomain.nl",
    })

    expect(resolveVerifiedTenantSender({
      emailSending: {
        ...verified,
        senderEmail: "noreply@siteinabox.nl",
      },
    } as any)).toBeNull()

    expect(resolveVerifiedTenantSender({
      emailSending: {
        ...verified,
        sendingDomain: "siteinabox.nl",
        senderEmail: "noreply@siteinabox.nl",
      },
    } as any)).toBeNull()
  })
})
