import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildCloudflareDnsRecordRequests,
  createCloudflareEmailSendingSubdomain,
  createCloudflareDnsRecord,
  createCloudflareZone,
  createCloudflareZoneDnsRecords,
  createOrReuseCloudflareEmailSendingSubdomain,
  getCloudflareEmailSendingSubdomain,
  listCloudflareEmailSendingSubdomains,
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
  SIAB_RENDERER_TARGET_HOST: "renderer.siteinabox.nl",
} as unknown as NodeJS.ProcessEnv

describe("Cloudflare domain adapter", () => {
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

  it("requires renderer target config before building DNS records", () => {
    expect(() => buildCloudflareDnsRecordRequests("example.nl", {
      ...env,
      SIAB_RENDERER_TARGET_HOST: "",
      SIAB_RENDERER_TARGET_IP: "",
    } as unknown as NodeJS.ProcessEnv)).toThrow("SIAB_RENDERER_TARGET_HOST or SIAB_RENDERER_TARGET_IP")
  })

  it("creates individual and batched DNS records", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
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

    await expect(createCloudflareZoneDnsRecords("zone-123", "example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toHaveLength(2)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloudflare.test/client/v4/zones/zone-123/dns_records",
      expect.objectContaining({ method: "POST" }),
    )
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
    })).rejects.toThrow("subdomain unavailable")
    await expect(createCloudflareEmailSendingSubdomain("zone-123", "mail.example.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).rejects.not.toThrow("cf-token")
  })
})
