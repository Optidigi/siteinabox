import { describe, it, expect } from "vitest"
import { Tenants } from "@/collections/Tenants"
import {
  buildDefaultTenantEmailSending,
  buildTenantEmailSendingFromCloudflareSubdomain,
  hasVerifiedTenantSender,
  resolveVerifiedTenantSender,
  tenantEmailSendingStatuses,
} from "@/lib/tenants/emailSending"
import { expectNamedField, fieldOptionValues, fieldOptions, fieldRequired } from "../_helpers/payloadFields"
import type { Field } from "payload"

import { errLike } from "../_helpers/cast"
const groupFields = (group: Field) => {
  const fields = "fields" in group ? group.fields ?? [] : []
  return Object.fromEntries(fields.map((field) => ("name" in field ? [field.name, field] : ["", field])).filter(([name]) => name))
}

describe("Tenants collection config", () => {
  it("uses 'tenants' slug", () => { expect(Tenants.slug).toBe("tenants") })

  it("has unique domain field", () => {
    const domain = expectNamedField(Tenants.fields, "domain")
    expect("unique" in domain && domain.unique).toBe(true)
    expect(fieldRequired(domain)).toBe(true)
  })

  it("has unique slug field", () => {
    const slug = expectNamedField(Tenants.fields, "slug")
    expect("unique" in slug && slug.unique).toBe(true)
  })

  it("status defaults to provisioning", () => {
    const status = expectNamedField(Tenants.fields, "status")
    expect("defaultValue" in status && status.defaultValue).toBe("provisioning")
    expect(fieldOptionValues(fieldOptions(status))).toEqual([
      "provisioning", "active", "suspended", "archived",
    ])
  })

  it("models tenant email sending state without secrets", () => {
    const group = expectNamedField(Tenants.fields, "emailSending")
    expect(group.type).toBe("group")
    expect("admin" in group && group.admin && typeof group.admin === "object" && "description" in group.admin).toBe(true)

    const fields = groupFields(group)
    expect(fields.provider).toMatchObject({ type: "select", defaultValue: "cloudflare" })
    expect(fields.mode).toMatchObject({ type: "select", defaultValue: "subdomain" })
    expect("defaultValue" in fields.status && fields.status.defaultValue).toBe("not_configured")
    expect(fieldOptionValues(fieldOptions(fields.status))).toEqual([...tenantEmailSendingStatuses])
    expect(fields.sendingDomain.type).toBe("text")
    expect(fields.senderEmail.type).toBe("email")
    expect("admin" in fields.verifiedAt && fields.verifiedAt.admin && "readOnly" in fields.verifiedAt.admin && fields.verifiedAt.admin.readOnly).toBe(true)
    expect("admin" in fields.lastCheckedAt && fields.lastCheckedAt.admin && "readOnly" in fields.lastCheckedAt.admin && fields.lastCheckedAt.admin.readOnly).toBe(true)
    expect("admin" in fields.lastError && fields.lastError.admin && "readOnly" in fields.lastError.admin && fields.lastError.admin.readOnly).toBe(true)
    expect("admin" in fields.cloudflareZoneId && fields.cloudflareZoneId.admin && "readOnly" in fields.cloudflareZoneId.admin && fields.cloudflareZoneId.admin.readOnly).toBe(true)
    expect("admin" in fields.cloudflareSubdomainId && fields.cloudflareSubdomainId.admin && "readOnly" in fields.cloudflareSubdomainId.admin && fields.cloudflareSubdomainId.admin.readOnly).toBe(true)
    expect("admin" in fields.returnPathDomain && fields.returnPathDomain.admin && "readOnly" in fields.returnPathDomain.admin && fields.returnPathDomain.admin.readOnly).toBe(true)
    expect("admin" in fields.dkimSelector && fields.dkimSelector.admin && "readOnly" in fields.dkimSelector.admin && fields.dkimSelector.admin.readOnly).toBe(true)
    expect("admin" in fields.testMessageId && fields.testMessageId.admin && "readOnly" in fields.testMessageId.admin && fields.testMessageId.admin.readOnly).toBe(true)
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

    const group = expectNamedField(Tenants.fields, "emailSending")
    const fields = groupFields(group)
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
    expect(hasVerifiedTenantSender({ emailSending: pending })).toBe(false)

    const verified = { ...pending, status: "verified" as const, verifiedAt: "2026-07-01T10:05:00.000Z" }
    expect(resolveVerifiedTenantSender({ emailSending: verified })).toEqual({
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
    })).toBeNull()

    expect(resolveVerifiedTenantSender({
      emailSending: {
        ...verified,
        sendingDomain: "siteinabox.nl",
        senderEmail: "noreply@siteinabox.nl",
      },
    })).toBeNull()
  })
})
