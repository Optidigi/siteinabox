import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildCloudflareEdgeDnsRecordRequests,
  buildCloudflareDnsRecordRequests,
  assertCloudflareEdgeDnsRecordsReconciliable,
  classifyCloudflareZoneLookup,
  CloudflareAmbiguousZoneLookupError,
  CloudflareDnsRecordConflictError,
  CloudflareIndeterminateWriteError,
  createCloudflareEmailSendingSubdomain,
  createCloudflareDnsRecord,
  createOrReuseCloudflareDnsRecord,
  createOrReuseCloudflareZone,
  createCloudflareZone,
  batchCreateCloudflareMigrationDnsRecords,
  enableCloudflareDnssec,
  createOrReuseCloudflareEmailSendingSubdomain,
  getCloudflareEmailSendingSubdomain,
  getCloudflareDnsRecordUsage,
  getCloudflareDnssec,
  getCloudflareHostnameCertificate,
  getCloudflareSslVerification,
  listCloudflareEmailSendingSubdomains,
  listCloudflareMigrationDnsRecords,
  reconcileOwnedCloudflareDnsRecord,
} from "@/lib/domains/cloudflare"

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
})

const env = {
  CLOUDFLARE_API_BASE_URL: "https://cloudflare.test/client/v4",
  CLOUDFLARE_API_TOKEN: "cf-token",
  CLOUDFLARE_ACCOUNT_ID: "account-123",
  CLOUDFLARE_RENDERER_TUNNEL_ID: "11111111-1111-4111-8111-111111111111",
  CLOUDFLARE_CMS_TUNNEL_ID: "22222222-2222-4222-8222-222222222222",
  SIAB_RENDERER_TARGET_HOST: "renderer.siteinabox.nl",
} as unknown as NodeJS.ProcessEnv

describe("Cloudflare domain adapter", () => {
  it("classifies exact zone authority as absent, exact, or ambiguous", () => {
    const zone = {
      id: "zone-123",
      name: "example.nl",
      status: "active" as const,
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      raw: {},
    }
    expect(classifyCloudflareZoneLookup("example.nl", [])).toEqual({
      outcome: "absent",
    })
    expect(classifyCloudflareZoneLookup("example.nl", [zone])).toEqual({
      outcome: "exact",
      zone,
    })
    expect(classifyCloudflareZoneLookup("example.nl", [
      zone,
      { ...zone, id: "zone-456" },
    ])).toEqual({ outcome: "ambiguous" })
  })

  it("reads and enables zone DNSSEC without inventing a separate permission", async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => Response.json({
      success: true,
      result: {
        status: init?.method === "PATCH" ? "pending" : "active",
        flags: 257,
        algorithm: "13",
        public_key: "AQID",
        ds: `example.nl. 86400 IN DS 12345 13 2 ${"AB".repeat(32)}`,
      },
    }))
    await expect(getCloudflareDnssec("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      status: "active",
      flags: 257,
      algorithm: 13,
      publicKey: "AQID",
      ds: `12345 13 2 ${"AB".repeat(32)}`,
      dsTtl: 86400,
    })
    await expect(enableCloudflareDnssec("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({ status: "pending" })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    })
  })

  it("reads and validates the destination DNS record quota", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: { record_quota: 200, record_usage: 2 },
    }))
    await expect(getCloudflareDnsRecordUsage("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual({ recordQuota: 200, recordUsage: 2 })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloudflare.test/client/v4/zones/zone-123/dns_records/usage",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("uses account usage when Cloudflare applies an account-level DNS quota", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/zones/zone-123/dns_records/usage")) {
        return Response.json({
          success: true,
          result: { record_quota: null, record_usage: 2 },
        })
      }
      if (url.endsWith("/accounts/account-123/dns_records/usage")) {
        return Response.json({
          success: true,
          result: { record_quota: 10_000, record_usage: 120 },
        })
      }
      throw new Error(`Unexpected Cloudflare usage read ${url}`)
    })
    await expect(getCloudflareDnsRecordUsage("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual({ recordQuota: 10_000, recordUsage: 120 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("creates a full zone and returns Cloudflare nameservers", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: {
        id: "zone-123",
        name: "example.nl",
        name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      },
    }))

    await expect(createCloudflareZone("Example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "zone-123",
      name: "example.nl",
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
    })

    expect(fetchMock).toHaveBeenCalledWith("https://cloudflare.test/client/v4/zones", {
      method: "POST",
      headers: {
        Authorization: "Bearer cf-token",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account: { id: "account-123" },
        name: "example.nl",
        type: "full",
      }),
    })
  })

  it("reuses an existing zone before attempting a duplicate provider write", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: [{
        id: "zone-123",
        name: "example.nl",
        status: "active",
        name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      }],
    }))

    await expect(createOrReuseCloudflareZone("example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({ id: "zone-123", status: "active" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloudflare.test/client/v4/zones?account.id=account-123&name=example.nl&match=all&per_page=5",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("fails closed without creating a zone when exact lookup is ambiguous", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: [
        {
          id: "zone-123",
          name: "example.nl",
          status: "active",
          name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
        },
        {
          id: "zone-456",
          name: "example.nl",
          status: "active",
          name_servers: ["cara.ns.cloudflare.com", "dan.ns.cloudflare.com"],
        },
      ],
    }))

    await expect(createOrReuseCloudflareZone("example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.toBeInstanceOf(CloudflareAmbiguousZoneLookupError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("classifies a non-JSON gateway failure after a zone write as indeterminate", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>gateway timeout</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    }))

    await expect(createCloudflareZone("example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.toBeInstanceOf(CloudflareIndeterminateWriteError)
  })

  it("classifies a successful zone response without a provider id as indeterminate", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: {
        name: "example.nl",
        name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      },
    }))

    await expect(createCloudflareZone("example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.toBeInstanceOf(CloudflareIndeterminateWriteError)
  })

  it("builds proxied renderer DNS records from host or IP env", () => {
    expect(buildCloudflareDnsRecordRequests("example.nl", env)).toEqual([
      {
        type: "CNAME",
        name: "example.nl",
        content: "renderer.siteinabox.nl",
        ttl: 1,
        proxied: true,
      },
      {
        type: "CNAME",
        name: "www.example.nl",
        content: "example.nl",
        ttl: 1,
        proxied: true,
      },
    ])

    expect(buildCloudflareDnsRecordRequests("example.nl", {
      ...env,
      SIAB_RENDERER_TARGET_HOST: "",
      SIAB_RENDERER_TARGET_IP: "203.0.113.10",
    } as unknown as NodeJS.ProcessEnv, { ttl: 300, proxied: false })).toEqual([
      {
        type: "A",
        name: "example.nl",
        content: "203.0.113.10",
        ttl: 300,
        proxied: false,
      },
      {
        type: "CNAME",
        name: "www.example.nl",
        content: "example.nl",
        ttl: 300,
        proxied: false,
      },
    ])
  })

  it("builds exact apex, www, and admin records for the dedicated Tunnels", () => {
    expect(buildCloudflareEdgeDnsRecordRequests("Example.nl.", env)).toEqual([
      {
        type: "CNAME",
        name: "example.nl",
        content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
        ttl: 1,
        proxied: true,
      },
      {
        type: "CNAME",
        name: "www.example.nl",
        content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
        ttl: 1,
        proxied: true,
      },
      {
        type: "CNAME",
        name: "admin.example.nl",
        content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
        ttl: 1,
        proxied: true,
      },
    ])
  })

  it("does not overwrite an unowned A, AAAA, or CNAME collision", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: [{
        id: "foreign-aaaa",
        type: "AAAA",
        name: "admin.example.nl",
        content: "2001:db8::1",
        proxied: false,
      }],
    }))
    await expect(reconcileOwnedCloudflareDnsRecord("zone-123", {
      type: "CNAME",
      name: "admin.example.nl",
      content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
      ttl: 1,
      proxied: true,
    }, [], {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.toBeInstanceOf(CloudflareDnsRecordConflictError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("paginates all address records before accepting an edge DNS plan", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = new URL(String(input)).searchParams.get("page")
      return Response.json({
        success: true,
        result: page === "1"
          ? Array.from({ length: 500 }, (_, index) => ({
              id: `unrelated-${index}`,
              type: "A",
              name: `unrelated-${index}.example.nl`,
              content: "192.0.2.1",
            }))
          : [{
              id: "foreign-aaaa",
              type: "AAAA",
              name: "admin.example.nl",
              content: "2001:db8::1",
            }],
        result_info: { total_pages: 2 },
      })
    })
    await expect(assertCloudflareEdgeDnsRecordsReconciliable(
      "zone-123",
      buildCloudflareEdgeDnsRecordRequests("example.nl", env),
      [],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).rejects.toBeInstanceOf(CloudflareDnsRecordConflictError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not adopt an identical external replacement after a failed owned update", async () => {
    let reads = 0
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      if (init?.method === "PUT") {
        return Response.json({ success: false }, { status: 500 })
      }
      reads += 1
      return Response.json({
        success: true,
        result: reads === 1
          ? [{
              id: "owned-old",
              type: "CNAME",
              name: "admin.example.nl",
              content: "old-target.invalid",
              proxied: true,
            }]
          : [{
              id: "foreign-replacement",
              type: "CNAME",
              name: "admin.example.nl",
              content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
              proxied: true,
            }],
      })
    })
    await expect(reconcileOwnedCloudflareDnsRecord("zone-123", {
      type: "CNAME",
      name: "admin.example.nl",
      content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
      ttl: 1,
      proxied: true,
    }, ["owned-old"], {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "foreign-replacement",
      ownershipDisposition: "unowned_reused",
    })
  })

  it("requires Universal SSL and an active pack covering the exact hostname", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/ssl/universal/settings")) {
        return Response.json({ success: true, result: { enabled: true } })
      }
      if (url.includes("/ssl/certificate_packs")) {
        return Response.json({
          success: true,
          result: [{
            status: "active",
            hosts: ["example.nl", "*.example.nl"],
          }],
        })
      }
      throw new Error(`Unexpected fetch ${url}`)
    })
    await expect(getCloudflareHostnameCertificate(
      "zone-123",
      "admin.example.nl",
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({
      universalSslEnabled: true,
      covered: true,
      certificateStatuses: ["active"],
    })
    await expect(getCloudflareHostnameCertificate(
      "zone-123",
      "deep.admin.example.nl",
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({
      covered: false,
    })
  })

  it("uses the certificate-pack limit and finds coverage on a later page", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/ssl/universal/settings")) {
        return Response.json({ success: true, result: { enabled: true } })
      }
      const parsed = new URL(url)
      expect(parsed.searchParams.get("per_page")).toBe("50")
      const page = parsed.searchParams.get("page")
      return Response.json({
        success: true,
        result: page === "1"
          ? Array.from({ length: 50 }, () => ({
              status: "pending",
              hosts: ["unrelated.invalid"],
            }))
          : [{ status: "active", hosts: ["*.example.nl"] }],
        result_info: { total_pages: 2 },
      })
    })
    await expect(getCloudflareHostnameCertificate(
      "zone-123",
      "admin.example.nl",
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({ covered: true })
  })

  it("requires renderer target config before building DNS records", () => {
    expect(() => buildCloudflareDnsRecordRequests("example.nl", {
      ...env,
      SIAB_RENDERER_TARGET_HOST: "",
      SIAB_RENDERER_TARGET_IP: "",
    } as unknown as NodeJS.ProcessEnv)).toThrow("SIAB_RENDERER_TARGET_HOST or SIAB_RENDERER_TARGET_IP")
  })

  it("creates an individual edge DNS record", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) => {
      if (init.method === "GET") {
        return Response.json({ success: true, result: [] })
      }
      const body = JSON.parse(String(init.body)) as { type: "A" | "CNAME"; name: string; content: string; proxied: boolean }
      return Response.json({
        success: true,
        result: {
          id: `record-${body.name}`,
          type: body.type,
          name: body.name,
          content: body.content,
          proxied: body.proxied,
        },
      })
    })

    await expect(createCloudflareDnsRecord("zone-123", {
      type: "CNAME",
      name: "example.nl",
      content: "renderer.siteinabox.nl",
      ttl: 1,
      proxied: true,
    }, {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "record-example.nl",
      type: "CNAME",
      name: "example.nl",
      content: "renderer.siteinabox.nl",
      proxied: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloudflare.test/client/v4/zones/zone-123/dns_records",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("semantically reuses an existing DNS record and reads active SSL evidence", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/dns_records")) {
        return Response.json({
          success: true,
          result: [{
            id: "record-123",
            type: "CNAME",
            name: "example.nl",
            content: "renderer.siteinabox.nl.",
            proxied: true,
          }],
        })
      }
      if (String(url).endsWith("/ssl/verification")) {
        return Response.json({
          success: true,
          result: [
            { certificate_status: "active" },
            { certificate_status: "pending_deployment" },
          ],
        })
      }
      throw new Error(`Unexpected fetch ${url}`)
    })

    await expect(createOrReuseCloudflareDnsRecord("zone-123", {
      type: "CNAME",
      name: "example.nl.",
      content: "renderer.siteinabox.nl",
      ttl: 1,
      proxied: true,
    }, {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({ id: "record-123" })
    await expect(getCloudflareSslVerification("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual(expect.objectContaining({
      status: "active",
      providerStatuses: ["active", "pending_deployment"],
    }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("lists, gets, creates, and reuses documented Email Sending subdomains", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (String(url).endsWith("/email/sending/subdomains") && init.method === "GET") {
        return Response.json({
          success: true,
          result: [{
            enabled: false,
            name: "mail.example.nl",
            tag: "subdomain-123",
            dkim_selector: "cf-bounce",
            return_path_domain: "cf-bounce.mail.example.nl",
          }],
        })
      }
      if (String(url).endsWith("/email/sending/subdomains/subdomain-123")) {
        return Response.json({
          success: true,
          result: {
            enabled: true,
            name: "mail.example.nl",
            tag: "subdomain-123",
            dkim_selector: "cf-bounce",
            return_path_domain: "cf-bounce.mail.example.nl",
          },
        })
      }
      if (String(url).endsWith("/email/sending/subdomains") && init.method === "POST") {
        return Response.json({
          success: true,
          result: {
            enabled: false,
            name: "mail.other.nl",
            tag: "subdomain-456",
          },
        })
      }
      throw new Error(`Unexpected fetch ${url}`)
    })

    await expect(listCloudflareEmailSendingSubdomains("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([expect.objectContaining({
      id: "subdomain-123",
      name: "mail.example.nl",
      enabled: false,
      dkimSelector: "cf-bounce",
      returnPathDomain: "cf-bounce.mail.example.nl",
    })])

    await expect(getCloudflareEmailSendingSubdomain("zone-123", "subdomain-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "subdomain-123",
      enabled: true,
    })

    await expect(createOrReuseCloudflareEmailSendingSubdomain("zone-123", "mail.example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "subdomain-123",
      name: "mail.example.nl",
    })

    await expect(createCloudflareEmailSendingSubdomain("zone-123", "mail.other.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: "subdomain-456",
      name: "mail.other.nl",
      enabled: false,
    })

    const createCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith("/email/sending/subdomains") && (init as RequestInit | undefined)?.method === "POST")
    expect(createCall?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer cf-token",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ name: "mail.other.nl" }),
    })
  })

  it("surfaces Cloudflare Email Sending API errors without token values", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: false,
      errors: [{ code: 1000, message: "subdomain unavailable" }],
      result: null,
    }, { status: 200 }))

    await expect(createCloudflareEmailSendingSubdomain("zone-123", "mail.example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.toThrow(
      "Cloudflare Email Sending subdomain creation failed with HTTP 200.",
    )
    await expect(createCloudflareEmailSendingSubdomain("zone-123", "mail.example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.not.toThrow("cf-token")
    await expect(createCloudflareEmailSendingSubdomain("zone-123", "mail.example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.not.toThrow("subdomain unavailable")
  })

  it("round-trips structured mail and service records for semantic migration comparison", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Response.json({
          success: true,
          result: {
            id: "srv-1",
            type: "SRV",
            name: "_sip._tcp.example.nl",
            ttl: 3600,
            proxied: false,
            data: {
              priority: 10,
              weight: 20,
              port: 5060,
              target: "sip.example.net",
            },
          },
        })
      }
      return Response.json({
        success: true,
        result_info: { page: 1, total_pages: 1, total_count: 3 },
        result: [
          {
            id: "mx-1",
            type: "MX",
            name: "example.nl",
            ttl: 3600,
            priority: 10,
            content: "mail.example.net.",
            proxied: false,
          },
          {
            id: "caa-1",
            type: "CAA",
            name: "example.nl",
            ttl: 3600,
            content: '0 issue "letsencrypt.org"',
            proxied: false,
          },
          {
            id: "srv-1",
            type: "SRV",
            name: "_sip._tcp.example.nl",
            ttl: 3600,
            data: {
              priority: 10,
              weight: 20,
              port: 5060,
              target: "sip.example.net.",
            },
            proxied: false,
          },
        ],
      })
    })

    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([
      expect.objectContaining({ record: expect.objectContaining({ type: "MX", target: "mail.example.net" }) }),
      expect.objectContaining({ record: expect.objectContaining({ type: "CAA", value: "letsencrypt.org" }) }),
      expect.objectContaining({ record: expect.objectContaining({ type: "SRV", target: "sip.example.net" }) }),
    ])

    await expect(batchCreateCloudflareMigrationDnsRecords("zone-123", [{
      type: "MX",
      name: "example.nl",
      ttl: 3600,
      priority: 10,
      target: "mail.example.net",
      proxied: false,
    }, {
      type: "SRV",
      name: "_sip._tcp.example.nl",
      ttl: 3600,
      priority: 10,
      weight: 20,
      port: 5060,
      target: "sip.example.net",
      proxied: false,
    }], {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://cloudflare.test/client/v4/zones/zone-123/dns_records/batch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          posts: [{
            type: "MX",
            name: "example.nl",
            ttl: 3600,
            proxied: false,
            content: "mail.example.net",
            priority: 10,
          }, {
            type: "SRV",
            name: "_sip._tcp.example.nl",
            ttl: 3600,
            proxied: false,
            data: {
              priority: 10,
              weight: 20,
              port: 5060,
              target: "sip.example.net",
            },
          }],
        }),
      }),
    )
  })

  it("normalizes Cloudflare proxied Auto TTL to its 300-second semantic value", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result_info: { page: 1, total_pages: 1, total_count: 1 },
      result: [{
        id: "web-1",
        type: "A",
        name: "example.nl",
        ttl: 1,
        content: "192.0.2.10",
        proxied: true,
      }],
    }))
    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([
      expect.objectContaining({
        record: expect.objectContaining({
          type: "A",
          ttl: 300,
          proxied: true,
        }),
      }),
    ])
  })

  it("fails closed when Cloudflare record inventory is incomplete or unsupported", async () => {
    const incomplete = vi.fn(async () => Response.json({
      success: true,
      result_info: { total_count: 501 },
      result: [],
    }))
    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: incomplete as typeof fetch,
    })).rejects.toThrow("invalid pagination metadata")

    const supportedTlsa = vi.fn(async () => Response.json({
      success: true,
      result_info: { page: 1, total_pages: 1, total_count: 1 },
      result: [{
        id: "tlsa-1",
        type: "TLSA",
        name: "_443._tcp.example.nl",
        ttl: 3600,
        content: `3 1 1 ${"AB".repeat(32)}`,
      }],
    }))
    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: supportedTlsa as typeof fetch,
    })).resolves.toEqual([
      expect.objectContaining({
        record: expect.objectContaining({
          type: "TLSA",
          certificateUsage: 3,
          selector: 1,
          matchingType: 1,
          certificateAssociationData: "ab".repeat(32),
        }),
      }),
    ])

    const unsupported = vi.fn(async () => Response.json({
      success: true,
      result_info: { page: 1, total_pages: 1, total_count: 1 },
      result: [{
        id: "naptr-1",
        type: "NAPTR",
        name: "example.nl",
        ttl: 3600,
        content: "100 10 U E2U+sip",
      }],
    }))
    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: unsupported as typeof fetch,
    })).rejects.toThrow("unsupported")
  })

  it("captures every Cloudflare pagination page before accepting zone authority", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = new URL(String(input)).searchParams.get("page")
      return Response.json({
        success: true,
        result_info: { page: Number(page), total_pages: 2, total_count: 2 },
        result: [{
          id: `txt-${page}`,
          type: "TXT",
          name: page === "1" ? "example.nl" : "_dmarc.example.nl",
          ttl: 300,
          content: page === "1" ? "verification=ok" : "v=DMARC1; p=none",
          proxied: false,
        }],
      })
    })
    await expect(listCloudflareMigrationDnsRecords("zone-123", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
