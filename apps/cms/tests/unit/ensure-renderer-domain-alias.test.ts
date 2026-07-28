import { describe, expect, it, vi } from "vitest"
import {
  ensureRendererDomainAlias,
  parseRendererAliasArgs,
  type RendererAliasOptions,
} from "../../scripts/ensure-renderer-domain-alias"
import { asPayload } from "../_helpers/mockPayload"

type TestInput = {
  tenantDomain?: string
  tenantStatus?: string
  aliases?: Array<{ host: string; id?: string }>
  otherTenantDomain?: string
  otherAliases?: Array<{ host: string }>
}

const setup = (input: TestInput = {}) => {
  const tenant = {
    id: 10,
    domain: input.tenantDomain ?? "ami-care.nl",
    status: input.tenantStatus ?? "active",
  }
  const settings = {
    id: 20,
    tenant: tenant.id,
    siteName: "Ami Care",
    siteUrl: "https://ami-care.nl",
    aliases: input.aliases ?? [],
  }
  const otherTenant = input.otherTenantDomain
    ? { id: 11, domain: input.otherTenantDomain, status: "active" }
    : null
  const otherSettings = {
    id: 21,
    tenant: 11,
    siteName: "Other",
    siteUrl: "https://other.test",
    aliases: input.otherAliases ?? [],
  }

  const payload = {
    find: vi.fn(async (args: { collection: string; where?: unknown }) => {
      if (args.collection === "tenants") {
        const expected = (
          args.where as { domain?: { equals?: string } } | undefined
        )?.domain?.equals
        return {
          docs: [tenant, otherTenant].filter(
            (candidate) => candidate?.domain === expected,
          ),
        }
      }
      if (args.collection === "site-settings" && args.where) return { docs: [settings] }
      if (args.collection === "site-settings") return { docs: [settings, otherSettings] }
      return { docs: [] }
    }),
    update: vi.fn(async (args: { data: { aliases: Array<{ host: string }> } }) => {
      settings.aliases = args.data.aliases
      return settings
    }),
  }
  const resolver = vi.fn(async (_payload, host: string) => {
    const isCanonical = host === tenant.domain
    const isAlias = settings.aliases.some((entry) => entry.host === host)
    if (!isCanonical && !isAlias) return null
    return {
      tenant: { id: tenant.id, slug: "ami-care", domain: tenant.domain, status: "active" },
      routing: {
        version: 1 as const,
        requestedHost: host,
        canonicalHost: tenant.domain,
        activeHosts: [tenant.domain, ...settings.aliases.map(({ host: alias }) => alias)],
      },
      snapshot: {},
      snapshotId: 30,
    }
  })

  return {
    payload: asPayload(payload),
    payloadMock: payload,
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
