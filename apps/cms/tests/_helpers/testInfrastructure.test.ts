import { describe, expect, it } from "vitest"

import { classifyMigrationEntry } from "../../src/lib/domains/migrationDecisions"
import {
  setOpenProviderDomainAutorenew,
  updateOpenProviderDomainDnssec,
  updateOpenProviderDomainNameservers,
} from "../../src/lib/domains/openprovider"
import {
  validBillingAgreement,
  validDomainMigration,
  validManagedDomain,
  validOrder,
  validPaymentAttempt,
  validRenewalCycle,
} from "./commerceBuilders"
import { createMutablePayloadStore } from "./mockPayload"
import {
  createCloudflareMockRouter,
  createMollieMockRouter,
  createOpenProviderMockRouter,
} from "./providerRouters"

describe("commerce test builders", () => {
  it("provides internally aligned defaults with narrow override support", () => {
    const order = validOrder({ id: 601, currency: "USD" })
    const agreement = validBillingAgreement()
    const payment = validPaymentAttempt()
    const domain = validManagedDomain()
    const migration = validDomainMigration()
    const renewal = validRenewalCycle()

    expect(order).toMatchObject({ id: 601, currency: "USD", totalGrossMinor: 49_900 })
    expect(agreement).toMatchObject({ originatingOrder: 600, provider: "mollie" })
    expect(payment).toMatchObject({ order: 600, attemptNumber: 1, state: "created" })
    expect(domain).toMatchObject({
      domainNameAscii: "example.nl",
      custodyStatus: "managed",
      providerRegistrationState: "confirmed",
    })
    expect(migration).toMatchObject({
      originatingOrder: 600,
      sourceMechanism: "cloudflare_api_v1",
      providerTransferState: "not_started",
      managedDomain: {
        initialOperation: "transfer",
        providerRegistrationState: "not_started",
      },
    })
    expect(classifyMigrationEntry(migration)).toEqual({ outcome: "continue" })
    expect(renewal).toMatchObject({
      managedDomain: 950,
      providerWriteState: "not_required",
      financialCoverageState: "included_allowance",
    })
  })
})

describe("mutable Payload store", () => {
  it("supports conditional and optimistic updates", async () => {
    const store = createMutablePayloadStore({
      collections: {
        orders: [{ id: 1, state: "accepted", version: 2 }],
      },
    })

    await expect(store.update({
      collection: "orders",
      where: { state: { equals: "paid" } },
      data: { state: "fulfilled" },
    })).resolves.toMatchObject({ totalDocs: 0 })

    await expect(store.update({
      collection: "orders",
      id: 1,
      optimistic: { equals: 1 },
      data: { state: "paid" },
    })).rejects.toThrow("Optimistic update conflict")

    await expect(store.update({
      collection: "orders",
      id: 1,
      optimistic: { equals: 2 },
      data: { state: "paid" },
    })).resolves.toMatchObject({ state: "paid", version: 3 })
  })

  it("rolls back explicit transactions and injects one-shot races", async () => {
    const store = createMutablePayloadStore({
      collections: { orders: [{ id: 1, state: "accepted" }] },
    })
    store.injectCreateFailureOnce(new Error("injected unique race"))

    await expect(store.create({
      collection: "orders",
      data: { state: "accepted" },
    })).rejects.toThrow("injected unique race")
    await expect(store.create({
      collection: "orders",
      data: { state: "accepted" },
    })).resolves.toMatchObject({ id: 1_000 })

    await expect(store.transaction(async () => {
      await store.update({
        collection: "orders",
        id: 1,
        data: { state: "paid" },
      })
      throw new Error("restart")
    })).rejects.toThrow("restart")

    expect(store.collections.orders?.[0]).toMatchObject({ state: "accepted" })
  })
})

describe("stateful provider routers", () => {
  it("fails Mollie writes closed until explicitly enabled", async () => {
    const mollie = createMollieMockRouter()
    const request = {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: "499.00" },
        metadata: { orderId: 600 },
      }),
    }

    await expect(mollie.fetch("https://api.mollie.test/v2/payments", request))
      .resolves.toMatchObject({ status: 503 })
    expect(mollie.state.payments.size).toBe(0)

    mollie.allow("create_payment", "read_payment")
    const created = await mollie.fetch("https://api.mollie.test/v2/payments", request)
    const payment = await created.json() as { id: string }
    expect(mollie.state.payments.get(payment.id)).toMatchObject({
      id: payment.id,
      status: "open",
    })
    expect(mollie.operationCount("create_payment")).toBe(2)
  })

  it("persists an OpenProvider write when its response is lost", async () => {
    const openProvider = createOpenProviderMockRouter()
    openProvider.allow("transfer_domain", "search_domains")
    openProvider.loseNextResponse("transfer_domain")

    await expect(openProvider.fetch(
      "https://api.openprovider.test/v1beta/domains/transfer",
      {
        method: "POST",
        body: JSON.stringify({ domain: "example.nl", authCode: "opaque" }),
      },
    )).rejects.toThrow("lost the transfer_domain response")

    expect(openProvider.state.domains.size).toBe(1)
    const listed = await openProvider.fetch(
      "https://api.openprovider.test/v1beta/domains",
    )
    await expect(listed.json()).resolves.toMatchObject({
      data: { results: [{ domain: "example.nl", status: "PENDING" }] },
    })
    expect(openProvider.operationCount("transfer_domain")).toBe(1)
  })

  it("routes real OpenProvider domain PUTs by body and mutates provider state", async () => {
    const openProvider = createOpenProviderMockRouter()
    const domain = {
      id: "9001",
      status: "ACT",
      domain: { name: "example", extension: "nl" },
      autorenew: "off",
      name_servers: [
        { name: "ns1.source.example" },
        { name: "ns2.source.example" },
      ],
      is_dnssec_enabled: false,
      dnssec_keys: [],
    }
    openProvider.state.domains.set(domain.id, domain)
    const options = {
      env: {
        OPENPROVIDER_API_BASE_URL: "https://api.openprovider.test/v1beta",
      } as unknown as NodeJS.ProcessEnv,
      fetchImpl: openProvider.fetch,
      token: "mock-token",
    }

    await expect(setOpenProviderDomainAutorenew("9001", "on", options))
      .rejects.toThrow("OpenProvider domain autorenew update")
    expect(openProvider.state.domains.get("9001")).toMatchObject({ autorenew: "off" })

    openProvider.allow("set_autorenew", "update_nameservers", "set_dnssec")
    await expect(setOpenProviderDomainAutorenew("9001", "on", options))
      .resolves.toMatchObject({ id: "9001", autorenew: "on", status: "ACT" })
    await expect(updateOpenProviderDomainNameservers("9001", [
      { name: "Ada.NS.Cloudflare.com." },
      { name: "bob.ns.cloudflare.com" },
    ], options)).resolves.toMatchObject({ id: "9001", status: "ACT" })
    await expect(updateOpenProviderDomainDnssec("9001", {
      enabled: true,
      keys: [{ flags: 257, protocol: 3, alg: 13, pub_key: "AQID" }],
    }, options)).resolves.toMatchObject({ id: "9001", status: "ACT" })

    expect(openProvider.operationCount("set_autorenew")).toBe(2)
    expect(openProvider.operationCount("update_nameservers")).toBe(1)
    expect(openProvider.operationCount("set_dnssec")).toBe(1)
    expect(openProvider.state.domains.get("9001")).toMatchObject({
      autorenew: "on",
      name_servers: [
        { name: "ada.ns.cloudflare.com" },
        { name: "bob.ns.cloudflare.com" },
      ],
      is_dnssec_enabled: true,
      dnssec_keys: [{ flags: 257, protocol: 3, alg: 13, pub_key: "AQID" }],
    })
  })

  it("requires separate Cloudflare zone and record write opt-ins", async () => {
    const cloudflare = createCloudflareMockRouter()
    cloudflare.allow("create_zone")

    const zoneResponse = await cloudflare.fetch(
      "https://api.cloudflare.test/client/v4/zones",
      { method: "POST", body: JSON.stringify({ name: "example.nl" }) },
    )
    const zoneBody = await zoneResponse.json() as { result: { id: string } }
    const recordUrl =
      `https://api.cloudflare.test/client/v4/zones/${zoneBody.result.id}/dns_records`

    await expect(cloudflare.fetch(recordUrl, {
      method: "POST",
      body: JSON.stringify({ type: "A", name: "example.nl", content: "192.0.2.1" }),
    })).resolves.toMatchObject({ status: 503 })
    expect(cloudflare.state.records.get(zoneBody.result.id)?.size).toBe(0)

    cloudflare.allow("create_record", "list_records")
    await expect(cloudflare.fetch(recordUrl, {
      method: "POST",
      body: JSON.stringify({ type: "A", name: "example.nl", content: "192.0.2.1" }),
    })).resolves.toMatchObject({ status: 200 })
    expect(cloudflare.state.records.get(zoneBody.result.id)?.size).toBe(1)
  })
})
