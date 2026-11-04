import assert from "node:assert/strict"
import test from "node:test"
import { ExchangeWorkerClient, ExchangeWorkerError, ExchangeWorkerIndeterminateWriteError } from "../../src/lib/microsoftMailProvisioning/exchangeWorker.ts"

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
      return Response.json({ healthy: true, protocolVersion: 2, moduleVersion: "3.10.1", dnsToolAvailable: true })
    },
  })
  const health = await client.health()
  assert.equal(new URL(requestUrl).pathname, "/health")
  assert.equal(health.healthy, true)
  assert.equal(health.moduleVersion, "3.10.1")
})

test("organization read access alone cannot satisfy workload capability verification",async()=>{
 const client=new ExchangeWorkerClient({endpoint:"https://worker.test/jobs",sharedSecret:"s".repeat(40),fetchImpl:async()=>Response.json({operation:"verify_access",completed:true,accessVerified:true})})
 await assert.rejects(client.execute({operation:"verify_access",partnerUserPrincipalName:"operator@partner.test",customerTenantId:"00000000-0000-4000-8000-000000000002",customerOrganizationDomain:"fixture.onmicrosoft.com",domain:"fixture.test",accessToken:"synthetic",requiredOperations:["get_dkim_targets","enable_dkim"]}),ExchangeWorkerIndeterminateWriteError)
})

test("an old read-only worker protocol cannot pass release readiness",async()=>{
 const client=new ExchangeWorkerClient({endpoint:"https://worker.test/jobs",sharedSecret:"s".repeat(40),fetchImpl:async()=>Response.json({healthy:true,protocolVersion:1,moduleVersion:"3.10.1",dnsToolAvailable:true})})
 await assert.rejects(client.health(),error=>error instanceof ExchangeWorkerError && error.code === "worker_unhealthy")
})
