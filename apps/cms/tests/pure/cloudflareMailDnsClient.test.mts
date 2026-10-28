import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CloudflareMailDnsClient, CloudflareMailDnsIndeterminateError } from "../../src/lib/microsoftMailProvisioning/cloudflare.ts"
import type { MailDnsChange } from "../../src/lib/microsoftMailProvisioning/dns.ts"

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" },
})

describe("Cloudflare mail DNS mock adapter", () => {
  for (const mode of ["success", "still-locked", "drift", "denied", "uncertain"] as const) it(`unlocks managed MX only for the final cutover: ${mode}`, async () => {
    const calls: Array<{ method: string; path: string }> = []
    let unlocked = false
    const original = { id: "legacy-mx", type: "MX", name: "example.nl", content: "route1.mx.cloudflare.net", priority: 10, proxied: false }
    const client = new CloudflareMailDnsClient({ token: "synthetic", accountId: "account-1", fetchImpl: async (input, init) => {
      const path = new URL(String(input)).pathname, method = init?.method ?? "GET"
      calls.push({ method, path })
      if (method === "PATCH") {
        assert.equal(path, "/client/v4/zones/zone-1/email/routing/dns")
        if (mode === "uncertain") throw new Error("network interrupted")
        if (mode === "denied") return json({ success: false }, 403)
        unlocked = true
        return json({ success: true })
      }
      if (method === "GET") return json({ success: true, result: [{ ...original,
        content: unlocked && mode === "drift" ? "changed.example.org" : original.content,
        meta: { email_routing: true, read_only: !unlocked || mode === "still-locked" } }], result_info: { total_pages: 1 } })
      assert.equal(unlocked, true)
      return json({ success: true })
    } })
    const existing = await client.listDnsRecords("zone-1")
    assert.equal(existing[0]?.emailRoutingLocked, true)
    const changes: MailDnsChange[] = [{ action: "create", record: { type: "MX", name: "example.nl", content: "example-nl.mail.protection.outlook.com", priority: 0, proxied: false } }, { action: "delete", id: original.id }]
    if (mode === "success") {
      await client.applyMxCutover("zone-1", changes, existing)
      assert.deepEqual(calls.map(call => call.method), ["GET", "PATCH", "GET", "POST", "DELETE"])
    } else {
      await assert.rejects(client.applyMxCutover("zone-1", changes, existing), mode === "uncertain" ? CloudflareMailDnsIndeterminateError : /Cloudflare/)
      assert.equal(calls.some(call => ["POST", "PUT", "DELETE"].includes(call.method)), false)
    }
  })

  it("finds the exact customer zone and reads the legacy info forwarding rule", async () => {
    const client = new CloudflareMailDnsClient({
      token: "cf-mock-token",
      accountId: "account-1",
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer cf-mock-token")
        if (url.pathname.endsWith("/zones")) {
          return json({ success: true, result: [{ id: "zone-tap2case", name: "tap2case.nl", status: "active" }] })
        }
        if (url.pathname.endsWith("/email/routing/rules")) {
          return json({ success: true, result: [{
            enabled: true,
            matchers: [{ type: "literal", field: "to", value: "info@tap2case.nl" }],
            actions: [{ type: "forward", value: ["info@amapromotions.nl"] }],
          }] })
        }
        return json({ success: false }, 404)
      },
    })

    assert.deepEqual(await client.findZone("TAP2CASE.NL"), {
      id: "zone-tap2case",
      name: "tap2case.nl",
      status: "active",
    })
    assert.deepEqual(await client.listEmailRoutingRules("zone-tap2case"), [{
      enabled: true,
      matchers: [{ type: "literal", field: "to", value: "info@tap2case.nl" }],
      actions: [{ type: "forward", value: ["info@amapromotions.nl"] }],
    }])
  })

  it("always writes mail DNS records DNS-only and leaves deletes until after creates", async () => {
    const calls: Array<{ method: string; path: string; body: Record<string, unknown> | null }> = []
    const client = new CloudflareMailDnsClient({
      token: "cf-mock-token",
      accountId: "account-1",
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null
        calls.push({ method, path: url.pathname, body })
        return json({ success: true, result: { id: "created" } })
      },
    })

    await client.applyChanges("zone-tap2case", [
      { action: "create", record: { type: "MX", name: "tap2case.nl", content: "mx.microsoft.example", priority: 0, proxied: false } },
      { action: "delete", id: "cloudflare-mx-1" },
    ])

    assert.equal(calls[0]?.method, "POST")
    assert.equal(calls[0]?.body?.proxied, false)
    assert.equal(calls[0]?.body?.priority, 0)
    assert.equal(calls[1]?.method, "DELETE")
    assert.equal(calls[1]?.path.endsWith("/cloudflare-mx-1"), true)
  })
})
