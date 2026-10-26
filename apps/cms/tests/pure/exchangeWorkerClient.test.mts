import assert from "node:assert/strict"
import test from "node:test"
import { ExchangeWorkerClient, ExchangeWorkerIndeterminateWriteError } from "../../src/lib/microsoftMailProvisioning/exchangeWorker.ts"

test("Exchange worker client sends a narrowly scoped job over HTTPS", async () => {
  const sent: Request[] = []
  const client = new ExchangeWorkerClient({
    endpoint: "https://exchange-worker.internal/jobs",
    sharedSecret: "x".repeat(40),
    fetchImpl: async (input, init) => {
      sent.push(new Request(input, init))
      return Response.json({ operation: "ensure_info_forward", completed: true, sharedMailbox: "info@tap2case.nl", forwardingAddress: "info@example.org" })
    },
  })
  const result = await client.execute({
    operation: "ensure_info_forward", partnerUserPrincipalName: "obo@partner.onmicrosoft.com", customerTenantId: "00000000-0000-0000-0000-000000000001", customerOrganizationDomain: "tap2case.onmicrosoft.com",
    accessToken: "short-lived-token", domain: "tap2case.nl", infoAddress: "info@tap2case.nl", forwardTo: "info@example.org",
  })
  assert.equal(result.completed, true)
  assert.equal(sent[0]?.headers.get("authorization"), `Bearer ${"x".repeat(40)}`)
  assert.equal(sent[0]?.cache, "no-store")
  assert.equal(JSON.parse(await sent[0]!.text()).accessToken, "short-lived-token")
})

test("Exchange worker rejects non-TLS endpoints and invalid worker credentials", () => {
  assert.throws(() => new ExchangeWorkerClient({ endpoint: "http://worker/jobs", sharedSecret: "x".repeat(40) }), /HTTPS/)
  assert.throws(() => new ExchangeWorkerClient({ endpoint: "https://worker/jobs", sharedSecret: "too-short" }), /32 characters/)
})

test("uncertain worker responses are surfaced as indeterminate writes", async () => {
  const request = {
    operation: "enable_dkim" as const, partnerUserPrincipalName: "obo@partner.onmicrosoft.com", customerTenantId: "00000000-0000-0000-0000-000000000001", customerOrganizationDomain: "tap2case.onmicrosoft.com",
    accessToken: "short-lived-token", domain: "tap2case.nl",
  }
  const failedResponse = new ExchangeWorkerClient({
    endpoint: "https://exchange-worker.internal/jobs", sharedSecret: "x".repeat(40),
    fetchImpl: async () => Response.json({ code: "exchange_command_failed" }, { status: 502 }),
  })
  await assert.rejects(failedResponse.execute(request), ExchangeWorkerIndeterminateWriteError)
  const lostResponse = new ExchangeWorkerClient({
    endpoint: "https://exchange-worker.internal/jobs", sharedSecret: "x".repeat(40),
    fetchImpl: async () => { throw new TypeError("connection lost") },
  })
  await assert.rejects(lostResponse.execute(request), ExchangeWorkerIndeterminateWriteError)
})

test("worker readiness checks only the private service health endpoint", async () => {
  let requestUrl = ""
  const client = new ExchangeWorkerClient({
    endpoint: "https://exchange-worker.internal/jobs",
    sharedSecret: "x".repeat(40),
    fetchImpl: async (input) => {
      requestUrl = String(input)
      return Response.json({ healthy: true, protocolVersion: 1, moduleVersion: "3.10.1", dnsToolAvailable: true })
    },
  })
  const health = await client.health()
  assert.equal(new URL(requestUrl).pathname, "/health")
  assert.equal(health.healthy, true)
  assert.equal(health.moduleVersion, "3.10.1")
})
