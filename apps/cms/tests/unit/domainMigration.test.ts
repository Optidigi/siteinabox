import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  acquireAutomaticMigrationInputs,
  createAutomaticDomainMigration,
  prepareDomainMigration,
} from "@/lib/domains/migration"
import { OpenProviderIndeterminateWriteError } from "@/lib/domains/openprovider"
import { prepareDomainMigrationTask } from "@/lib/jobs/prepareDomainMigrationTask"
import type {
  CompleteZoneExport,
  NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import type { ParentDsVerification } from "@/lib/domains/verification"
import { asPayload, type MockDoc, type MockFindArgs, type MockUpdateArgs } from "../_helpers/mockPayload"

const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64")
const OLD_NAMESERVERS = ["ns1.legacy.example", "ns2.legacy.example"]
const CLOUDFLARE_NAMESERVERS = ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"]

const zoneExport: CompleteZoneExport = {
  schemaVersion: 1,
  format: "siab-complete-zone-v1",
  domain: "example.nl",
  acquiredAt: "2026-07-28T08:00:00.000Z",
  authority: {
    mechanism: "customer_authorized_provider_export",
    provider: "legacy-dns",
    complete: true,
  },
  authoritativeNameservers: OLD_NAMESERVERS,
  dnssec: { status: "unsigned", parentDsRecords: [] },
  records: [
    { type: "A", name: "example.nl", ttl: 300, content: "192.0.2.10" },
    { type: "CNAME", name: "www.example.nl", ttl: 300, content: "example.nl" },
    { type: "MX", name: "example.nl", ttl: 3600, priority: 10, target: "mail.example.net" },
    { type: "TXT", name: "example.nl", ttl: 3600, content: "v=spf1 include:_spf.example.net ~all" },
    { type: "TXT", name: "_dmarc.example.nl", ttl: 3600, content: "v=DMARC1; p=reject" },
    { type: "CNAME", name: "selector._domainkey.example.nl", ttl: 3600, content: "dkim.example.net" },
    { type: "CAA", name: "example.nl", ttl: 3600, flags: 0, tag: "issue", value: "letsencrypt.org" },
    {
      type: "SRV",
      name: "_sip._tcp.example.nl",
      ttl: 3600,
      priority: 10,
      weight: 20,
      port: 5060,
      target: "sip.example.net",
    },
    { type: "NS", name: "shop.example.nl", ttl: 3600, content: "ns1.shop-host.example" },
  ],
}

const createStore = () => {
  const collections: Record<string, MockDoc[]> = {
    orders: [{
      id: 600,
      orderNumber: "SIAB-MIGRATION-600",
      tenant: 1,
      generationRun: 500,
      state: "fulfillment_pending",
      checkoutProfileKey: "profile-500-v1",
      quoteEvidence: {
        migration: {
          classification: "automatic",
          sourceMechanism: "customer_authorized_provider_export_v1",
        },
        tldCapability: {
          tld: "nl",
          capabilityVersion: "tld-nl-2026-07-26.1",
        },
      },
      customerName: "Ada Lovelace",
      customerEmail: "client@example.com",
      companyName: "Acme Studio",
      billingAddress: { country: "NL" },
      packageCode: "siteinabox-annual",
      billingPeriod: "annual",
      renewalTerms: "Renews annually.",
      lineItems: [],
      currency: "EUR",
      subtotalNet: 190,
      vatAmount: 39.9,
      totalGross: 229.9,
      domain: "example.nl",
      domainRegistrant: { email: "client@example.com" },
      legalDocuments: [10, 11],
      paymentStatus: "paid",
      paymentProvider: "mollie",
      createdAt: "2026-07-28T07:00:00.000Z",
    }],
    "checkout-profiles": [{
      id: 800,
      profileKey: "profile-500-v1",
      generationRun: 500,
      tenant: 1,
      profileVersion: 1,
      partyType: "registered_business",
      contractingPartyName: "Acme Studio",
      intendedCompanyName: null,
      kvkNumber: "12345678",
      customerName: "Ada Lovelace",
      customerEmail: "client@example.com",
      billingAddress: {
        street: "Main Street",
        number: "10",
        zipcode: "1011AB",
        city: "Amsterdam",
        country: "NL",
      },
      registrantContact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "client@example.com",
        phoneCountryCode: "+31",
        phoneAreaCode: "20",
        phoneSubscriberNumber: "1234567",
        locale: "nl_NL",
      },
      domainRegistrantSource: "contracting_party",
      capturedAt: "2026-07-28T07:00:00.000Z",
    }],
    tenants: [{
      id: 1,
      name: "Acme",
      slug: "acme",
      status: "preview",
      domain: "preview.siteinabox.test",
      domainVerification: { status: "not_checked" },
    }],
    "site-generation-runs": [{
      id: 500,
      tenant: 1,
      status: "preview_ready",
      payment: {
        status: "completed",
        externalReference: "tr_paid",
        selectedDomain: "example.nl",
      },
    }],
    "domain-migrations": [],
    "managed-domains": [],
  }
  let nextId = 1_000
  const find = vi.fn(async ({ collection, where }: MockFindArgs) => {
    const docs = (collections[collection] ?? []).filter((doc) => {
      if (!where) return true
      return Object.entries(where).every(([field, condition]) => {
        if (!condition || typeof condition !== "object" || !("equals" in condition)) return true
        return String(doc[field]) === String((condition as { equals: unknown }).equals)
      })
    })
    return { docs, totalDocs: docs.length }
  })
  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    const doc = { id: nextId++, ...data }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  return {
    collections,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      jobs: { queue: vi.fn() },
    }),
  }
}

const preparedMigration = async (store: ReturnType<typeof createStore>) => {
  const migration = await createAutomaticDomainMigration(store.payload, 600)
  const prepared = await acquireAutomaticMigrationInputs(store.payload, {
    migrationId: migration.id,
    zoneExport,
    transferCode: "opaque-nl-transfer-code",
    env: {
      DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
      SIAB_RENDERER_TARGET_HOST: "renderer.siteinabox.nl",
    } as unknown as NodeJS.ProcessEnv,
    now: "2026-07-28T08:00:00.000Z",
  })
  expect(store.payload.jobs.queue).toHaveBeenCalledWith({
    task: "prepare-domain-migration",
    input: { migrationId: String(migration.id) },
    queue: "default",
    overrideAccess: true,
  })
  return prepared
}

const workflowDependencies = (input?: {
  now?: string
  authoritativeStatus?: "verified" | "pending"
}) => {
  let providerDomain: {
    id: number
    domain: string
    status: string
    ownerHandle: string
    adminHandle: null
    nameServers: string[]
    renewalDate: string
    autorenew: "on"
    verificationEmailStatus: string
    verificationEmailDescription: string
    raw: Record<string, never>
  } | null = null
  const records: Array<{ id: string; record: NormalizedMigrationDnsRecord; raw: unknown }> = []
  let recordId = 1
  const dependencies = {
    now: () => input?.now ?? "2026-07-28T09:00:00.000Z",
    loginOpenProvider: vi.fn(async () => "token"),
    findOpenProviderCustomerByReference: vi.fn(async () => ({
      handle: "OWNER-CLIENT",
      comments: "domain-migration:order:600:v1",
      raw: {},
    })),
    createOpenProviderCustomerHandle: vi.fn(),
    findOpenProviderDomain: vi.fn(async () => providerDomain),
    transferOpenProviderDomain: vi.fn(async (
      domain: string,
      options: { nameServers: Array<{ name: string }> },
    ) => {
      providerDomain = {
        id: 9001,
        domain,
        status: "ACT",
        ownerHandle: "OWNER-CLIENT",
        adminHandle: null,
        nameServers: options.nameServers.map((entry) => entry.name),
        renewalDate: "2027-07-28T00:00:00.000Z",
        autorenew: "on",
        verificationEmailStatus: "verified",
        verificationEmailDescription: "verified",
        raw: {},
      }
      return { id: 9001, domain, status: "transferred" as const, raw: {} }
    }),
    updateOpenProviderDomainNameservers: vi.fn(async (
      id: string | number,
      nameservers: Array<{ name: string }>,
    ) => {
      if (!providerDomain) throw new Error("provider domain missing")
      providerDomain.nameServers = nameservers.map((entry) => entry.name)
      return { id, status: "ACT", raw: {} }
    }),
    listCloudflareZones: vi.fn(async () => [{
      id: "zone-1",
      name: "example.nl",
      nameServers: CLOUDFLARE_NAMESERVERS,
      status: "active" as const,
      raw: {},
    }]),
    createOrReuseCloudflareZone: vi.fn(),
    listCloudflareMigrationDnsRecords: vi.fn(async () => records),
    createOrReuseCloudflareMigrationDnsRecord: vi.fn(async (
      _zoneId: string,
      record: NormalizedMigrationDnsRecord,
    ) => {
      const result = { id: `record-${recordId++}`, record, raw: {} }
      records.push(result)
      return result
    }),
    getCloudflareSslVerification: vi.fn(async () => ({
      status: "active" as const,
      providerStatuses: ["active"],
      raw: {},
    })),
    verifyParentDsAbsent: vi.fn(async (): Promise<ParentDsVerification> => ({
      status: "absent" as const,
      records: [],
      reason: null,
    })),
    verifyAuthoritativeDns: vi.fn(async () => ({
      status: input?.authoritativeStatus ?? "verified",
      delegatedNameServers: CLOUDFLARE_NAMESERVERS,
      respondingNameServers: input?.authoritativeStatus === "pending"
        ? []
        : CLOUDFLARE_NAMESERVERS,
      reason: input?.authoritativeStatus === "pending" ? "delegation_mismatch" : null,
    })),
    verifyHttpsEndpoint: vi.fn(async () => ({
      status: "verified" as const,
      httpStatus: 404,
      reason: null,
    })),
    publishAndActivateAfterCompletedPayment: vi.fn(async () => ({
      status: "activated" as const,
      snapshotId: 10,
    })),
    activateManagedDomainEntitlement: vi.fn(async (
      payload: ReturnType<typeof createStore>["payload"],
      domain: MockDoc,
      now: string,
    ) => payload.update({
      collection: "managed-domains",
      id: domain.id as number,
      data: {
        state: "active",
        entitlementStatus: "active",
        entitlementActivatedAt: now,
        customerStatus: "active",
      },
      overrideAccess: true,
      context: { managedDomainLifecycleMutation: true },
    })),
  }
  return { dependencies, getProviderDomain: () => providerDomain, records }
}

const asMigrationDependencies = (
  value: unknown,
): Parameters<typeof prepareDomainMigration>[2] =>
  value as Parameters<typeof prepareDomainMigration>[2]

beforeEach(() => {
  vi.stubEnv("DOMAIN_MIGRATION_ENCRYPTION_KEY", ENCRYPTION_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("automatic existing-domain migration", () => {
  it("reuses the order-keyed migration authority across duplicate fulfillment calls", async () => {
    const store = createStore()

    const first = await createAutomaticDomainMigration(store.payload, 600)
    const second = await createAutomaticDomainMigration(store.payload, 600)

    expect(second.id).toBe(first.id)
    expect(store.collections["domain-migrations"]).toHaveLength(1)
  })

  it("preserves an accepted assisted-standard classification in the migration authority", async () => {
    const store = createStore()
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "assisted_standard",
        sourceMechanism: "customer_authorized_provider_export_v1",
      },
    }

    await expect(createAutomaticDomainMigration(store.payload, 600)).resolves.toMatchObject({
      acceptedClassification: "assisted_standard",
      operatorWorkAuthorizationState: "not_required",
    })
  })

  it("coalesces duplicate workers on the single migration authority", () => {
    const concurrency = prepareDomainMigrationTask.concurrency as unknown as {
      exclusive: boolean
      supersedes: boolean
      key: (args: { input: { migrationId: string } }) => string
    }
    expect(concurrency).toMatchObject({ exclusive: true, supersedes: true })
    expect(concurrency.key({
      input: { migrationId: "1000" },
    })).toBe("prepare-domain-migration:1000")
  })

  it("preserves service records, transfers on old nameservers, cuts over and deletes the code", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()

    const result = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )

    expect(result.status).toBe("completed")
    const storedMigration = store.collections["domain-migrations"]![0]!
    expect(storedMigration).toMatchObject({
      state: "completed",
      providerTransferState: "confirmed",
      cloudflareZoneState: "confirmed",
      cutoverWriteState: "confirmed",
      encryptedTransferCode: null,
      reconciliationRequired: false,
    })
    expect(storedMigration.transferCodeDeletedAt).toBeTruthy()
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledWith(
      "example.nl",
      expect.objectContaining({
        nameServers: OLD_NAMESERVERS.map((name) => ({ name })),
      }),
    )
    expect(fixture.getProviderDomain()?.nameServers).toEqual(CLOUDFLARE_NAMESERVERS)
    expect(fixture.records.map((entry) => entry.record)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "MX", target: "mail.example.net" }),
      expect.objectContaining({ type: "TXT", name: "_dmarc.example.nl" }),
      expect.objectContaining({ type: "CNAME", name: "selector._domainkey.example.nl" }),
      expect.objectContaining({ type: "CAA", value: "letsencrypt.org" }),
      expect.objectContaining({ type: "SRV", target: "sip.example.net" }),
      expect.objectContaining({ type: "NS", name: "shop.example.nl" }),
    ]))
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "active",
      initialOperation: "transfer",
      entitlementStatus: "active",
    })
    expect(store.collections.orders![0]).toMatchObject({ state: "fulfilled" })
    expect(store.collections.tenants![0]).toMatchObject({
      domain: "example.nl",
      domainVerification: { status: "verified" },
    })
  })

  it("waits for customer DS removal before any provider write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.verifyParentDsAbsent.mockResolvedValue({
      status: "present",
      records: ["12345 13 2 ABCD"],
      reason: "parent_ds_present",
    })

    const result = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )

    expect(result).toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_customer",
      customerActions: {
        remove_dnssec_ds: { status: "required" },
      },
    })
    expect(fixture.dependencies.listCloudflareZones).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("automatically restores frozen old nameservers after the verification deadline", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const first = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(first.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(first.getProviderDomain()?.nameServers).toEqual(CLOUDFLARE_NAMESERVERS)

    const secondDependencies = {
      ...first.dependencies,
      now: () => "2026-07-28T10:00:00.000Z",
    }
    const result = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(secondDependencies),
    )

    expect(result.status).toBe("rolled_back")
    expect(first.getProviderDomain()?.nameServers).toEqual(OLD_NAMESERVERS)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "rolled_back",
      rollbackWriteState: "confirmed",
      encryptedTransferCode: null,
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "manual_review",
      entitlementStatus: "blocked",
    })
    expect(store.collections.orders![0]).toMatchObject({ state: "exception" })
  })

  it("reconciles an indeterminate transfer and never sends a duplicate transfer", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.transferOpenProviderDomain.mockRejectedValue(
      new OpenProviderIndeterminateWriteError("OpenProvider domain transfer"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_provider",
      providerTransferState: "indeterminate",
      reconciliationRequired: true,
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
  })
})
