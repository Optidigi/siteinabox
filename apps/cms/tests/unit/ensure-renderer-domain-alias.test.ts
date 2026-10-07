import { describe, expect, it, vi } from "vitest"
import {
  ensureRendererDomainAlias,
  parseRendererAliasArgs,
  type RendererAliasOptions,
} from "../../scripts/ensure-renderer-domain-alias"
import type { Tenant } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { tenantFixture, siteSettingsFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { asDocRecord } from "../_helpers/payloadApi"

type TestInput = {
  tenantDomain?: string
  tenantStatus?: Tenant["status"]
  aliases?: Array<{ host: string; id?: string }>
  otherTenantDomain?: string
  otherAliases?: Array<{ host: string }>
}

const setup = (input: TestInput = {}) => {
  const tenant = tenantFixture({
    id: 10,
    domain: input.tenantDomain ?? "ami-care.nl",
    status: input.tenantStatus ?? "active",
  })
  const settings = siteSettingsFixture({
    id: 20,
    tenant: tenant.id,
    siteName: "Ami Care",
    siteUrl: "https://ami-care.nl",
    aliases: input.aliases ?? [],
  })
  const otherTenant = input.otherTenantDomain
    ? tenantFixture({ id: 11, domain: input.otherTenantDomain, status: "active" })
    : null
  const otherSettings = siteSettingsFixture({
    id: 21,
    tenant: 11,
    siteName: "Other",
    siteUrl: "https://other.test",
    aliases: input.otherAliases ?? [],
  })

  const payload = createTestPayload()
  const find = vi.spyOn(payload, "find").mockImplementation(async args => {
    if (args.collection === "tenants") {
      const expected = asDocRecord(args.where?.domain ?? {}).equals
      return paginatedFixture([tenant, otherTenant].filter((candidate): candidate is Tenant => candidate !== null && candidate.domain === expected))
    }
    if (args.collection === "site-settings") return paginatedFixture(args.where ? [settings] : [settings, otherSettings])
    throw new Error(`Unexpected collection ${args.collection}`)
  })
  const update = vi.spyOn(payload, "update").mockImplementation(async args => {
    if (args.collection !== "site-settings" || !("aliases" in args.data) || !Array.isArray(args.data.aliases)) throw new Error("Expected alias update")
    settings.aliases = args.data.aliases.map(entry => {
      if (!entry || typeof entry.host !== "string") throw new Error("Expected alias host")
      return { host: entry.host, ...(typeof entry.id === "string" ? { id: entry.id } : {}) }
    })
    return settings
  })
  const resolver = vi.fn(async (_payload, host: string) => {
    const isCanonical = host === tenant.domain
    const isAlias = (settings.aliases ?? []).some((entry) => entry.host === host)
    if (!isCanonical && !isAlias) return null
    return {
      tenant: { id: tenant.id, slug: "ami-care", domain: tenant.domain, status: "active" },
      routing: {
        version: 1 as const,
        requestedHost: host,
        canonicalHost: tenant.domain,
        activeHosts: [tenant.domain, ...(settings.aliases ?? []).map(({ host: alias }) => alias)],
      },
      snapshot: {},
      snapshotId: 30,
    }
  })

  return {
    payload,
    payloadMock: { find, update },
    resolver,
    settings,
  }
}

const options = (execute: boolean): RendererAliasOptions => ({
  domain: "ami-care.nl",
  alias: "www.ami-care.nl",
  execute,
})

describe("renderer domain alias operator command", () => {
  it("normalizes CLI hosts and defaults to dry-run", () => {
    expect(
      parseRendererAliasArgs([
        "--domain=AMI-CARE.NL.",
        "--alias=WWW.AMI-CARE.NL:443",
      ]),
    ).toEqual(options(false))
  })

  it("reports a dry-run without mutating or pretending the alias is verified", async () => {
    const { payload, payloadMock, resolver } = setup()

    await expect(
      ensureRendererDomainAlias(payload, options(false), resolver),
    ).resolves.toMatchObject({ changed: false, verified: false })
    expect(payloadMock.update).not.toHaveBeenCalled()
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it("adds the alias once, preserves aliases, and verifies both hosts", async () => {
    const existingAlias = { host: "zorg.ami-care.nl", id: "row-1" }
    const { payload, payloadMock, resolver, settings } = setup({
      aliases: [existingAlias],
    })

    await expect(
      ensureRendererDomainAlias(payload, options(true), resolver),
    ).resolves.toMatchObject({ changed: true, verified: true })
    expect(settings.aliases).toEqual([
      existingAlias,
      { host: "www.ami-care.nl" },
    ])
    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it("is idempotent when the alias is already active", async () => {
    const { payload, payloadMock, resolver } = setup({
      aliases: [{ host: "www.ami-care.nl" }],
    })

    await expect(
      ensureRendererDomainAlias(payload, options(true), resolver),
    ).resolves.toMatchObject({ changed: false, verified: true })
    expect(payloadMock.update).not.toHaveBeenCalled()
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it("rejects a canonical-domain collision", async () => {
    const { payload, payloadMock, resolver } = setup({
      otherTenantDomain: "www.ami-care.nl",
    })

    await expect(
      ensureRendererDomainAlias(payload, options(true), resolver),
    ).rejects.toThrow("another tenant's canonical domain")
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it("rejects an alias owned by another tenant", async () => {
    const { payload, payloadMock, resolver } = setup({
      otherAliases: [{ host: "WWW.AMI-CARE.NL." }],
    })

    await expect(
      ensureRendererDomainAlias(payload, options(true), resolver),
    ).rejects.toThrow("already assigned to another tenant")
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it("refuses to change an inactive tenant", async () => {
    const { payload, payloadMock, resolver } = setup({
      tenantStatus: "suspended",
    })

    await expect(
      ensureRendererDomainAlias(payload, options(true), resolver),
    ).rejects.toThrow("is not active")
    expect(payloadMock.update).not.toHaveBeenCalled()
  })
})
