import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  acquireAutomaticMigrationInputs,
  createAutomaticDomainMigration,
  prepareDomainMigration,
  replaceMigrationSourceRefreshAuthority,
  replaceMigrationTransferAuthorization,
  transferAutorenewMode,
} from "@/lib/domains/migration"
import { CloudflareIndeterminateWriteError } from "@/lib/domains/cloudflare"
import {
  OpenProviderApiError,
  OpenProviderIndeterminateWriteError,
} from "@/lib/domains/openprovider"
import { prepareDomainMigrationTask } from "@/lib/jobs/prepareDomainMigrationTask"
import type {
  CompleteZoneExport,
  NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import { normalizeCompleteZone } from "@siteinabox/contracts/domain-migration"
import type { ParentDsVerification } from "@/lib/domains/verification"
import {
  domainMigrationSourceAuthorityHash,
  domainMigrationSourceContentHash,
} from "@/lib/domains/migrationEvidence"
import {
  openAutomaticSourceRefreshAuthority,
  openMigrationSecret,
  sealCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import {
  MigrationSourceChangedError,
  MigrationSourceDnssecTransitionPendingError,
} from "@/lib/domains/migrationSources/refresh"
import {
  MigrationSourceRefreshRetryableError,
} from "@/lib/domains/migrationSources/types"
import { dnskeyDsRecord } from "@/lib/domains/migrationSources/dnssecEvidence"
import { getTldCapabilityByVersion } from
  "@siteinabox/contracts/tld-capabilities"
import {
  attachMigrationCheckoutSecret,
  migrationCheckoutSecretKey,
  persistMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"
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

const sourceDnskey = {
  flags: 257,
  protocol: 3 as const,
  algorithm: 13,
  publicKey: "BAUG",
}
const sourceDs = dnskeyDsRecord("example.nl", sourceDnskey, 2)
const sourceDsRecord = [
  sourceDs.keyTag,
  sourceDs.algorithm,
  sourceDs.digestType,
  sourceDs.digest,
].join(" ")
const signedZoneExport: CompleteZoneExport = {
  ...zoneExport,
  dnssec: {
    status: "signed",
    parentDsRecords: [sourceDsRecord],
    parentDsTtl: 3600,
    dnsKeys: [sourceDnskey],
  },
}

const createStore = (options: { managedDomainEdgeReady?: boolean } = {}) => {
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
    "payment-attempts": [{
      id: 700,
      order: 600,
      purpose: "first_payment",
      state: "paid",
      providerPaymentId: "tr_paid",
    }],
    "domain-migrations": [],
    "managed-domains": [],
  }
  let nextId = 1_000
  const find = vi.fn(async ({ collection, where }: MockFindArgs) => {
    const docs = (collections[collection] ?? []).filter((doc) => {
      if (!where) return true
      const matchesWhere = (conditionGroup: Record<string, unknown>): boolean =>
        Object.entries(conditionGroup).every(([field, condition]) => {
          if (field === "and" && Array.isArray(condition)) {
            return condition.every((clause) =>
              matchesWhere(clause as Record<string, unknown>),
            )
          }
          if (!condition || typeof condition !== "object") return true
          const operators = condition as {
            equals?: unknown
            in?: unknown[]
            less_than_equal?: unknown
          }
          if (
            operators.equals !== undefined &&
            String(doc[field]) !== String(operators.equals)
          ) return false
          if (
            operators.in &&
            !operators.in.some((entry) => String(entry) === String(doc[field]))
          ) return false
          if (
            operators.less_than_equal !== undefined &&
            String(doc[field]) > String(operators.less_than_equal)
          ) return false
          return true
        })
      return matchesWhere(where as Record<string, unknown>)
    })
    return { docs, totalDocs: docs.length }
  })
  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    const doc = {
      id: nextId++,
      ...data,
      ...(collection === "managed-domains" && options.managedDomainEdgeReady !== false
        ? {
            edgeRoutingStatus: "active",
            httpsStatus: "verified",
            adminHttpsStatus: "verified",
          }
        : {}),
    }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  const update = vi.fn(async ({
    collection,
    id,
    where,
    data,
  }: MockUpdateArgs & { where?: MockFindArgs["where"] }) => {
    if (where) {
      const docs = (collections[collection] ?? []).filter((doc) => {
        const clauses = Array.isArray(where.and)
          ? where.and
          : Object.entries(where).map(([field, value]) => ({ [field]: value }))
        return clauses.every((clause: unknown) => {
          const [field, condition] = Object.entries(
            clause as Record<string, unknown>,
          )[0] ?? []
          if (!field || !condition || typeof condition !== "object") return true
          const operators = condition as {
            equals?: unknown
            less_than_equal?: unknown
          }
          if (
            operators.equals !== undefined &&
            String(doc[field]) !== String(operators.equals)
          ) return false
          if (
            operators.less_than_equal !== undefined &&
            String(doc[field]) > String(operators.less_than_equal)
          ) return false
          return true
        })
      })
      for (const doc of docs) Object.assign(doc, data)
      return { docs, totalDocs: docs.length }
    }
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
      db: {
        drizzle: {
          execute: vi.fn(async () => ({ rows: [{ id: 1_000 }] })),
        },
      },
      jobs: { queue: vi.fn() },
    }),
  }
}

const preparedMigration = async (
  store: ReturnType<typeof createStore>,
  sourceZone: CompleteZoneExport = zoneExport,
) => {
  const migration = await createAutomaticDomainMigration(store.payload, 600)
  const prepared = await acquireAutomaticMigrationInputs(store.payload, {
    migrationId: migration.id,
    zoneExport: sourceZone,
    transferCode: "opaque-nl-transfer-code",
    env: {
      DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
      CLOUDFLARE_RENDERER_TUNNEL_ID: "11111111-1111-4111-8111-111111111111",
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
  now?: string | (() => string)
  authoritativeStatus?: "verified" | "pending"
  preservedStatus?: "verified" | "pending"
  rollbackAuthoritativeStatus?: "verified" | "pending"
  rollbackPreservedStatus?: "verified" | "pending"
  verificationStatus?: string
  providerStatus?: string
  sourceParentDsRecords?: string[]
}) => {
  let providerDomain: {
    id: number
    domain: string
    status: string
    ownerHandle: string
    adminHandle: null
    nameServers: string[]
    dnssecEnabled: boolean | null
    dnssecKeys: Array<{
      flags: number
      protocol: 3
      alg: number
      pub_key: string
    }>
    renewalDate: string
    autorenew: "on"
    verificationEmailStatus: string
    verificationEmailExpiresAt: string
    verificationEmailDescription: string
    raw: Record<string, never>
  } | null = null
  const targetDnskey = {
    flags: 257,
    protocol: 3 as const,
    alg: 13,
    pub_key: "AQID",
  }
  const targetDs = "12345 13 2 " + "AB".repeat(32)
  let targetDsVisible = true
  const records: Array<{ id: string; record: NormalizedMigrationDnsRecord; raw: unknown }> = []
  let recordId = 1
  let currentNow = typeof input?.now === "string"
    ? input.now
    : "2026-07-28T09:00:00.000Z"
  const dependencies = {
    now: () => typeof input?.now === "function" ? input.now() : currentNow,
    forwardProviderWritesAllowed: vi.fn(() => true),
    transferContractEvidenceAllowed: vi.fn(() => true),
    loginOpenProvider: vi.fn(async () => "token"),
    findOpenProviderCustomerByReference: vi.fn(async (): Promise<{
      handle: string
      comments: string
      raw: Record<string, never>
    } | null> => ({
      handle: "OWNER-CLIENT",
      comments: "domain-migration:order:600:v1",
      raw: {},
    })),
    createOpenProviderCustomerHandle: vi.fn(),
    findOpenProviderDomain: vi.fn(async () => providerDomain),
    transferOpenProviderDomain: vi.fn(async (
      domain: string,
      options: {
        nameServers: Array<{ name: string }>
        dnssecKeys?: Array<{
          flags: number
          protocol: 3
          alg: number
          pub_key: string
        }>
      },
    ) => {
      providerDomain = {
        id: 9001,
        domain,
        status: input?.providerStatus ?? "ACT",
        ownerHandle: "OWNER-CLIENT",
        adminHandle: null,
        nameServers: options.nameServers.map((entry) => entry.name),
        dnssecEnabled: Boolean(options.dnssecKeys?.length),
        dnssecKeys: options.dnssecKeys ?? [],
        renewalDate: "2027-07-28T00:00:00.000Z",
        autorenew: "on",
        verificationEmailStatus: input?.verificationStatus ?? "verified",
        verificationEmailExpiresAt: "2026-08-10 12:30:00",
        verificationEmailDescription: input?.verificationStatus ?? "verified",
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
    updateOpenProviderDomainDnssec: vi.fn(async (
      id: string | number,
      input: {
        enabled: boolean
        keys: Array<{
          flags: number
          protocol: 3
          alg: number
          pub_key: string
        }>
      },
    ) => {
      if (!providerDomain) throw new Error("provider domain missing")
      providerDomain.dnssecEnabled = input.enabled
      providerDomain.dnssecKeys = input.enabled ? input.keys : []
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
    getCloudflareDnsRecordUsage: vi.fn(async () => ({
      recordQuota: 200,
      recordUsage: records.length,
    })),
    getCloudflareDnssec: vi.fn(async () => ({
      status: providerDomain?.dnssecEnabled && targetDsVisible
        ? "active" as const
        : "pending" as const,
      flags: targetDnskey.flags,
      algorithm: targetDnskey.alg,
      publicKey: targetDnskey.pub_key,
      ds: targetDs,
      raw: {},
    })),
    enableCloudflareDnssec: vi.fn(async () => ({
      status: "pending" as const,
      flags: targetDnskey.flags,
      algorithm: targetDnskey.alg,
      publicKey: targetDnskey.pub_key,
      ds: targetDs,
      raw: {},
    })),
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
    verifyParentDsAbsent: vi.fn(async (): Promise<ParentDsVerification> => {
      const providerKey = providerDomain?.dnssecKeys[0]
      const parentRecords = providerDomain == null
        ? input?.sourceParentDsRecords ?? []
        : providerDomain.dnssecEnabled
          ? providerKey?.pub_key === targetDnskey.pub_key
            ? targetDsVisible ? [targetDs] : []
            : input?.sourceParentDsRecords ?? []
          : []
      return parentRecords.length > 0
        ? {
            status: "present" as const,
            records: parentRecords,
            ttl: 3600,
            reason: "parent_ds_present",
          }
        : {
            status: "absent" as const,
            records: [],
            reason: null,
          }
    }),
    verifyDnssecChain: vi.fn(async () => ({
      status: targetDsVisible ? "verified" as const : "pending" as const,
      authenticatedData: targetDsVisible,
      dnskeyMatched: true,
      rrsigPresent: true,
      parentDsMatched: targetDsVisible,
      parentDsTtl: 3600,
      reason: targetDsVisible ? null : "dnssec_chain_not_authenticated",
    })),
    verifyAuthoritativeDns: vi.fn(async (
      _domain: string,
      expectedNameServers: string[],
    ) => {
      const rollback = expectedNameServers.every((entry) =>
        OLD_NAMESERVERS.includes(entry)
      )
      const status = rollback
        ? input?.rollbackAuthoritativeStatus ?? "verified"
        : input?.authoritativeStatus ?? "verified"
      return {
      status,
      delegatedNameServers: expectedNameServers,
      respondingNameServers: status === "pending"
        ? []
        : expectedNameServers,
      reason: status === "pending" ? "delegation_mismatch" : null,
    }}),
    verifyPreservedDnsRecords: vi.fn(async (
      _records: NormalizedMigrationDnsRecord[],
      expectedNameServers: string[],
    ) => {
      const rollback = expectedNameServers.every((entry) =>
        OLD_NAMESERVERS.includes(entry)
      )
      const status = rollback
        ? input?.rollbackPreservedStatus ?? "verified"
        : input?.preservedStatus ?? "verified"
      return {
      status,
      recursiveEquivalent: status !== "pending",
      authoritativeEquivalent: status !== "pending",
      reason: status === "pending"
        ? "recursive_preserved_record_mismatch"
        : null,
    }}),
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
  return {
    dependencies,
    getProviderDomain: () => providerDomain,
    records,
    setNow: (value: string) => {
      currentNow = value
    },
    setTargetDsVisible: (value: boolean) => {
      targetDsVisible = value
    },
    setProviderStatus: (value: string) => {
      if (!providerDomain) throw new Error("Provider domain is not initialized.")
      providerDomain.status = value
    },
  }
}

const asMigrationDependencies = (
  value: unknown,
): Parameters<typeof prepareDomainMigration>[2] =>
  value as Parameters<typeof prepareDomainMigration>[2]

beforeEach(() => {
  vi.stubEnv("DOMAIN_MIGRATION_ENCRYPTION_KEY", ENCRYPTION_KEY)
  vi.stubEnv(
    "CLOUDFLARE_RENDERER_TUNNEL_ID",
    "11111111-1111-4111-8111-111111111111",
  )
  vi.stubEnv(
    "CLOUDFLARE_CMS_TUNNEL_ID",
    "22222222-2222-4222-8222-222222222222",
  )
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

  it("refreshes a current automatic source before persisting or writing providers", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...zoneExport,
      authority: {
        mechanism: "validated_provider_export",
        provider: "legacy-dns",
        complete: true,
      },
    }
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(automaticZone),
    )
    const secretKey = migrationCheckoutSecretKey(
      500,
      "example.nl",
      sourceZoneHash,
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "validated_provider_export_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: {
        kind: "provider_export",
        sourceSoaSerial: 2026072901,
      },
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "validated_provider_export_v1",
        sourceZoneHash,
        checkoutSecretKey: secretKey,
      },
    }
    const now = new Date("2026-07-28T08:00:00.000Z")
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now,
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 600,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now,
    })
    const refresh = vi.fn(async () => automaticZone)

    await expect(createAutomaticDomainMigration(
      store.payload,
      600,
      now.toISOString(),
      { refreshAutomaticMigrationSource: refresh },
    )).resolves.toMatchObject({
      sourceMechanism: "validated_provider_export_v1",
      sourceZoneSnapshot: expect.any(Object),
      state: "ready_to_prepare",
    })
    expect(refresh).toHaveBeenCalledOnce()
    expect(store.collections["migration-checkout-secrets"]![0]).toMatchObject({
      state: "consumed",
      encryptedInput: null,
    })
  })

  it("turns a changed paid source into resumable reauthorization before provider writes", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...zoneExport,
      authority: {
        mechanism: "validated_provider_export",
        provider: "legacy-dns",
        complete: true,
      },
    }
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(automaticZone),
    )
    const secretKey = migrationCheckoutSecretKey(
      500,
      "example.nl",
      sourceZoneHash,
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "validated_provider_export_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: {
        kind: "provider_export",
        sourceSoaSerial: 2026072901,
      },
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "validated_provider_export_v1",
        sourceZoneHash,
        checkoutSecretKey: secretKey,
      },
    }
    const now = new Date("2026-07-28T08:00:00.000Z")
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now,
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 600,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now,
    })

    await expect(createAutomaticDomainMigration(
      store.payload,
      600,
      now.toISOString(),
      {
        refreshAutomaticMigrationSource: vi.fn(async () => {
          throw new MigrationSourceChangedError()
        }),
      },
    )).resolves.toMatchObject({
      state: "awaiting_customer",
      failureReason: "source_evidence_stale",
    })
    expect(store.collections["domain-migrations"]![0])
      .not.toHaveProperty("sourceZoneSnapshot")
    expect(store.collections["migration-checkout-secrets"]![0]).toMatchObject({
      state: "expired",
      encryptedInput: null,
    })
    expect(store.payload.jobs.queue).not.toHaveBeenCalled()
  })

  it("retains only refresh authority and completes after a six-day provider wait", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...zoneExport,
      authority: {
        mechanism: "cloudflare_api",
        provider: "cloudflare",
        complete: true,
      },
    }
    const normalized = normalizeCompleteZone(automaticZone)
    const sourceAuthorityHash = domainMigrationSourceAuthorityHash(normalized)
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
        sourceZoneHash: sourceAuthorityHash,
      },
    }
    const migration = await createAutomaticDomainMigration(store.payload, 600)
    await acquireAutomaticMigrationInputs(store.payload, {
      migrationId: migration.id,
      zoneExport: automaticZone,
      transferCode: "opaque-nl-transfer-code",
      sourceRefreshAuthority: {
        schemaVersion: 1,
        domain: "example.nl",
        sourceMechanism: "cloudflare_api_v1",
        acceptedSourceAuthorityHash: sourceAuthorityHash,
        acceptedSourceContentHash: domainMigrationSourceContentHash(normalized),
        credential: {
          kind: "cloudflare_api_token",
          token: "customer-scoped-cloudflare-token",
          zoneId: "a".repeat(32),
        },
      },
      now: "2026-07-28T08:00:00.000Z",
      env: {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
        CLOUDFLARE_RENDERER_TUNNEL_ID:
          "11111111-1111-4111-8111-111111111111",
      } as unknown as NodeJS.ProcessEnv,
    })
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      providerStatus: "PENDING",
    })
    const refresh = vi.fn(async () => ({
      ...automaticZone,
      acquiredAt: fixture.dependencies.now(),
    }))
    const dependencies = {
      ...fixture.dependencies,
      refreshAutomaticMigrationSource: refresh,
    }

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)

    fixture.setNow("2026-08-03T09:00:00.000Z")
    fixture.setProviderStatus("ACT")
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(dependencies),
    )).resolves.toMatchObject({ status: "completed" })

    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "completed",
      encryptedTransferCode: null,
      encryptedSourceRefreshAuthority: null,
      sourceRefreshAuthorityDeletedAt: expect.any(String),
    })
    expect(JSON.stringify(store.collections["domain-migrations"]![0]))
      .not.toContain("customer-scoped-cloudflare-token")
  })

  it("waits without revoking authority while another OAuth refresh owns the claim", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...zoneExport,
      authority: {
        mechanism: "cloudflare_api",
        provider: "cloudflare",
        complete: true,
      },
    }
    const normalized = normalizeCompleteZone(automaticZone)
    const sourceAuthorityHash = domainMigrationSourceAuthorityHash(normalized)
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
        sourceZoneHash: sourceAuthorityHash,
      },
    }
    const migration = await createAutomaticDomainMigration(store.payload, 600)
    await acquireAutomaticMigrationInputs(store.payload, {
      migrationId: migration.id,
      zoneExport: automaticZone,
      transferCode: "opaque-nl-transfer-code",
      sourceRefreshAuthority: {
        schemaVersion: 1,
        domain: "example.nl",
        sourceMechanism: "cloudflare_api_v1",
        acceptedSourceAuthorityHash: sourceAuthorityHash,
        acceptedSourceContentHash: domainMigrationSourceContentHash(normalized),
        credential: {
          kind: "cloudflare_oauth",
          authorizationKey: "o".repeat(43),
          zoneId: "a".repeat(32),
        },
      },
      now: "2026-07-28T08:00:00.000Z",
      env: {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
        CLOUDFLARE_RENDERER_TUNNEL_ID:
          "11111111-1111-4111-8111-111111111111",
      } as unknown as NodeJS.ProcessEnv,
    })
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
    })
    const resolve = vi.fn(async () => {
      throw new MigrationSourceRefreshRetryableError(
        "Cloudflare OAuth refresh is already in progress.",
      )
    })
    const refresh = vi.fn()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        resolveCloudflareOAuthCredential: resolve,
        refreshAutomaticMigrationSource: refresh,
      }),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("refresh is temporarily pending"),
    })
    expect(resolve).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "preparing",
      failureReason: null,
      encryptedSourceRefreshAuthority: expect.any(String),
    })
  })

  it("atomically accepts only one replacement source authority", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...zoneExport,
      authority: {
        mechanism: "cloudflare_api",
        provider: "cloudflare",
        complete: true,
      },
    }
    const normalized = normalizeCompleteZone(automaticZone)
    const sourceAuthorityHash = domainMigrationSourceAuthorityHash(normalized)
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
        sourceZoneHash: sourceAuthorityHash,
      },
    }
    const created = await createAutomaticDomainMigration(store.payload, 600)
    await acquireAutomaticMigrationInputs(store.payload, {
      migrationId: created.id,
      zoneExport: automaticZone,
      transferCode: "opaque-nl-transfer-code",
      sourceRefreshAuthority: {
        schemaVersion: 1,
        domain: "example.nl",
        sourceMechanism: "cloudflare_api_v1",
        acceptedSourceAuthorityHash: sourceAuthorityHash,
        acceptedSourceContentHash: domainMigrationSourceContentHash(normalized),
        credential: {
          kind: "cloudflare_api_token",
          token: "initial-customer-cloudflare-token",
          zoneId: "a".repeat(32),
        },
      },
      now: "2026-07-28T08:00:00.000Z",
      env: {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
        CLOUDFLARE_RENDERER_TUNNEL_ID:
          "11111111-1111-4111-8111-111111111111",
      } as unknown as NodeJS.ProcessEnv,
    })
    const migration = store.collections["domain-migrations"]![0]!
    Object.assign(migration, {
      state: "awaiting_customer",
      failureReason: "source_authority_reauthorization_required",
      providerTransferState: "confirmed",
      updatedAt: "2026-08-03T09:00:00.000Z",
    })
    vi.mocked(store.payload.jobs.queue).mockClear()
    store.payload.db.drizzle.execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: migration.id }] })
      .mockResolvedValueOnce({ rows: [] }) as never
    const replacement = (token: string) =>
      replaceMigrationSourceRefreshAuthority(store.payload, {
        migrationId: migration.id!,
        expectedUpdatedAt: "2026-08-03T09:00:00.000Z",
        acquiredSource: {
          mechanism: "cloudflare_api_v1",
          zone: automaticZone,
          refreshCredential: {
            kind: "cloudflare_api_token",
            token,
            zoneId: "a".repeat(32),
          },
        },
        now: "2026-08-03T09:01:00.000Z",
        env: {
          DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
        } as unknown as NodeJS.ProcessEnv,
      })

    const results = await Promise.allSettled([
      replacement("winning-customer-cloudflare-token"),
      replacement("losing-customer-cloudflare-token"),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    const persisted = store.collections["domain-migrations"]![0]!
    expect(openAutomaticSourceRefreshAuthority(
      String(persisted.encryptedSourceRefreshAuthority),
      String(persisted.idempotencyKey),
      "example.nl",
      {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
      } as unknown as NodeJS.ProcessEnv,
    )).toMatchObject({
      credential: {
        token: "winning-customer-cloudflare-token",
      },
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledTimes(1)
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

  it("clears retained checkout ciphertext on retry after acquisition already succeeded", async () => {
    const store = createStore()
    const now = new Date("2026-07-28T09:00:00.000Z")
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zoneExport),
    )
    const secretKey = migrationCheckoutSecretKey(
      500,
      "example.nl",
      sourceZoneHash,
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 1,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "customer_authorized_provider_export_v1",
      sourceZoneHash,
      sourceZone: zoneExport,
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "customer_authorized_provider_export_v1",
        sourceZoneHash,
        checkoutSecretKey: secretKey,
      },
    }
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now,
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 600,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now,
    })
    const update = store.payload.update as unknown as ReturnType<typeof vi.fn>
    const originalUpdate = update.getMockImplementation() as (
      args: MockUpdateArgs,
    ) => Promise<unknown>
    let failConsumption = true
    update.mockImplementation(async (args: MockUpdateArgs) => {
      if (
        failConsumption &&
        args.collection === "migration-checkout-secrets" &&
        args.data.state === "consumed"
      ) {
        failConsumption = false
        throw new Error("simulated secret clearing failure")
      }
      return originalUpdate(args)
    })

    await expect(createAutomaticDomainMigration(store.payload, 600, now.toISOString()))
      .rejects.toThrow("simulated secret clearing failure")
    expect(store.collections["domain-migrations"]).toHaveLength(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      sourceZoneSnapshot: expect.any(Object),
    })
    await expect(createAutomaticDomainMigration(store.payload, 600, now.toISOString()))
      .resolves.toMatchObject({ sourceZoneSnapshot: expect.any(Object) })
    expect(store.collections["migration-checkout-secrets"]![0]).toMatchObject({
      state: "consumed",
      encryptedInput: null,
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
        autorenew: "on",
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

  it("keeps provider autorenew off when transfer is enabled but renewal is not", () => {
    const legacy = getTldCapabilityByVersion("tld-nl-2026-07-26.1")
    if (!legacy) throw new Error("Expected the governed historical .nl contract.")
    expect(transferAutorenewMode({
      ...legacy,
      production: {
        ...legacy.production,
        incomingTransfer: true,
        renewal: false,
      },
    })).toBe("off")
  })

  it("waits for automatic edge readiness before transfer and resumes from a preview tenant", async () => {
    const store = createStore({ managedDomainEdgeReady: false })
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    expect(store.collections.tenants![0]).toMatchObject({
      status: "preview",
      domain: "preview.siteinabox.test",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()

    const managedDomain = store.collections["managed-domains"]![0]!
    Object.assign(managedDomain, {
      edgeRoutingStatus: "active",
      httpsStatus: "verified",
      adminHttpsStatus: "verified",
    })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections.tenants![0]).toMatchObject({
      domain: "example.nl",
    })
  })

  it("alerts after the governed transfer wait window without repeating the registrar write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      providerStatus: "PENDING",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)

    fixture.setNow("2026-07-29T09:00:01.000Z")
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("still processing"),
    })

    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_provider",
      failureReason: "provider_transfer_sla_exceeded",
      reconciliationRequired: true,
    })
    expect(store.collections["operational-alerts"]?.at(-1)).toMatchObject({
      severity: "error",
      dedupeKey: expect.stringContaining("provider_transfer_sla_exceeded"),
    })

    fixture.setProviderStatus("ACT")
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toBeDefined()

    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections["operational-alerts"]?.find((alert) =>
      String(alert.dedupeKey).includes("provider_transfer_sla_exceeded")
    )).toMatchObject({
      status: "resolved",
      dedupeKey: expect.stringContaining("provider_transfer_sla_exceeded"),
    })
  })

  it("automates a signed source through safe DS rollover before publication", async () => {
    const store = createStore()
    const migration = await preparedMigration(store, signedZoneExport)
    const fixture = workflowDependencies({
      sourceParentDsRecords: [sourceDsRecord],
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })

    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledWith(
      "example.nl",
      expect.objectContaining({
        nameServers: OLD_NAMESERVERS.map((name) => ({ name })),
        dnssecKeys: [{
          flags: sourceDnskey.flags,
          protocol: sourceDnskey.protocol,
          alg: sourceDnskey.algorithm,
          pub_key: sourceDnskey.publicKey,
        }],
      }),
    )
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenNthCalledWith(
        1,
        9001,
        { enabled: false, keys: [] },
        { token: "token" },
      )
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      dnssecPhase: "source_ds_cache_wait",
      dnssecSafeAfter: "2026-07-28T10:00:00.000Z",
    })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .not.toHaveBeenCalled()

    fixture.setNow("2026-07-28T10:00:01.000Z")
    const completion = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    expect(completion).toMatchObject({ status: "completed" })

    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenNthCalledWith(
        2,
        9001,
        {
          enabled: true,
          keys: [{
            flags: 257,
            protocol: 3,
            alg: 13,
            pub_key: "AQID",
          }],
        },
        { token: "token" },
      )
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "completed",
      dnssecPhase: "target_secure",
      dnssecWriteState: "confirmed",
      dnssecVerification: {
        verified: true,
      },
    })
  })

  it("refreshes signed AXFR authority after a long parent-DS cache wait", async () => {
    const store = createStore()
    const automaticZone: CompleteZoneExport = {
      ...signedZoneExport,
      authority: {
        mechanism: "authorized_axfr",
        provider: "axfr:ns1.legacy.example",
        complete: true,
      },
    }
    const normalized = normalizeCompleteZone(automaticZone)
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "authorized_axfr_v1",
        sourceZoneHash: domainMigrationSourceAuthorityHash(normalized),
      },
    }
    const migration = await createAutomaticDomainMigration(store.payload, 600)
    const prepared = await acquireAutomaticMigrationInputs(store.payload, {
      migrationId: migration.id,
      zoneExport: automaticZone,
      transferCode: "opaque-nl-transfer-code",
      sourceRefreshAuthority: {
        schemaVersion: 1,
        domain: "example.nl",
        sourceMechanism: "authorized_axfr_v1",
        acceptedSourceAuthorityHash:
          domainMigrationSourceAuthorityHash(normalized),
        acceptedSourceContentHash:
          domainMigrationSourceContentHash(normalized),
        credential: {
          kind: "authorized_axfr",
          nameserver: "ns1.legacy.example",
          tsigName: "siteinabox-key",
          tsigSecret: "dGVzdC1hdXRob3JpdHktc2VjcmV0",
        },
      },
      env: {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
        CLOUDFLARE_RENDERER_TUNNEL_ID:
          "11111111-1111-4111-8111-111111111111",
      } as unknown as NodeJS.ProcessEnv,
      now: "2026-07-28T08:00:00.000Z",
    })
    const fixture = workflowDependencies({
      sourceParentDsRecords: [sourceDsRecord],
    })
    const refreshedAfterDsRemoval: CompleteZoneExport = {
      ...automaticZone,
      acquiredAt: "2026-08-03T10:00:01.000Z",
      dnssec: {
        ...automaticZone.dnssec,
        status: "unsigned",
        parentDsRecords: [],
        parentDsTtl: null,
      },
    }
    let sourceCaptureStillSeesParentDs = false
    const refresh = vi.fn(async (
      _input: unknown,
      _dependencies: unknown,
      mode?: string,
    ) => {
      if (
        mode === "stable_content_after_dnssec_transition" &&
        sourceCaptureStillSeesParentDs
      ) {
        throw new MigrationSourceDnssecTransitionPendingError()
      }
      return mode === "stable_content_after_dnssec_transition"
        ? refreshedAfterDsRemoval
        : automaticZone
    })
    const dependencies = {
      ...fixture.dependencies,
      refreshAutomaticMigrationSource: refresh,
    }

    await expect(prepareDomainMigration(
      store.payload,
      prepared.id,
      asMigrationDependencies(dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      dnssecPhase: "source_ds_cache_wait",
    })

    fixture.setNow("2026-08-03T10:00:01.000Z")
    sourceCaptureStillSeesParentDs = true
    await expect(prepareDomainMigration(
      store.payload,
      prepared.id,
      asMigrationDependencies(dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      encryptedSourceRefreshAuthority: expect.any(String),
      dnssecPhase: "source_ds_cache_wait",
    })

    sourceCaptureStillSeesParentDs = false
    await expect(prepareDomainMigration(
      store.payload,
      prepared.id,
      asMigrationDependencies(dependencies),
    )).resolves.toMatchObject({ status: "completed" })

    expect(refresh).toHaveBeenCalledWith(
      expect.any(Object),
      {},
      "stable_content_after_dnssec_transition",
    )
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "completed",
      encryptedSourceRefreshAuthority: null,
      failureReason: null,
    })
  })

  it("removes and waits out target DS before restoring a signed source", async () => {
    const store = createStore()
    const migration = await preparedMigration(store, signedZoneExport)
    const fixture = workflowDependencies({
      sourceParentDsRecords: [sourceDsRecord],
    })

    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    fixture.setNow("2026-07-28T10:00:01.000Z")
    fixture.setTargetDsVisible(false)
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_chain_verifying",
    })

    Object.assign(store.collections["domain-migrations"]![0]!, {
      rollbackRequestedAt: "2026-07-28T10:00:01.000Z",
      failureReason: "operator_requested_rollback",
    })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      dnssecPhase: "rollback_target_ds_cache_wait",
      dnssecSafeAfter: "2026-08-04T10:00:01.000Z",
    })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)

    fixture.setNow("2026-08-04T10:00:02.000Z")
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      dnssecPhase: "rollback_source_ds_publication",
      dnssecVerification: {
        rollbackSourceDnssecRestored: false,
      },
    })
    const nameserverWrites = fixture.dependencies.updateOpenProviderDomainNameservers.mock.calls.length
    const dnssecWrites = fixture.dependencies.updateOpenProviderDomainDnssec.mock.calls.length

    fixture.dependencies.verifyDnssecChain.mockResolvedValueOnce({
      status: "verified",
      authenticatedData: true,
      dnskeyMatched: true,
      rrsigPresent: true,
      parentDsMatched: true,
      parentDsTtl: 3600,
      reason: null,
    })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(nameserverWrites)
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenCalledTimes(dnssecWrites)
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenLastCalledWith(
        9001,
        OLD_NAMESERVERS.map((name) => ({ name })),
      )
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenLastCalledWith(
        9001,
        {
          enabled: true,
          keys: [{
            flags: sourceDnskey.flags,
            protocol: sourceDnskey.protocol,
            alg: sourceDnskey.algorithm,
            pub_key: sourceDnskey.publicKey,
          }],
        },
      )
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "rolled_back",
      dnssecVerification: {
        rollbackSourceDnssecRestored: true,
      },
    })
  })

  it("fails closed when parent DNSSEC state changes after accepted source capture", async () => {
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

    expect(result).toMatchObject({ status: "failed" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "dnssec_parent_state_changed_since_source_capture",
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "request-mollie-refund",
    }))
    expect(fixture.dependencies.listCloudflareZones).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
  })

  it.each(["refunded", "chargeback"] as const)(
    "does not transfer after the captured payment becomes %s",
    async (paymentState) => {
      const store = createStore()
      const migration = await preparedMigration(store)
      store.collections["payment-attempts"]![0]!.state = paymentState
      const fixture = workflowDependencies()

      await expect(prepareDomainMigration(
        store.payload,
        migration.id,
        asMigrationDependencies(fixture.dependencies),
      )).resolves.toMatchObject({
        status: "failed",
        message: expect.stringContaining("no provider write was sent"),
      })
      expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
      expect(store.collections["domain-migrations"]![0]).toMatchObject({
        state: "failed",
        failureReason: "payment_authority_revoked_before_registrar_commit",
        encryptedTransferCode: null,
      })
    },
  )

  it("requires fresh source evidence before the first provider write", async () => {
    const store = createStore()
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "customer_authorized_provider_export_v1",
        sourceZoneHash: domainMigrationSourceAuthorityHash(
          normalizeCompleteZone(zoneExport),
        ),
      },
    }
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    Object.assign(stored.sourceZoneSnapshot as Record<string, unknown>, {
      acquiredAt: "2026-07-26T08:00:00.000Z",
    })
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("source evidence is stale"),
    })
    expect(stored).toMatchObject({
      state: "awaiting_customer",
      sourceZoneSnapshot: null,
      targetZoneSnapshot: null,
      rollbackEvidence: null,
      encryptedTransferCode: null,
      failureReason: "source_evidence_stale",
      customerActions: {
        upload_complete_zone: { status: "required" },
        provide_epp_code: { status: "required" },
      },
    })
    expect(fixture.dependencies.createOrReuseCloudflareZone).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()

    const freshZone = {
      ...zoneExport,
      acquiredAt: "2026-07-28T09:00:00.000Z",
    }
    await expect(acquireAutomaticMigrationInputs(store.payload, {
      migrationId: migration.id,
      zoneExport: {
        ...freshZone,
        records: freshZone.records.map((record, index) =>
          index === 0 && record.type === "A"
            ? { ...record, content: "192.0.2.99" }
            : record),
      },
      transferCode: "replacement-epp-code",
      now: "2026-07-28T09:00:00.000Z",
      expectedUpdatedAt: String(stored.updatedAt),
    })).rejects.toThrow("invalid_input")
    await expect(acquireAutomaticMigrationInputs(store.payload, {
      migrationId: migration.id,
      zoneExport: freshZone,
      transferCode: "replacement-epp-code",
      now: "2026-07-28T09:00:00.000Z",
      expectedUpdatedAt: String(stored.updatedAt),
    })).resolves.toMatchObject({
      state: "ready_to_prepare",
      encryptedTransferCode: expect.any(String),
      failureReason: null,
    })
  })

  it("stops before every new provider write when previously prepared source evidence expires", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    Object.assign(stored.sourceZoneSnapshot as Record<string, unknown>, {
      acquiredAt: "2026-07-26T08:00:00.000Z",
    })
    Object.assign(stored, {
      cloudflareZoneId: "zone-1",
      cloudflareZoneState: "confirmed",
      providerCustomerHandle: "OWNER-CLIENT",
      providerTransferState: "not_started",
    })
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("source evidence expired"),
    })

    expect(fixture.dependencies.createOrReuseCloudflareZone).not.toHaveBeenCalled()
    expect(fixture.dependencies.createOrReuseCloudflareMigrationDnsRecord)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(stored).toMatchObject({
      state: "failed",
      failureReason: "source_evidence_stale_before_provider_write",
      reconciliationRequired: true,
    })
  })

  it("queues a full refund before registrar transfer when destination DNS capacity is insufficient", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.getCloudflareDnsRecordUsage.mockResolvedValue({
      recordQuota: 200,
      recordUsage: 199,
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("refund"),
    })

    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.payload.jobs.queue).toHaveBeenCalledWith({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: "700",
        scenario: "unfulfillable_before_provider_commit",
      },
      queue: "default",
      overrideAccess: true,
    })
    expect(store.collections.orders?.[0]).toMatchObject({ state: "exception" })
    expect(store.collections["domain-migrations"]?.[0]).toMatchObject({
      state: "failed",
      failureReason: "cloudflare_dns_capacity_insufficient",
      encryptedTransferCode: null,
    })
  })

  it("atomically rejects a second stale-source replacement from another tab", async () => {
    const store = createStore()
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "customer_authorized_provider_export_v1",
        sourceZoneHash: domainMigrationSourceAuthorityHash(
          normalizeCompleteZone(zoneExport),
        ),
      },
    }
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    Object.assign(stored.sourceZoneSnapshot as Record<string, unknown>, {
      acquiredAt: "2026-07-26T08:00:00.000Z",
    })
    const fixture = workflowDependencies()
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const expectedUpdatedAt = String(stored.updatedAt)
    const execute = store.payload.db.drizzle.execute as unknown as ReturnType<
      typeof vi.fn
    >
    execute.mockReset()
      .mockResolvedValueOnce({ rows: [{ id: migration.id }] })
      .mockResolvedValueOnce({ rows: [] })
    const freshZone = {
      ...zoneExport,
      acquiredAt: "2026-07-28T09:00:00.000Z",
    }
    const transferCodes = ["first-tab-code", "second-tab-code"]

    const results = await Promise.allSettled(transferCodes.map((transferCode) =>
      acquireAutomaticMigrationInputs(store.payload, {
        migrationId: migration.id,
        zoneExport: freshZone,
        transferCode,
        expectedUpdatedAt,
        now: "2026-07-28T09:00:00.000Z",
      })))

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    const winnerIndex = results.findIndex((result) => result.status === "fulfilled")
    const ciphertext = String(stored.encryptedTransferCode)
    expect(openMigrationSecret(
      ciphertext,
      String(stored.idempotencyKey),
      {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
      } as unknown as NodeJS.ProcessEnv,
    )).toBe(transferCodes[winnerIndex])
  })

  it("keeps incoming transfer fail-closed without complete TLD DNSSEC evidence", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)

    await expect(prepareDomainMigration(store.payload, migration.id, {
      now: () => "2026-07-28T09:00:00.000Z",
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining(
        "DNSSEC and cutover contract evidence is complete",
      ),
    })
  })

  it("keeps suspended registrant verification reconcilable and recovers after verification", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({ verificationStatus: "suspended" })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_provider",
      reconciliationRequired: true,
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      registrantVerificationStatus: "suspended",
      registrantVerificationDueAt: "2026-08-10T12:30:00.000Z",
      reconciliationRequired: true,
    })

    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.verificationEmailStatus = "verified"
    providerDomain.verificationEmailDescription = "verified"

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      registrantVerificationStatus: "recovered",
      reconciliationRequired: false,
    })
  })

  it("rolls back after cutover when registrant verification regresses", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({ authoritativeStatus: "pending" })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
    })

    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.verificationEmailStatus = "suspended"
    providerDomain.verificationEmailDescription = "suspended"
    providerDomain.verificationEmailExpiresAt = "0000-00-00 00:00:00"

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "rolled_back",
      reconciliationRequired: false,
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      registrantVerificationStatus: "suspended",
      registrantVerificationDueAt: "2026-08-10T12:30:00.000Z",
    })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenLastCalledWith(
        9001,
        OLD_NAMESERVERS.map((name) => ({ name })),
      )
  })

  it("rolls back immediately when registrant verification regresses after cutover", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({ authoritativeStatus: "pending" })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      cutoverWriteState: "confirmed",
    })

    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.verificationEmailStatus = "suspended"
    providerDomain.verificationEmailDescription = "suspended"

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(providerDomain.nameServers).toEqual(OLD_NAMESERVERS)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "rolled_back",
      rollbackWriteState: "confirmed",
    })
  })

  it("rolls back when registrant verification returns to pending after cutover", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({ authoritativeStatus: "pending" })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      cutoverWriteState: "confirmed",
    })

    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.verificationEmailStatus = "pending"
    providerDomain.verificationEmailDescription = "pending"

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(providerDomain.nameServers).toEqual(OLD_NAMESERVERS)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "rolled_back",
      rollbackWriteState: "confirmed",
    })
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

  it("keeps rollback open until old authoritative and preserved DNS verify", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
      rollbackAuthoritativeStatus: "pending",
      rollbackPreservedStatus: "pending",
    })

    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const result = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-28T10:00:00.000Z",
      }),
    )

    expect(result).toMatchObject({
      status: "waiting",
      message: expect.stringContaining("DNS verification is pending"),
    })
    expect(fixture.getProviderDomain()?.nameServers).toEqual(OLD_NAMESERVERS)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      rollbackWriteState: "indeterminate",
      reconciliationRequired: true,
    })
    expect(store.collections.orders![0]).not.toMatchObject({ state: "exception" })
  })

  it("escalates a transferred domain whose registrant differs from the accepted customer", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({ verificationStatus: "pending" })

    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.ownerHandle = "WRONG-OWNER"

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("ownership differs"),
    })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "provider_domain_owner_mismatch",
      reconciliationRequired: true,
    })
    expect(store.collections["operational-alerts"]?.at(-1)).toMatchObject({
      severity: "critical",
      dedupeKey: expect.stringContaining("provider_domain_owner_mismatch"),
    })
  })

  it("reconciles a prepared cutover under shadow mode without sending a new forward write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
    })
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected the transferred provider domain.")
    providerDomain.nameServers = [...OLD_NAMESERVERS]
    Object.assign(store.collections["domain-migrations"]![0]!, {
      state: "cutover_in_progress",
      cutoverWriteState: "prepared",
      rollbackWriteState: "not_started",
    })
    fixture.dependencies.updateOpenProviderDomainNameservers.mockClear()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        forwardProviderWritesAllowed: () => false,
      }),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("awaits reconciliation"),
    })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .not.toHaveBeenCalled()
  })

  it("recovers a crashed prepared cutover claim with one idempotent nameserver PUT", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
    })
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    providerDomain.nameServers = [...OLD_NAMESERVERS]
    Object.assign(store.collections["domain-migrations"]![0]!, {
      state: "cutover_in_progress",
      cutoverWriteState: "prepared",
      cutoverRequestedAt: "2026-07-28T08:00:00.000Z",
      rollbackWriteState: "not_started",
    })
    fixture.dependencies.updateOpenProviderDomainNameservers.mockClear()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)
    expect(providerDomain.nameServers).toEqual(CLOUDFLARE_NAMESERVERS)
  })

  it("executes one queued operator rollback nameserver PUT", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
    })
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("Expected a transferred provider domain.")
    Object.assign(store.collections["domain-migrations"]![0]!, {
      rollbackWriteState: "not_started",
      rollbackRequestedAt: "2026-07-28T09:01:00.000Z",
      failureReason: "operator_detected_dns_mismatch",
    })
    fixture.dependencies.updateOpenProviderDomainNameservers.mockClear()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)
    expect(providerDomain.nameServers).toEqual(OLD_NAMESERVERS)
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

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-29T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("reconciliation window"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      encryptedTransferCode: null,
      failureReason: "provider_transfer_outcome_unresolved",
    })
  })

  it("rolls back an indeterminate cutover after its safety deadline", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
    })
    fixture.dependencies.updateOpenProviderDomainNameservers.mockRejectedValueOnce(
      new OpenProviderIndeterminateWriteError(
        "OpenProvider domain nameserver update",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "cutover_in_progress",
      cutoverWriteState: "indeterminate",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-28T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(2)
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenLastCalledWith(
        9001,
        OLD_NAMESERVERS.map((name) => ({ name })),
      )
  })

  it("escalates indeterminate Cloudflare zone creation without repeating the write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.listCloudflareZones.mockResolvedValue([])
    fixture.dependencies.createOrReuseCloudflareZone.mockRejectedValue(
      new CloudflareIndeterminateWriteError("Cloudflare zone creation"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-29T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "failed" })

    expect(fixture.dependencies.createOrReuseCloudflareZone).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "cloudflare_zone_outcome_unresolved",
    })
  })

  it("escalates indeterminate Cloudflare DNS creation without repeating records", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.createOrReuseCloudflareMigrationDnsRecord.mockRejectedValue(
      new CloudflareIndeterminateWriteError("Cloudflare DNS record creation"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-29T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "failed" })

    expect(fixture.dependencies.createOrReuseCloudflareMigrationDnsRecord)
      .toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "cloudflare_dns_outcome_unresolved",
    })
  })

  it("escalates indeterminate customer-handle creation without repeating the POST", async () => {
    const store = createStore()
    Object.assign(store.collections["checkout-profiles"]![0]!, {
      firstName: "Ada",
      lastName: "Lovelace",
      billingAddress: {
        street: "Main Street",
        number: "10",
        suffix: null,
        zipcode: "1011AB",
        city: "Amsterdam",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "20",
        phoneSubscriberNumber: "1234567",
      },
    })
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.findOpenProviderCustomerByReference.mockResolvedValue(null)
    fixture.dependencies.createOpenProviderCustomerHandle.mockRejectedValue(
      new OpenProviderIndeterminateWriteError(
        "OpenProvider customer creation",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-29T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "failed" })

    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "openprovider_customer_handle_outcome_unresolved",
    })
  })

  it("escalates an indeterminate rollback after its critical reconciliation window", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      authoritativeStatus: "pending",
    })
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    Object.assign(store.collections["domain-migrations"]![0]!, {
      rollbackWriteState: "indeterminate",
      rollbackRequestedAt: "2026-07-28T08:00:00.000Z",
      failureReason: "rollback_provider_outcome_unresolved",
    })
    fixture.dependencies.updateOpenProviderDomainNameservers.mockClear()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-29T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("manual reconciliation"),
    })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "rollback_provider_outcome_unresolved",
    })
  })

  it("deletes a rejected transfer code and waits for customer correction", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.transferOpenProviderDomain.mockRejectedValue(
      new OpenProviderApiError(
        "OpenProvider domain transfer",
        400,
        "DOMAIN_AUTH_CODE_INVALID",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("rejected"),
    })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_customer",
      providerTransferState: "not_started",
      encryptedTransferCode: null,
      failureReason: "provider_rejected_transfer_authorization",
      customerActions: {
        provide_epp_code: { status: "failed" },
      },
    })
    await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)

    const rejected = store.collections["domain-migrations"]![0]!
    await expect(replaceMigrationTransferAuthorization(store.payload, {
      migrationId: migration.id,
      expectedUpdatedAt: String(rejected.updatedAt),
      transferCode: "replacement-epp-code",
      env: {
        DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
      } as unknown as NodeJS.ProcessEnv,
      now: "2026-07-28T09:10:00.000Z",
    })).resolves.toMatchObject({
      state: "ready_to_prepare",
      providerTransferState: "not_started",
      encryptedTransferCode: expect.any(String),
      failureReason: null,
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith({
      task: "prepare-domain-migration",
      input: { migrationId: String(migration.id) },
      queue: "default",
      overrideAccess: true,
    })
  })

  it("does not blame the customer or delete the code for an unrelated provider 4xx", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.transferOpenProviderDomain.mockRejectedValue(
      new OpenProviderApiError(
        "OpenProvider domain transfer",
        409,
        "DOMAIN_CONFLICT",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("operator review"),
    })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "openprovider_transfer_rejected_non_authorization",
      encryptedTransferCode: null,
      transferCodeDeletedAt: expect.any(String),
    })
  })

  it("escalates a crashed prepared transfer claim without repeating the POST", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    Object.assign(store.collections["domain-migrations"]![0]!, {
      state: "preparing",
      cloudflareZoneId: "zone-1",
      cloudflareZoneState: "confirmed",
      providerCustomerHandle: "OWNER-CLIENT",
      providerTransferState: "prepared",
      transferRequestedAt: "2026-07-28T08:00:00.000Z",
    })
    const fixture = workflowDependencies({ now: "2026-07-28T09:00:00.000Z" })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("must not be repeated"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "provider_transfer_dispatch_unknown",
    })
    expect(store.collections["operational-alerts"]).toEqual([
      expect.objectContaining({
        severity: "critical",
        status: "open",
      }),
    ])
  })

  it("blocks publication and rolls back when live preserved DNS differs", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
      preservedStatus: "pending",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-28T10:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "rolled_back" })
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()
  })

  it("does not resubmit a transfer and escalates when provider reads lag past the reconciliation window", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.transferOpenProviderDomain.mockResolvedValue({
      id: 9001,
      domain: "example.nl",
      status: "transferred",
      raw: {},
    })
    fixture.dependencies.findOpenProviderDomain.mockResolvedValue(null)

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      providerTransferState: "prepared",
      providerTransferId: "9001",
      reconciliationRequired: true,
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-31T09:00:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "failed" })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      providerTransferState: "prepared",
      encryptedTransferCode: null,
      reconciliationRequired: true,
    })
    expect(store.collections["operational-alerts"]).toEqual([
      expect.objectContaining({
        severity: "critical",
        dedupeKey: expect.stringContaining("provider_transfer_outcome_unresolved"),
      }),
    ])
  })
})
