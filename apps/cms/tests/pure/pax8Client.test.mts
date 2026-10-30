import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Pax8Client } from "../../src/lib/microsoftMailProvisioning/pax8.ts"
import { PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID, runPax8MailPreflight } from "../../src/lib/microsoftMailProvisioning/pax8Preflight.ts"

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" },
})

describe("Pax8 mock adapter", () => {
  it("uses OAuth client credentials and keeps isMock in the query string", async () => {
    const calls: Array<{ url: URL; method: string; body: unknown }> = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      now: () => 1_000,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        let body: unknown
        if (typeof init?.body === "string") body = JSON.parse(init.body)
        calls.push({ url, method, body })
        if (url.pathname === "/v1/token") {
          return json({ access_token: "mock-access-token", expires_in: 3600 })
        }
        return json({
          id: "order-mock-1",
          companyId: "company-1",
          lineItems: [{ productId: "product-1", subscriptionId: null, quantity: 2, billingTerm: "Annual" }],
        })
      },
    })

    const order = await client.createOrder({
      companyId: "company-1",
      orderedByUserEmail: "provisioning@optidigi.nl",
      lineItems: [{
        productId: "product-1",
        lineItemNumber: 1,
        quantity: 2,
        billingTerm: "Annual",
        commitmentTermId: "annual-term",
        provisioningDetails: [],
      }],
    }, { mock: true })

    assert.equal(order.id, "order-mock-1")
    assert.equal(calls.length, 2)
    assert.equal(calls[0]?.url.pathname, "/v1/token")
    assert.equal((calls[0]?.body as Record<string, unknown>).grant_type, "client_credentials")
    assert.equal(calls[1]?.url.pathname, "/v1/orders")
    assert.equal(calls[1]?.url.searchParams.get("isMock"), "true")
    assert.equal("isMock" in (calls[1]?.body as Record<string, unknown>), false)
    assert.equal((calls[1]?.body as { lineItems: Array<{ quantity: number }> }).lineItems[0]?.quantity, 2)
  })

  it("paginates company reads before choosing the exact domain match", async () => {
    const calls: URL[] = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      now: () => 1_000,
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        calls.push(url)
        if (url.pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
        const page = Number(url.searchParams.get("page"))
        return page === 0
          ? json({ content: [{ id: "wrong", website: "other.nl" }], page: { number: 0, totalPages: 2 } })
          : json({ content: [{ id: "tap2case", website: "https://tap2case.nl" }], page: { number: 1, totalPages: 2 } })
      },
    })

    const company = await client.findCompanyByWebsite("tap2case.nl")
    assert.equal(company?.id, "tap2case")
    assert.deepEqual(calls.filter((url) => url.pathname === "/v1/companies").map((url) => url.searchParams.get("page")), ["0", "1"])
  })

  it("updates a single subscription quantity with Pax8's PUT contract", async () => {
    const calls: Array<{ method: string; url: URL; body: unknown }> = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      now: () => 1_000,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        let body: unknown
        if (typeof init?.body === "string") body = JSON.parse(init.body)
        calls.push({ method: init?.method ?? "GET", url, body })
        if (url.pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
        return json({ id: "subscription-1", quantity: 2, status: "Active" })
      },
    })

    const result = await client.updateSubscriptionQuantity("subscription-1", 2)
    assert.equal(result.quantity, 2)
    const write = calls.at(-1)!
    assert.equal(write.method, "PUT")
    assert.equal(write.url.pathname, "/v1/subscriptions/subscription-1")
    assert.deepEqual(write.body, { quantity: 2 })
  })

  it("links a confirmed Microsoft tenant ID to its Pax8 company with PATCH", async () => {
    const requests: Array<{ method: string; url: URL; body: unknown }> = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
        requests.push({ method, url, body })
        if (url.pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
        return json({ id: "company-1", externalId: "00000000-0000-0000-0000-000000000002" })
      },
    })
    const company = await client.updateCompanyExternalId("company-1", "00000000-0000-0000-0000-000000000002")
    assert.equal(company.externalId, "00000000-0000-0000-0000-000000000002")
    assert.equal(requests.at(-1)?.method, "PATCH")
    assert.equal(requests.at(-1)?.url.pathname, "/v1/companies/company-1")
  })

  it("reads current product fields, dependencies, and company pricing from documented routes", async () => {
    const calls: URL[] = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        calls.push(url)
        if (url.pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
        if (url.pathname.endsWith("/provision-details")) return json({ content: [{ key: "companyDomain", label: "Tenant domain", valueType: "string" }] })
        if (url.pathname.endsWith("/dependencies")) return json({ commitmentDependencies: [{ id: "annual", term: "Annual" }] })
        return json({ partnerCost: 10, recommendedPrice: 12 })
      },
    })
    const fields = await client.getProvisioningFields("product-1")
    const terms = await client.getCommitmentTerms("product-1")
    const pricing = await client.getPricing("product-1", "company-1")
    assert.equal(fields[0]?.key, "companyDomain")
    assert.equal(terms[0]?.term, "Annual")
    assert.equal(pricing.recommendedPrice, 12)
    assert.ok(calls.some((url) => url.pathname === "/v1/products/product-1/provision-details" && url.search === ""))
    assert.ok(calls.some((url) => url.pathname === "/v1/products/product-1/dependencies" && url.search === ""))
    assert.ok(calls.some((url) => url.pathname === "/v1/products/product-1/pricing" && url.searchParams.get("companyId") === "company-1"))
  })

  it("preflights one annual seat batch against a current Pax8 company and product", async () => {
    const calls: URL[] = []
    const client = new Pax8Client({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        calls.push(url)
        if (url.pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
        if (url.pathname === "/v1/companies") return json({ content: [{ id: "company-1", name: "Tap2case", website: "https://tap2case.nl", status: "Active" }], page: { number: 0, totalPages: 1 } })
        if (url.pathname === `/v1/products/${PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID}`) return json({ id: PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID, name: "Microsoft 365 Business Basic EEA (no Teams)" })
        if (url.pathname.endsWith("/provision-details")) return json({ content: [{ key: "companyDomain", label: "Tenant domain", required: true }] })
        if (url.pathname.endsWith("/dependencies")) return json({ commitmentDependencies: [{ id: "annual", term: "Annual" }] })
        return json({ partnerCost: 4.2, recommendedPrice: 5 })
      },
    })
    const result = await runPax8MailPreflight({ client, website: "https://tap2case.nl", quantity: 2 })
    assert.equal(result.company?.id, "company-1")
    assert.equal(result.quantity, 2)
    assert.equal(result.provisioningFields[0]?.required, true)
    assert.equal(result.commitments[0]?.term, "Annual")
    assert.equal(result.pricing.recommendedPrice, 5)
    assert.ok(calls.some((url) => url.pathname === `/v1/products/${PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID}/pricing` && url.searchParams.get("companyId") === "company-1"))
  })
})

it("end-of-term cancellation always supplies an explicit verified future date and no body", async () => {
  const calls: Array<{url:URL;init:RequestInit|undefined}>=[]
  const client=new Pax8Client({clientId:"synthetic-client",clientSecret:"synthetic-secret",now:()=>Date.parse("2026-01-01"),fetchImpl:async(input,init)=>{
    const url=new URL(String(input));calls.push({url,init})
    return url.pathname.endsWith("/token") ? Response.json({access_token:"synthetic-token",expires_in:3600}) : new Response(null,{status:204})
  }})
  await assert.rejects(client.scheduleEndOfTermCancellation("subscription-1","2025-01-01"),/Future verified/)
  assert.equal(calls.length,0)
  await client.scheduleEndOfTermCancellation("subscription-1","2027-01-01T00:00:00Z")
  const cancellation=calls.find(call=>call.init?.method==="DELETE")!
  assert.equal(cancellation.url.searchParams.get("cancelDate"),"2027-01-01T00:00:00.000Z")
  assert.equal(cancellation.init?.body,undefined)
})

it("sends international Dutch company and contact digits without changing saved customer details", async () => {
  for (const phone of ["+31 6 1234 5678", "0031 (6) 12345678", "06-12345678"]) {
    let submitted: Record<string, unknown> = {}
    const client = new Pax8Client({ clientId: "client", clientSecret: "secret", fetchImpl: async (url, init) => {
      if (new URL(String(url)).pathname === "/v1/token") return json({ access_token: "token", expires_in: 3600 })
      submitted = JSON.parse(String(init?.body))
      return json({ id: "company-1", status: "Active" })
    } })
    const input = { name: "Fixture", website: "https://customer.test", phone, address: { street: "Fixture 1", city: "Amsterdam", postalCode: "1000AA", country: "NL" }, contacts: [{ firstName: "Operations", lastName: "Fixture", email: "operations@example.test", phone, types: [{ type: "Admin" as const, primary: true }] }] }
    await client.createCompany(input)
    assert.equal(submitted.phone, "31612345678")
    assert.equal((submitted.contacts as Array<{ phone: string }>)[0]?.phone, "31612345678")
    assert.equal(input.phone, phone)
    assert.equal(input.contacts[0]?.phone, phone)
  }
})
