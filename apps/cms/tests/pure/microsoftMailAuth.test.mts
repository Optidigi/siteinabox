import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createMicrosoftAppTokenProvider } from "../../src/lib/microsoftMailProvisioning/microsoftAuth.ts"

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

describe("Microsoft app-only token provider", () => {
  it("requests a per-tenant, per-resource token and caches only that audience", async () => {
    const requests: Array<{ url: URL; body: URLSearchParams }> = []
    let issue = 0
    const provider = createMicrosoftAppTokenProvider({
      partnerTenantId: "00000000-0000-0000-0000-000000000001",
      clientId: "partner-app",
      clientSecret: "secret-value-never-logged",
      now: () => 1000,
      fetchImpl: async (input, init) => {
        requests.push({ url: new URL(String(input)), body: new URLSearchParams(String(init?.body ?? "")) })
        issue += 1
        return response({ access_token: `token-${issue}`, expires_in: 3600 })
      },
    })
    const partnerGraph = await provider({ tenantId: "00000000-0000-0000-0000-000000000001", resource: "graph" })
    assert.equal(await provider({ tenantId: "00000000-0000-0000-0000-000000000001", resource: "graph" }), partnerGraph)
    const customerGraph = await provider({ tenantId: "00000000-0000-0000-0000-000000000002", resource: "graph" })
    const customerExchange = await provider({ tenantId: "00000000-0000-0000-0000-000000000002", resource: "exchange" })
    assert.equal(requests.length, 3)
    assert.equal(requests[0]?.url.pathname, "/00000000-0000-0000-0000-000000000001/oauth2/v2.0/token")
    assert.equal(requests[0]?.body.get("scope"), "https://graph.microsoft.com/.default")
    assert.equal(requests[1]?.url.pathname, "/00000000-0000-0000-0000-000000000002/oauth2/v2.0/token")
    assert.equal(requests[2]?.body.get("scope"), "https://outlook.office365.com/.default")
    assert.notEqual(partnerGraph, customerGraph)
    assert.notEqual(customerGraph, customerExchange)
    assert.equal(requests[0]?.body.get("client_secret"), "secret-value-never-logged")
  })

  it("rejects missing configuration and returns sanitized token failures", async () => {
    assert.throws(() => createMicrosoftAppTokenProvider({ partnerTenantId: "invalid", clientId: "", clientSecret: "" }), /credentials are required/)
    const provider = createMicrosoftAppTokenProvider({
      partnerTenantId: "00000000-0000-0000-0000-000000000001",
      clientId: "partner-app",
      clientSecret: "sensitive",
      fetchImpl: async () => response({ error: "invalid_client", error_description: "sensitive detail" }, 401),
    })
    await assert.rejects(provider({ tenantId: "00000000-0000-0000-0000-000000000001", resource: "graph" }), (error: Error) => {
      assert.match(error.message, /invalid_client/)
      assert.doesNotMatch(error.message, /sensitive/)
      return true
    })
  })
})

import { createMicrosoftDelegatedTokenProvider } from "../../src/lib/microsoftMailProvisioning/microsoftAuth.ts"

describe("Microsoft secure application model", () => {
  it("uses delegated refresh grants at each target tenant and persists rotated refresh tokens", async () => {
    let refreshToken = "first-refresh-token"
    const requests: URLSearchParams[] = []
    const authorities: string[] = []
    const provider = createMicrosoftDelegatedTokenProvider({ clientId: "partner-app", clientSecret: "synthetic-client-secret",
      store: { exclusive: async operation => operation(), read: async () => refreshToken,
        write: async value => { refreshToken = value }, requireReconnect: async () => { throw new Error("Unexpected reconnect") } },
      fetchImpl: async (input, init) => {
        authorities.push(new URL(String(input)).pathname)
        requests.push(new URLSearchParams(String(init?.body)))
        return response({ access_token: `access-${requests.length}`, refresh_token: `rotated-${requests.length}`, expires_in: 3600 })
      } })
    await provider({ tenantId: "00000000-0000-0000-0000-000000000002", resource: "graph" })
    await provider({ tenantId: "00000000-0000-0000-0000-000000000002", resource: "exchange" })
    assert.equal(requests[0]?.get("grant_type"), "refresh_token")
    assert.equal(requests[0]?.get("refresh_token"), "first-refresh-token")
    assert.equal(requests[1]?.get("refresh_token"), "rotated-1")
    assert.equal(refreshToken, "rotated-2")
    assert.ok(authorities.every(value => value.startsWith("/00000000-0000-0000-0000-000000000002/")))
  })
  it("marks invalid grants for internal reconnection and hides token details", async () => {
    let reconnect = false
    const provider = createMicrosoftDelegatedTokenProvider({ clientId: "partner-app", clientSecret: "synthetic-secret",
      store: { exclusive: async operation => operation(), read: async () => "private-refresh-token", write: async () => {}, requireReconnect: async () => { reconnect = true } },
      fetchImpl: async () => response({ error: "invalid_grant", error_description: "private-refresh-token" }, 400) })
    await assert.rejects(provider({ tenantId: "00000000-0000-0000-0000-000000000002", resource: "graph" }), error => error instanceof Error && !error.message.includes("private-refresh-token"))
    assert.equal(reconnect, true)
  })
})
