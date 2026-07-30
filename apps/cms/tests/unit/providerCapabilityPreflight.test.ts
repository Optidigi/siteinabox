import { describe, expect, it, vi } from "vitest"

import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGateCore"
import {
  commerceProviderCapabilityBlockers,
  type CommerceProviderCapabilityPreflightOptions,
} from "@/lib/commerce/providerCapabilityPreflight"
import {
  reconcileCommerceEdgeRouting,
  resolveCommerceEdgeRoutingInventory,
} from "@/lib/domains/edgeRouting"
import { buildCloudflareTunnelIngress } from "@/lib/domains/cloudflareTunnels"
import { asPayload } from "../_helpers/mockPayload"

const rendererTunnelId = "11111111-1111-4111-8111-111111111111"
const cmsTunnelId = "22222222-2222-4222-8222-222222222222"
const baseEnv = {
  COMMERCE_RELEASE_STAGE: "production",
  NODE_ENV: "production",
  MOLLIE_API_KEY: "live_fixture",
  OPENPROVIDER_USERNAME: "provider-user",
  OPENPROVIDER_PASSWORD: "provider-password",
  OPENPROVIDER_MIN_BALANCE_EUR: "0",
  CLOUDFLARE_API_TOKEN: "cloudflare-token",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_RENDERER_TUNNEL_ID: rendererTunnelId,
  CLOUDFLARE_CMS_TUNNEL_ID: cmsTunnelId,
} as unknown as NodeJS.ProcessEnv

const healthyTunnel = (kind: "renderer" | "cms") => ({
  tunnel: { status: "healthy" },
  ingress: kind === "renderer"
    ? [
        {
          hostname: "example.nl",
          service: "http://siteinabox-renderer:4321",
        },
        {
          hostname: "www.example.nl",
          service: "http://siteinabox-renderer:4321",
        },
        { service: "http_status:404" },
      ]
    : [
        {
          hostname: "admin.example.nl",
          service: "http://siteinabox-cms:3000",
        },
        { service: "http_status:404" },
      ],
  configurationVersion: 3,
  connected: true,
})

const dependencies = () => ({
  inspectMollie: vi.fn(async (_options: {
    env: NodeJS.ProcessEnv
    fetchImpl: typeof fetch
  }) => undefined),
  loginOpenProvider: vi.fn(async () => "provider-token"),
  getOpenProviderBalance: vi.fn(async () => ({
    availableAmount: 10,
    reservedAmount: 0,
    currency: "EUR",
  })),
  inspectTunnel: vi.fn(async (kind: "renderer" | "cms") =>
    healthyTunnel(kind)),
  listZones: vi.fn(async (domain: string) => [{
    id: "zone-id",
    name: domain,
    status: "active",
  }]),
  getDnsUsage: vi.fn(async () => ({
    recordQuota: 1_000,
    recordUsage: 12,
  })),
  getDnssec: vi.fn(async () => ({ status: "active" })),
  getCertificate: vi.fn(async (
    _zoneId: string,
    _hostname: string,
  ) => ({
    universalSslEnabled: true,
    covered: true,
  })),
})

const options = (
  overrides: Partial<CommerceProviderCapabilityPreflightOptions> = {},
): CommerceProviderCapabilityPreflightOptions => ({
  env: baseEnv,
  zoneDomains: ["example.nl"],
  dependencies: dependencies(),
  ...overrides,
})

describe("read-only production provider capability preflight", () => {
  it("passes complete read evidence without enabling provider writes", async () => {
    const deps = dependencies()
    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
    }))).resolves.toEqual([])

    expect(deps.inspectMollie).toHaveBeenCalledOnce()
    expect(deps.loginOpenProvider).toHaveBeenCalledOnce()
    expect(deps.getOpenProviderBalance).toHaveBeenCalledOnce()
    expect(deps.inspectTunnel).toHaveBeenCalledTimes(2)
    expect(deps.listZones).toHaveBeenCalledWith(
      "example.nl",
      expect.objectContaining({ env: baseEnv }),
    )
    expect(commerceProviderWritesAllowed(baseEnv)).toBe(false)
  })

  it("performs no network probe for unsafe production configuration", async () => {
    const deps = dependencies()
    const blockers = await commerceProviderCapabilityBlockers(options({
      env: {
        ...baseEnv,
        COMMERCE_RELEASE_STAGE: "shadow",
        OPENPROVIDER_API_BASE_URL: "https://attacker.example",
      } as unknown as NodeJS.ProcessEnv,
      dependencies: deps,
    }))

    expect(blockers).toEqual([
      "provider_capability:preflight:configuration_mismatch",
      "provider_capability:openprovider:configuration_mismatch",
    ])
    for (const dependency of Object.values(deps)) {
      expect(dependency).not.toHaveBeenCalled()
    }
  })

  it("classifies independent provider failures with stable redacted codes", async () => {
    const deps = dependencies()
    deps.inspectMollie.mockRejectedValue(
      Object.assign(new Error("live_secret@example.test"), { status: 401 }),
    )
    deps.inspectTunnel
      .mockRejectedValueOnce(
        Object.assign(new Error("account and tunnel ids"), { status: 403 }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("provider body"), { status: 429 }),
      )
    deps.listZones.mockRejectedValue(
      Object.assign(new Error("raw dns payload"), { status: 404 }),
    )

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
    }))).resolves.toEqual([
      "provider_capability:cloudflare_cms_tunnel:provider_rate_limited",
      "provider_capability:cloudflare_renderer_tunnel:unauthorized_or_capability_missing",
      "provider_capability:cloudflare_zone:configured_resource_missing_or_out_of_scope",
      "provider_capability:mollie:unauthorized_or_capability_missing",
    ])
  })

  it("does not attempt the balance read after OpenProvider login fails", async () => {
    const deps = dependencies()
    deps.loginOpenProvider.mockRejectedValue(
      Object.assign(new Error("password"), { status: 401 }),
    )

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
    }))).resolves.toContain(
      "provider_capability:openprovider_login:unauthorized_or_capability_missing",
    )
    expect(deps.getOpenProviderBalance).not.toHaveBeenCalled()
  })

  it("fails closed on insufficient balance and malformed edge evidence", async () => {
    const deps = dependencies()
    deps.getOpenProviderBalance.mockResolvedValue({
      availableAmount: 9,
      reservedAmount: 0,
      currency: "EUR",
    })
    deps.inspectTunnel.mockResolvedValue({
      ...healthyTunnel("renderer"),
      ingress: [{ hostname: "*.example.nl", service: "http://origin:3000" }],
      connected: false,
    })

    await expect(commerceProviderCapabilityBlockers(options({
      env: {
        ...baseEnv,
        OPENPROVIDER_MIN_BALANCE_EUR: "10",
      } as unknown as NodeJS.ProcessEnv,
      dependencies: deps,
    }))).resolves.toEqual([
      "provider_capability:cloudflare_cms_tunnel:provider_response_invalid",
      "provider_capability:cloudflare_renderer_tunnel:provider_response_invalid",
      "provider_capability:openprovider_balance:provider_response_invalid",
    ])
  })

  it("requires exact renderer and CMS ingress for every active domain", async () => {
    const deps = dependencies()
    deps.inspectTunnel.mockImplementation(async (kind) => {
      if (kind === "cms") return healthyTunnel(kind)
      return {
        ...healthyTunnel(kind),
        ingress: [
          {
            hostname: "example.nl",
            service: "http://siteinabox-cms:3000",
          },
          { service: "http_status:404" },
        ],
      }
    })

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
    }))).resolves.toEqual([
      "provider_capability:cloudflare_renderer_tunnel:provider_response_invalid",
    ])
  })

  it("uses the writer inventory for a paid domain still being provisioned", async () => {
    const activeDomain = {
      id: 1,
      domainNameAscii: "example.nl",
      state: "active",
      custodyStatus: "managed",
      cloudflareZoneId: "zone-active",
      tenant: 10,
    }
    const pendingDomain = {
      id: 2,
      domainNameAscii: "pending.nl",
      state: "registration_pending",
      custodyStatus: "managed",
      cloudflareZoneId: "zone-pending",
      tenant: 20,
      originatingOrder: 200,
    }
    const payload = asPayload({
      find: vi.fn(async ({
        collection,
        where,
      }: {
        collection: string
        where?: unknown
      }) => {
        if (collection === "tenants") {
          return {
            docs: [{ id: 10, status: "active", domain: "example.nl" }],
            totalDocs: 1,
          }
        }
        if (collection === "managed-domains") {
          const serializedWhere = JSON.stringify(where)
          if (serializedWhere.includes('"domainNameAscii"')) {
            return { docs: [activeDomain], totalDocs: 1 }
          }
          return {
            docs: [activeDomain, pendingDomain],
            totalDocs: 2,
          }
        }
        return { docs: [], totalDocs: 0 }
      }),
      findByID: vi.fn(async () => ({
        id: 200,
        paymentStatus: "paid",
        state: "fulfillment_pending",
      })),
      update: vi.fn(async ({ id, data }) => ({ id, ...data })),
    })
    const inventory = await resolveCommerceEdgeRoutingInventory(payload)
    expect(inventory).toMatchObject({
      rendererHosts: [
        "example.nl",
        "pending.nl",
        "www.example.nl",
        "www.pending.nl",
      ],
      cmsHosts: ["admin.example.nl", "admin.pending.nl"],
      zoneDomains: ["example.nl"],
    })

    const reconciledHosts: Record<string, string[]> = {}
    await reconcileCommerceEdgeRouting(payload, {
      providerWritesAllowed: () => true,
      reconcileTunnel: vi.fn(async (kind, hostnames) => {
        reconciledHosts[kind] = hostnames
        return {
          tunnel: {
            id: kind === "renderer" ? rendererTunnelId : cmsTunnelId,
            name: `siteinabox-${kind}`,
            status: "healthy" as const,
            remotelyManaged: true,
            raw: null,
          },
          ingress: buildCloudflareTunnelIngress(kind, hostnames),
          configurationVersion: 4,
          connected: false,
          changed: false,
        }
      }),
    })
    expect(reconciledHosts).toEqual({
      renderer: inventory.rendererHosts,
      cms: inventory.cmsHosts,
    })

    const deps = dependencies()
    deps.inspectTunnel.mockImplementation(async (kind) => ({
      ...healthyTunnel(kind),
      ingress: buildCloudflareTunnelIngress(
        kind,
        inventory[`${kind}Hosts`],
      ),
    }))
    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
      zoneDomains: inventory.zoneDomains,
      tunnelHostnames: {
        renderer: inventory.rendererHosts,
        cms: inventory.cmsHosts,
      },
    }))).resolves.toEqual([])
  })

  it("requires certificate coverage for apex, www and tenant admin", async () => {
    const deps = dependencies()
    deps.getCertificate.mockImplementation(async (_zoneId, hostname) => ({
      universalSslEnabled: true,
      covered: hostname !== "admin.example.nl",
    }))

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
    }))).resolves.toEqual([
      "provider_capability:cloudflare_ssl:provider_response_invalid",
    ])
    expect(deps.getCertificate.mock.calls.map(([, hostname]) => hostname))
      .toEqual([
        "example.nl",
        "www.example.nl",
        "admin.example.nl",
      ])
  })

  it("bounds active-zone probes to four workers", async () => {
    const deps = dependencies()
    let active = 0
    let maximum = 0
    deps.listZones.mockImplementation(async (domain) => {
      active += 1
      maximum = Math.max(maximum, active)
      await Promise.resolve()
      active -= 1
      return [{ id: domain, name: domain, status: "active" }]
    })
    const domains = Array.from(
      { length: 12 },
      (_, index) => `tenant-${index}.nl`,
    )
    deps.inspectTunnel.mockImplementation(async (kind) => ({
      ...healthyTunnel(kind),
      ingress: kind === "renderer"
        ? [
            ...domains.flatMap((domain) => [
              {
                hostname: domain,
                service: "http://siteinabox-renderer:4321",
              },
              {
                hostname: `www.${domain}`,
                service: "http://siteinabox-renderer:4321",
              },
            ]),
            { service: "http_status:404" },
          ].sort((left, right) => {
            if (!("hostname" in left)) return 1
            if (!("hostname" in right)) return -1
            return left.hostname.localeCompare(right.hostname)
          })
        : [
            ...domains.map((domain) => ({
              hostname: `admin.${domain}`,
              service: "http://siteinabox-cms:3000",
            })).sort((left, right) =>
              left.hostname.localeCompare(right.hostname)),
            { service: "http_status:404" },
          ],
    }))

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
      zoneDomains: domains,
    }))).resolves.toEqual([])
    expect(maximum).toBe(4)
  })

  it("bounds requests, rejects redirects, and aborts a hanging provider", async () => {
    const deps = dependencies()
    deps.inspectMollie.mockImplementation(async ({ fetchImpl }) => {
      await fetchImpl("https://api.mollie.com/v2/profiles/me")
    })
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("timed out", "TimeoutError"))
        }, { once: true })
      }))

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 5,
      overallTimeoutMs: 50,
    }))).resolves.toContain(
      "provider_capability:mollie:provider_unreachable",
    )
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.mollie.com/v2/profiles/me",
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("rejects oversized responses before provider parsers can inspect them", async () => {
    const deps = dependencies()
    deps.inspectMollie.mockImplementation(async ({ fetchImpl }) => {
      await fetchImpl("https://api.mollie.com/v2/profiles/me")
    })
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array(512 * 1024 + 1)))

    await expect(commerceProviderCapabilityBlockers(options({
      dependencies: deps,
      fetchImpl: fetchImpl as typeof fetch,
    }))).resolves.toContain(
      "provider_capability:mollie:provider_response_invalid",
    )
  })
})
