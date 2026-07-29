import { describe, expect, it, vi } from "vitest"

import {
  buildCloudflareTunnelIngress,
  CloudflareTunnelApiError,
  cloudflareTunnelTarget,
  reconcileCloudflareTunnel,
} from "@/lib/domains/cloudflareTunnels"

const rendererId = "11111111-1111-4111-8111-111111111111"
const cmsId = "22222222-2222-4222-8222-222222222222"
const env = {
  CLOUDFLARE_API_BASE_URL: "https://cloudflare.test/client/v4",
  CLOUDFLARE_API_TOKEN: "cf-token",
  CLOUDFLARE_ACCOUNT_ID: "account-123",
  CLOUDFLARE_RENDERER_TUNNEL_ID: rendererId,
  CLOUDFLARE_RENDERER_TUNNEL_NAME: "siteinabox-renderer",
  CLOUDFLARE_CMS_TUNNEL_ID: cmsId,
  CLOUDFLARE_CMS_TUNNEL_NAME: "siteinabox-cms",
} as unknown as NodeJS.ProcessEnv

describe("Cloudflare dedicated Tunnel contracts", () => {
  it("builds exact sorted ingress with a terminal neutral 404", () => {
    expect(buildCloudflareTunnelIngress("renderer", [
      "www.example.nl",
      "example.nl",
    ])).toEqual([
      {
        hostname: "example.nl",
        service: "http://siteinabox-renderer:4321",
      },
      {
        hostname: "www.example.nl",
        service: "http://siteinabox-renderer:4321",
      },
      { service: "http_status:404" },
    ])
    expect(() => buildCloudflareTunnelIngress("cms", [
      "admin.example.nl",
      "admin.example.nl",
    ])).toThrow(/invalid or duplicate/)
    expect(() => buildCloudflareTunnelIngress("cms", ["*.example.nl"]))
      .toThrow(/invalid or duplicate/)
  })

  it("derives DNS targets only from dedicated configured UUIDs", () => {
    expect(cloudflareTunnelTarget("renderer", env))
      .toBe(`${rendererId}.cfargotunnel.com`)
    expect(cloudflareTunnelTarget("cms", env))
      .toBe(`${cmsId}.cfargotunnel.com`)
  })

  it("replaces drifted remote ingress once and confirms a healthy connector", async () => {
    let ingress: unknown[] = [{ service: "http_status:404" }]
    let version = 4
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input)
      if (url.endsWith(`/cfd_tunnel/${rendererId}`)) {
        return Response.json({
          success: true,
          result: {
            id: rendererId,
            name: "siteinabox-renderer",
            status: "healthy",
            config_src: "cloudflare",
          },
        })
      }
      if (url.endsWith("/configurations") && init?.method === "PUT") {
        ingress = (
          JSON.parse(String(init.body)) as { config: { ingress: unknown[] } }
        ).config.ingress
        version += 1
        return Response.json({ success: true, result: { version } })
      }
      if (url.endsWith("/configurations")) {
        return Response.json({
          success: true,
          result: { version, config: { ingress } },
        })
      }
      if (url.endsWith("/connections")) {
        return Response.json({
          success: true,
          result: [{
            id: "client-1",
            conns: [{ id: "connection-1", is_pending_reconnect: false }],
          }],
        })
      }
      return Response.json({ success: false }, { status: 404 })
    })

    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["www.example.nl", "example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({
      changed: true,
      connected: true,
      configurationVersion: 5,
    })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT"))
      .toHaveLength(1)

    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["example.nl", "www.example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({ changed: false, connected: true })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT"))
      .toHaveLength(1)
  })

  it("fails closed for the wrong or locally managed Tunnel", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      result: {
        id: rendererId,
        name: "unrelated-tunnel",
        status: "healthy",
        config_src: "local",
      },
    }))
    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).rejects.toThrow(/not the expected dedicated remotely managed Tunnel/)
  })

  it("replaces path and origin-request ingress drift", async () => {
    let ingress: unknown[] = [{
      hostname: "example.nl",
      service: "http://siteinabox-renderer:4321",
      originRequest: { httpHostHeader: "attacker.invalid" },
    }, { service: "http_status:404" }]
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input)
      if (url.endsWith(`/cfd_tunnel/${rendererId}`)) {
        return Response.json({
          success: true,
          result: {
            id: rendererId,
            name: "siteinabox-renderer",
            status: "healthy",
            config_src: "cloudflare",
          },
        })
      }
      if (url.endsWith("/configurations") && init?.method === "PUT") {
        ingress = (
          JSON.parse(String(init.body)) as { config: { ingress: unknown[] } }
        ).config.ingress
        return Response.json({ success: true, result: { version: 2 } })
      }
      if (url.endsWith("/configurations")) {
        return Response.json({
          success: true,
          result: { version: 2, config: { ingress } },
        })
      }
      return Response.json({
        success: true,
        result: [{
          conns: [{ id: "connection-1", is_pending_reconnect: false }],
        }],
      })
    })
    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({ changed: true, connected: true })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true)
  })

  it("does not count pending-reconnect clients as connected", async () => {
    const expected = buildCloudflareTunnelIngress("renderer", ["example.nl"])
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith(`/cfd_tunnel/${rendererId}`)) {
        return Response.json({
          success: true,
          result: {
            id: rendererId,
            name: "siteinabox-renderer",
            status: "healthy",
            config_src: "cloudflare",
          },
        })
      }
      if (url.endsWith("/configurations")) {
        return Response.json({
          success: true,
          result: { version: 1, config: { ingress: expected } },
        })
      }
      return Response.json({
        success: true,
        result: [{
          conns: [{ id: "connection-1", is_pending_reconnect: true }],
        }],
      })
    })
    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).resolves.toMatchObject({ connected: false })
  })

  it("preserves a permanent configuration-write failure after reread", async () => {
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input)
      if (url.endsWith(`/cfd_tunnel/${rendererId}`)) {
        return Response.json({
          success: true,
          result: {
            id: rendererId,
            name: "siteinabox-renderer",
            status: "healthy",
            config_src: "cloudflare",
          },
        })
      }
      if (url.endsWith("/configurations") && init?.method === "PUT") {
        return Response.json({ success: false }, { status: 403 })
      }
      return Response.json({
        success: true,
        result: {
          version: 1,
          config: { ingress: [{ service: "http_status:404" }] },
        },
      })
    })
    await expect(reconcileCloudflareTunnel(
      "renderer",
      ["example.nl"],
      { env, fetchImpl: fetchMock as typeof fetch },
    )).rejects.toBeInstanceOf(CloudflareTunnelApiError)
  })
})
