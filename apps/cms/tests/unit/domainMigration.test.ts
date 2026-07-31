import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const revokeCloudflareSourceAuthorization = vi.hoisted(() =>
  vi.fn(async () => true)
)
const withCommerceOrderLock = vi.hoisted(() =>
  vi.fn(async (
    _payload: unknown,
    _orderId: string | number,
    operation: () => Promise<unknown>,
  ) => operation())
)

vi.mock("@/lib/domains/cloudflareSourceOAuth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/domains/cloudflareSourceOAuth")>(),
  revokeCloudflareSourceAuthorization,
}))

vi.mock("@/lib/commerce/orderLock", () => ({
  withCommerceOrderLock,
}))

import {
  acquireAutomaticMigrationInputs,
  createAutomaticDomainMigration,
  nextTransferConfirmationStatus,
  prepareDomainMigration,
  replaceMigrationSourceRefreshAuthority,
  replaceMigrationTransferAuthorization,
  transferConfirmationStatus,
  transferAutorenewMode,
} from "@/lib/domains/migration"
import {
  CloudflareIndeterminateWriteError,
  type CloudflareDnssecResult,
} from "@/lib/domains/cloudflare"
import {
  OpenProviderAmbiguousCustomerReferenceLookupError,
  OpenProviderAmbiguousDomainLookupError,
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
  sealCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import {
  MigrationSourceChangedError,
  MigrationSourceDnssecTransitionPendingError,
  MigrationTransferEligibilityBlockedError,
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
const TARGET_DNSKEY = {
  flags: 257,
  protocol: 3 as const,
  alg: 13,
  pub_key: "AQID",
}
const TARGET_DS = "12345 13 2 " + "AB".repeat(32)
const activeTargetDnssec = () => ({
  status: "active" as const,
  flags: TARGET_DNSKEY.flags,
  algorithm: TARGET_DNSKEY.alg,
  publicKey: TARGET_DNSKEY.pub_key,
  ds: TARGET_DS,
  dsTtl: 3600,
  raw: {},
})
const disabledTargetDnssec = () => ({
  status: "disabled" as const,
  flags: null,
  algorithm: null,
  publicKey: null,
  ds: null,
  dsTtl: null,
  raw: {},
})

const zoneExport: CompleteZoneExport = {
  schemaVersion: 1,
  format: "siab-complete-zone-v1",
  domain: "example.nl",
  acquiredAt: "2026-07-28T08:00:00.000Z",
  authority: {
    mechanism: "cloudflare_api",
    provider: "cloudflare",
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

const sourceRefreshAuthority = (
  sourceZone: CompleteZoneExport,
  token = "customer-cloudflare-token-value",
) => {
  const normalized = normalizeCompleteZone(sourceZone)
  return {
    schemaVersion: 1 as const,
    domain: "example.nl",
    sourceMechanism: "cloudflare_api_v1" as const,
    acceptedSourceAuthorityHash: domainMigrationSourceAuthorityHash(normalized),
    acceptedSourceContentHash: domainMigrationSourceContentHash(normalized),
    credential: {
      kind: "cloudflare_api_token" as const,
      token,
      zoneId: "a".repeat(32),
    },
  }
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
        schemaVersion: 4,
        transferRenewalEffect: "unchanged",
        migration: {
          classification: "automatic",
          sourceMechanism: "cloudflare_api_v1",
        },
        tldCapability: {
          tld: "nl",
          capabilityVersion: "tld-nl-2026-07-26.1",
          transferRenewalEffect: "unchanged",
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
      providerPaymentId: "tr_paid",
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
  let transactionSnapshot: Record<string, MockDoc[]> | null = null
  let commitResponseLosses = 0
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
  const beginTransaction = vi.fn(async () => {
    if (transactionSnapshot) throw new Error("A test transaction is already active.")
    transactionSnapshot = structuredClone(collections)
    return "migration-publication-transaction"
  })
  const commitTransaction = vi.fn(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    transactionSnapshot = null
    if (commitResponseLosses > 0) {
      commitResponseLosses -= 1
      throw new Error("Injected commit response loss after commit.")
    }
  })
  const rollbackTransaction = vi.fn(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    for (const key of Object.keys(collections)) delete collections[key]
    Object.assign(collections, structuredClone(transactionSnapshot))
    transactionSnapshot = null
  })
  return {
    collections,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      db: {
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        drizzle: {
          execute: vi.fn(async () => ({ rows: [{ id: 1_000 }] })),
        },
        pool: {
          connect: vi.fn(async () => ({
            query: vi.fn(async () => ({ rows: [] })),
            release: vi.fn(),
          })),
        },
      },
      jobs: { queue: vi.fn(async () => ({ id: "queued-job" })) },
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    }),
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    loseNextCommitResponse: () => {
      commitResponseLosses += 1
    },
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
    sourceRefreshAuthority: sourceRefreshAuthority(sourceZone),
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
    registryExpiryDate?: string | null
    autorenew: "on"
    verificationEmailStatus: string
    verificationEmailExpiresAt: string
    verificationEmailDescription: string
    raw: Record<string, never>
  } | null = null
  let targetDsVisible = true
  const records: Array<{ id: string; record: NormalizedMigrationDnsRecord; raw: unknown }> = []
  let recordId = 1
  let currentNow = typeof input?.now === "string"
    ? input.now
    : "2026-07-28T09:00:00.000Z"
  const dependencies = {
    now: () => typeof input?.now === "function" ? input.now() : currentNow,
    refreshAutomaticMigrationSource: vi.fn(async (
      source: { sourceZone: CompleteZoneExport },
    ) => source.sourceZone),
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
    getCloudflareDnssec: vi.fn(async (): Promise<CloudflareDnssecResult> => ({
      status: providerDomain?.dnssecEnabled && targetDsVisible
        ? "active" as const
        : "pending" as const,
      flags: TARGET_DNSKEY.flags,
      algorithm: TARGET_DNSKEY.alg,
      publicKey: TARGET_DNSKEY.pub_key,
      ds: TARGET_DS,
      dsTtl: 3600,
      raw: {},
    })),
    enableCloudflareDnssec: vi.fn(async () => ({
      status: "pending" as const,
      flags: TARGET_DNSKEY.flags,
      algorithm: TARGET_DNSKEY.alg,
      publicKey: TARGET_DNSKEY.pub_key,
      ds: TARGET_DS,
      raw: {},
    })),
    batchCreateCloudflareMigrationDnsRecords: vi.fn(async (
      _zoneId: string,
      nextRecords: readonly NormalizedMigrationDnsRecord[],
    ) => {
      for (const record of nextRecords) {
        records.push({ id: `record-${recordId++}`, record, raw: {} })
      }
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
          ? providerKey?.pub_key === TARGET_DNSKEY.pub_key
            ? targetDsVisible ? [TARGET_DS] : []
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
    publishAndActivateAfterCompletedPayment: vi.fn(async (): Promise<
      | { status: "activated"; snapshotId: string | number | null }
      | { status: "blocked" | "failed"; message: string }
    > => ({
      status: "activated",
      snapshotId: 10,
    })),
    queueDeferredPostPaymentLiveHandoff: vi.fn(async () => "queued" as const),
    ensureTenantPostHogEnrollment: vi.fn(async () => "updated" as const),
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
  vi.clearAllMocks()
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
  it("rejects accepted migration orders using legacy quote evidence", async () => {
    const store = createStore()
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      schemaVersion: 3,
    }

    await expect(createAutomaticDomainMigration(store.payload, 600))
      .rejects.toThrow("current checkout quote evidence schema")
  })

  it("derives transfer-confirmation actions from the frozen TLD capability", async () => {
    const nlStore = createStore()
    await createAutomaticDomainMigration(nlStore.payload, 600)
    expect(nlStore.collections["domain-migrations"]![0]).toMatchObject({
      customerActions: {
        confirm_transfer: {
          status: "not_required",
          evidence: "tld_confirmation_not_required",
        },
      },
    })

    const comCapability = getTldCapabilityByVersion("tld-com-2026-07-29.3")
    if (!comCapability) throw new Error("Missing corrected .com capability fixture.")
    expect(transferConfirmationStatus(comCapability, false)).toBe("pending")
    expect(transferConfirmationStatus(comCapability, true)).toBe("required")
    expect(nextTransferConfirmationStatus(
      "required",
      comCapability,
      true,
    )).toBe("required")
    expect(nextTransferConfirmationStatus(
      "completed",
      comCapability,
      false,
    )).toBe("completed")
  })

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
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: {
        kind: "cloudflare_api_token",
        token: "customer-cloudflare-token-value",
        zoneId: "a".repeat(32),
      },
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
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
      sourceMechanism: "cloudflare_api_v1",
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
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: {
        kind: "cloudflare_api_token",
        token: "customer-cloudflare-token-value",
        zoneId: "a".repeat(32),
      },
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
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

  it("persists a registry wait and sends no provider transfer when a fresh lock appears", async () => {
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
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        refreshAutomaticMigrationSource: vi.fn(async () => {
          throw new MigrationTransferEligibilityBlockedError()
        }),
      }),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no registrar write was sent"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "awaiting_provider",
      failureReason: "registry_transfer_blocked_before_provider_write",
      reconciliationRequired: true,
    })
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
      state: "awaiting_provider",
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
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: zoneExport,
      sourceRefreshCredential: {
        kind: "cloudflare_api_token",
        token: "customer-cloudflare-token-value",
        zoneId: "a".repeat(32),
      },
      transferCode: "opaque-nl-transfer-code",
      transferAuthorizationAccepted: true,
    })
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
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

    const refresh = { refreshAutomaticMigrationSource: vi.fn(async () => zoneExport) }
    await expect(createAutomaticDomainMigration(
      store.payload,
      600,
      now.toISOString(),
      refresh,
    ))
      .rejects.toThrow("simulated secret clearing failure")
    expect(store.collections["domain-migrations"]).toHaveLength(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      sourceZoneSnapshot: expect.any(Object),
    })
    await expect(createAutomaticDomainMigration(
      store.payload,
      600,
      now.toISOString(),
      refresh,
    ))
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

  it("fails before OpenProvider customer preparation when edge readiness fails and preserves per-surface evidence", async () => {
    const store = createStore({ managedDomainEdgeReady: false })
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    const managedDomain = store.collections["managed-domains"]![0]!
    Object.assign(managedDomain, {
      edgeRoutingStatus: "failed",
      httpsStatus: "pending",
      httpsEvidence: {
        apex: { status: "verified" },
        www: { status: "pending", reason: "www_edge_pending" },
      },
      adminHttpsStatus: "pending",
      adminHttpsEvidence: {
        admin: { status: "pending", reason: "admin_edge_pending" },
      },
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "failed" })

    expect(fixture.dependencies.loginOpenProvider).not.toHaveBeenCalled()
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(managedDomain).toMatchObject({
      state: "manual_review",
      failureReason: "automatic_edge_routing_conflict",
      httpsStatus: "pending",
      httpsEvidence: {
        apex: { status: "verified" },
        www: { status: "pending", reason: "www_edge_pending" },
      },
      adminHttpsStatus: "pending",
      adminHttpsEvidence: {
        admin: { status: "pending", reason: "admin_edge_pending" },
      },
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

  it("recovers target signing after a prepared checkpoint without repeating the write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    let signingVisible = false
    fixture.dependencies.getCloudflareDnssec.mockImplementation(async () =>
      signingVisible ? activeTargetDnssec() : disabledTargetDnssec()
    )
    fixture.dependencies.enableCloudflareDnssec.mockImplementationOnce(
      async () => {
        signingVisible = true
        throw new Error("worker stopped after target signing dispatch")
      },
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).rejects.toThrow("worker stopped after target signing dispatch")
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_signing",
      dnssecWriteState: "prepared",
      reconciliationRequired: true,
      verificationDeadlineAt: "2026-07-28T09:30:00.000Z",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.enableCloudflareDnssec).toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "completed",
      dnssecWriteState: "confirmed",
    })
  })

  it("recovers an indeterminate target-signing response through readback without retry", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    let signingVisible = false
    fixture.dependencies.getCloudflareDnssec.mockImplementation(async () =>
      signingVisible ? activeTargetDnssec() : disabledTargetDnssec()
    )
    fixture.dependencies.enableCloudflareDnssec.mockRejectedValueOnce(
      new CloudflareIndeterminateWriteError(
        "Cloudflare target DNSSEC enablement",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_signing",
      dnssecWriteState: "indeterminate",
      reconciliationRequired: true,
    })

    signingVisible = true
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.enableCloudflareDnssec).toHaveBeenCalledTimes(1)
  })

  it("recovers target DS publication after a prepared checkpoint without repeating the write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.updateOpenProviderDomainDnssec.mockImplementationOnce(
      async (_id, input) => {
        const providerDomain = fixture.getProviderDomain()
        if (!providerDomain) throw new Error("provider domain missing")
        providerDomain.dnssecEnabled = input.enabled
        providerDomain.dnssecKeys = input.enabled ? input.keys : []
        throw new Error("worker stopped after target DS dispatch")
      },
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).rejects.toThrow("worker stopped after target DS dispatch")
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_ds_publication",
      dnssecWriteState: "prepared",
      reconciliationRequired: true,
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenCalledTimes(1)
  })

  it("recovers an indeterminate target DS response through readback without retry", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.updateOpenProviderDomainDnssec.mockRejectedValueOnce(
      new OpenProviderIndeterminateWriteError(
        "OpenProvider target DS publication",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_ds_publication",
      dnssecWriteState: "indeterminate",
      reconciliationRequired: true,
    })

    const providerDomain = fixture.getProviderDomain()
    if (!providerDomain) throw new Error("provider domain missing")
    providerDomain.dnssecEnabled = true
    providerDomain.dnssecKeys = [TARGET_DNSKEY]
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenCalledTimes(1)
  })

  it("persists rollback when target DNSSEC remains unverified at the cutover deadline", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.setTargetDsVisible(false)

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "target_chain_verifying",
      dnssecWriteState: "indeterminate",
      verificationDeadlineAt: "2026-07-28T09:30:00.000Z",
    })

    fixture.setNow("2026-07-28T09:30:01.000Z")
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "verifying",
      dnssecPhase: "rollback_target_ds_cache_wait",
      dnssecWriteState: "confirmed",
      rollbackRequestedAt: "2026-07-28T09:30:01.000Z",
      failureReason: "target_dnssec_verification_deadline_exceeded",
      reconciliationRequired: true,
    })
    const dnssecWrites = fixture.dependencies.updateOpenProviderDomainDnssec
      .mock.calls.length
    expect(dnssecWrites).toBe(2)
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.updateOpenProviderDomainDnssec)
      .toHaveBeenCalledTimes(dnssecWrites)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      dnssecPhase: "rollback_target_ds_cache_wait",
      rollbackRequestedAt: "2026-07-28T09:30:01.000Z",
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
      reconciliationRequired: false,
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          state: "failed",
          reason: "dnssec_parent_state_changed_since_source_capture",
        }),
      ]),
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "manual_review",
      entitlementStatus: "blocked",
      failureReason: "dnssec_parent_state_changed_since_source_capture",
    })
    expect(store.collections.orders![0]).toMatchObject({
      state: "exception",
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: String(store.collections["payment-attempts"]![0]!.id),
        scenario: "unfulfillable_before_provider_commit",
      },
    }))
    expect(fixture.dependencies.verifyParentDsAbsent).toHaveBeenCalledOnce()
    expect(fixture.dependencies.verifyDnssecChain).not.toHaveBeenCalled()
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

  it("does not transfer when payment reversal acquires the order lock first", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    withCommerceOrderLock.mockImplementationOnce(async (
      _payload: unknown,
      _orderId: string | number,
      operation: () => Promise<unknown>,
    ) => {
      store.collections["payment-attempts"]![0]!.state = "refunded"
      store.collections.orders![0]!.paymentStatus = "refunded"
      return operation()
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("no provider write was sent"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("continues transfer when a rejected refund leaves captured funds secured", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    store.collections["payment-attempts"]![0]!.state = "refund_failed"
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })

    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .toHaveBeenCalledTimes(1)
  })

  it.each(["refund_pending", "refunded", "chargeback"] as const)(
    "preserves custody and source DNS when payment becomes %s after registrar transfer",
    async (paymentState) => {
      const store = createStore()
      const migration = await preparedMigration(store)
      const fixture = workflowDependencies()
      withCommerceOrderLock.mockImplementationOnce(async (
        _payload: unknown,
        _orderId: string | number,
        operation: () => Promise<unknown>,
      ) => {
        const result = await operation()
        store.collections["payment-attempts"]![0]!.state = paymentState
        store.collections.orders![0]!.paymentStatus = paymentState
        return result
      })

      const result = await prepareDomainMigration(
        store.payload,
        migration.id,
        asMigrationDependencies(fixture.dependencies),
      )

      expect(result).toMatchObject({
        status: "failed",
        message: expect.stringContaining("custody and DNS continuity remain preserved"),
      })
      expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
      expect(fixture.dependencies.updateOpenProviderDomainNameservers).not.toHaveBeenCalled()
      expect(fixture.dependencies.publishAndActivateAfterCompletedPayment).not.toHaveBeenCalled()
      expect(fixture.dependencies.activateManagedDomainEntitlement).not.toHaveBeenCalled()
      expect(store.collections["managed-domains"]![0]).toMatchObject({
        state: "manual_review",
        custodyStatus: "managed",
        entitlementStatus: "blocked",
        customerStatus: "manual_review",
      })
      expect(store.collections["domain-migrations"]![0]).toMatchObject({
        state: "failed",
        failureReason: "payment_authority_revoked_after_registrar_commit",
        encryptedTransferCode: null,
        encryptedSourceRefreshAuthority: null,
      })
      expect(store.collections.orders![0]).toMatchObject({ state: "exception" })
      expect(store.collections["operational-alerts"]).toEqual([
        expect.objectContaining({
          dedupeKey: expect.stringContaining(
            "payment_authority_revoked_after_registrar_commit",
          ),
          severity: "critical",
        }),
      ])
    },
  )

  it("retains uncertain Cloudflare OAuth revocation authority and clears it after confirmed recovery", async () => {
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
    })
    const fixture = workflowDependencies()
    revokeCloudflareSourceAuthorization
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    withCommerceOrderLock.mockImplementationOnce(async (
      _payload: unknown,
      _orderId: string | number,
      operation: () => Promise<unknown>,
    ) => {
        const result = await operation()
        store.collections["payment-attempts"]![0]!.state = "refunded"
        store.collections.orders![0]!.paymentStatus = "refunded"
        return result
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        resolveCloudflareOAuthCredential: vi.fn(async () => ({
          kind: "cloudflare_api_token" as const,
          token: "short-lived-customer-token",
          zoneId: "a".repeat(32),
        })),
        refreshAutomaticMigrationSource: vi.fn(async () => ({
          ...automaticZone,
          acquiredAt: fixture.dependencies.now(),
        })),
      }),
    )).resolves.toMatchObject({ status: "failed" })

    expect(revokeCloudflareSourceAuthorization).toHaveBeenCalledOnce()
    expect(revokeCloudflareSourceAuthorization).toHaveBeenLastCalledWith(
      store.payload,
      expect.objectContaining({
        kind: "cloudflare_oauth",
        authorizationKey: "o".repeat(43),
      }),
      expect.objectContaining({ now: expect.any(Date) }),
    )
    const stored = store.collections["domain-migrations"]![0]!
    expect(stored).toMatchObject({
      state: "failed",
      failureReason: "payment_authority_revoked_after_registrar_commit",
      encryptedTransferCode: null,
      encryptedSourceRefreshAuthority: expect.any(String),
      sourceRefreshAuthorityDeletedAt: null,
      reconciliationRequired: true,
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          reason: "source_authority_revocation_pending",
        }),
      ]),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledOnce()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining(
        "Frozen migration preparation evidence is incomplete",
      ),
    })

    expect(revokeCloudflareSourceAuthorization).toHaveBeenCalledTimes(2)
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledOnce()
    expect(stored).toMatchObject({
      state: "failed",
      failureReason: "payment_authority_revoked_after_registrar_commit",
      encryptedTransferCode: null,
      encryptedSourceRefreshAuthority: null,
      sourceRefreshAuthorityDeletedAt: "2026-07-28T09:00:00.000Z",
      reconciliationRequired: false,
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          reason: "source_authority_revocation_confirmed",
        }),
      ]),
    })
  })

  it("blocks publication without rolling back customer DNS when payment changes after cutover", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.verifyPreservedDnsRecords.mockImplementationOnce(
      async () => {
        store.collections["payment-attempts"]![0]!.state = "refunded"
        store.collections.orders![0]!.paymentStatus = "refunded"
        return {
          status: "verified",
          recursiveEquivalent: true,
          authoritativeEquivalent: true,
          reason: null,
        }
      },
    )

    const result = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )

    expect(result.status).toBe("failed")
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledTimes(1)
    expect(fixture.dependencies.updateOpenProviderDomainNameservers).toHaveBeenCalledTimes(1)
    expect(fixture.getProviderDomain()?.nameServers).toEqual(CLOUDFLARE_NAMESERVERS)
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment).not.toHaveBeenCalled()
    expect(fixture.dependencies.activateManagedDomainEntitlement).not.toHaveBeenCalled()
    expect(store.collections.tenants![0]).toMatchObject({
      status: "preview",
      domain: "preview.siteinabox.test",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "manual_review",
      custodyStatus: "managed",
      entitlementStatus: "blocked",
    })
    expect(store.collections.orders![0]).toMatchObject({ state: "exception" })
  })

  it("rechecks payment after acquiring the publication lock", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    withCommerceOrderLock
      .mockImplementationOnce(async (
        _payload: unknown,
        _orderId: string | number,
        operation: () => Promise<unknown>,
      ) => operation())
      .mockImplementationOnce(async (
        _payload: unknown,
        _orderId: string | number,
        operation: () => Promise<unknown>,
      ) => {
        store.collections["payment-attempts"]![0]!.state = "refunded"
        store.collections.orders![0]!.paymentStatus = "refunded"
        return operation()
      })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("custody and DNS continuity remain preserved"),
    })

    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.activateManagedDomainEntitlement)
      .not.toHaveBeenCalled()
  })

  it("prevalidates the generation run before projecting the target tenant domain", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    store.collections.orders![0]!.generationRun = null
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })

    expect(store.collections.tenants![0]).toMatchObject({
      status: "preview",
      domain: "preview.siteinabox.test",
    })
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.activateManagedDomainEntitlement)
      .not.toHaveBeenCalled()
    expect(store.beginTransaction).not.toHaveBeenCalled()
  })

  it("prevalidates generation-run tenant authority before publication", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    store.collections["site-generation-runs"]![0]!.tenant = 2
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })

    expect(store.collections.tenants![0]).toMatchObject({
      status: "preview",
      domain: "preview.siteinabox.test",
    })
    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.activateManagedDomainEntitlement)
      .not.toHaveBeenCalled()
    expect(store.beginTransaction).not.toHaveBeenCalled()
  })

  it("rolls back tenant and entitlement projection when snapshot activation fails", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.publishAndActivateAfterCompletedPayment
      .mockResolvedValue({
        status: "failed",
        message: "injected activation failure",
      })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })

    expect(store.rollbackTransaction).toHaveBeenCalledOnce()
    expect(store.collections.tenants![0]).toMatchObject({
      status: "preview",
      domain: "preview.siteinabox.test",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      entitlementStatus: "pending",
      customerStatus: "provisioning",
    })
    expect(fixture.dependencies.queueDeferredPostPaymentLiveHandoff)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.ensureTenantPostHogEnrollment)
      .not.toHaveBeenCalled()
  })

  it("defers customer handoff until transactional publication commits", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })

    expect(fixture.dependencies.publishAndActivateAfterCompletedPayment)
      .toHaveBeenCalledWith(
        store.payload,
        expect.objectContaining({ id: 500, tenant: 1 }),
        expect.objectContaining({
          deferLiveHandoff: true,
          req: expect.objectContaining({
            transactionID: "migration-publication-transaction",
          }),
        }),
      )
    expect(fixture.dependencies.queueDeferredPostPaymentLiveHandoff)
      .toHaveBeenCalledWith(
        store.payload,
        expect.objectContaining({ id: 500 }),
        10,
        "2026-07-28T09:00:00.000Z",
      )
    expect(store.commitTransaction.mock.invocationCallOrder[0])
      .toBeLessThan(
        fixture.dependencies.queueDeferredPostPaymentLiveHandoff
          .mock.invocationCallOrder[0] as number,
      )
    expect(store.commitTransaction.mock.invocationCallOrder[0])
      .toBeLessThan(
        fixture.dependencies.ensureTenantPostHogEnrollment
          .mock.invocationCallOrder[0] as number,
      )
    expect(store.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      context: { skipProjection: true },
      req: expect.objectContaining({
        transactionID: "migration-publication-transaction",
      }),
    }))
    expect(store.collections.tenants![0]).toMatchObject({
      domain: "example.nl",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
    expect(store.collections.orders![0]).toMatchObject({ state: "fulfilled" })
  })

  it("never starts provider rollback when the publication commit response is lost", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    store.loseNextCommitResponse()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("commit is indeterminate"),
    })

    expect(store.rollbackTransaction).not.toHaveBeenCalled()
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)
    expect(fixture.dependencies.queueDeferredPostPaymentLiveHandoff)
      .not.toHaveBeenCalled()
    expect(store.collections.tenants![0]).toMatchObject({
      domain: "example.nl",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "active",
      entitlementStatus: "active",
    })
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "migration_publication_commit_indeterminate",
    })
    expect(store.collections.orders![0]).toMatchObject({
      state: "fulfillment_pending",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)
    expect(fixture.dependencies.queueDeferredPostPaymentLiveHandoff)
      .toHaveBeenCalledOnce()
  })

  it("keeps migration and order pending until durable live handoff is queued", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.queueDeferredPostPaymentLiveHandoff
      .mockRejectedValueOnce(new Error("injected queue failure"))
      .mockResolvedValueOnce("queued")

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("handoff remains pending"),
    })

    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "migration_live_handoff_pending",
    })
    expect(store.collections.orders![0]).toMatchObject({
      state: "fulfillment_pending",
    })
    expect(store.collections.tenants![0]).toMatchObject({
      domain: "example.nl",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      state: "active",
      entitlementStatus: "active",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.queueDeferredPostPaymentLiveHandoff)
      .toHaveBeenCalledTimes(2)
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .toHaveBeenCalledTimes(1)
    expect(store.collections.orders![0]).toMatchObject({ state: "fulfilled" })
  })

  it("requires source reauthorization when the current source changes", async () => {
    const store = createStore()
    const order = store.collections.orders![0]!
    order.quoteEvidence = {
      ...(order.quoteEvidence as Record<string, unknown>),
      migration: {
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
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
    fixture.dependencies.refreshAutomaticMigrationSource.mockRejectedValueOnce(
      new MigrationSourceChangedError(),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("must be reauthorized"),
    })
    expect(stored).toMatchObject({
      state: "awaiting_customer",
      sourceZoneSnapshot: expect.any(Object),
      targetZoneSnapshot: expect.any(Object),
      rollbackEvidence: expect.any(Object),
      encryptedTransferCode: expect.any(String),
      failureReason: "source_authority_reauthorization_required",
      customerActions: {
        provide_epp_code: { status: "completed" },
      },
    })
    expect(fixture.dependencies.createOrReuseCloudflareZone).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("returns customer action before Phase 3 when the transfer code expired", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    Object.assign(stored, {
      transferCodeExpiresAt: "2026-07-28T08:30:00.000Z",
    })
    const fixture = workflowDependencies({
      now: "2026-07-28T09:00:00.000Z",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("transfer code expired"),
    })
    expect(stored).toMatchObject({
      state: "awaiting_customer",
      encryptedTransferCode: null,
      transferCodeDeletedAt: "2026-07-28T09:00:00.000Z",
      failureReason: "transfer_code_expired",
      customerActions: {
        provide_epp_code: {
          status: "required",
          evidence: "expired",
        },
      },
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          state: "awaiting_customer",
          reason: "transfer_code_expired",
        }),
      ]),
    })
    expect(fixture.dependencies.listCloudflareZones).not.toHaveBeenCalled()
    expect(fixture.dependencies.loginOpenProvider).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("refreshes durable source authority before provider writes", async () => {
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
    )).resolves.toMatchObject({ status: "completed" })

    expect(fixture.dependencies.refreshAutomaticMigrationSource).toHaveBeenCalled()
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledOnce()
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

  it("preserves recovery evidence across registrar ambiguity and resumes exact reads without a second transfer", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    const retainedSourceAuthority = stored.encryptedSourceRefreshAuthority
    const fixture = workflowDependencies()
    fixture.dependencies.transferOpenProviderDomain.mockRejectedValueOnce(
      new OpenProviderIndeterminateWriteError("OpenProvider domain transfer"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(stored).toMatchObject({
      providerTransferState: "indeterminate",
      encryptedTransferCode: expect.any(String),
    })

    fixture.dependencies.findOpenProviderDomain.mockRejectedValueOnce(
      new OpenProviderAmbiguousDomainLookupError("example.nl"),
    )
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("requires provider reconciliation"),
    })
    expect(stored).toMatchObject({
      state: "awaiting_provider",
      providerTransferState: "indeterminate",
      encryptedTransferCode: expect.any(String),
      encryptedSourceRefreshAuthority: retainedSourceAuthority,
      sourceZoneSnapshot: expect.any(Object),
      targetZoneSnapshot: expect.any(Object),
      rollbackEvidence: expect.any(Object),
      reconciliationRequired: true,
      failureReason: "openprovider_domain_lookup_ambiguous",
    })
    expect(revokeCloudflareSourceAuthorization).not.toHaveBeenCalled()

    fixture.dependencies.findOpenProviderDomain.mockResolvedValue({
      id: 9001,
      domain: "example.nl",
      status: "PENDING",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: null,
      nameServers: OLD_NAMESERVERS,
      dnssecEnabled: false,
      dnssecKeys: [],
      renewalDate: "2027-07-28T00:00:00.000Z",
      registryExpiryDate: null,
      autorenew: "on",
      verificationEmailStatus: "verified",
      verificationEmailExpiresAt: "2026-08-10 12:30:00",
      verificationEmailDescription: "verified",
      raw: {},
    })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("still processing"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).toHaveBeenCalledOnce()
    expect(stored).toMatchObject({
      state: "awaiting_provider",
      providerTransferState: "indeterminate",
      encryptedTransferCode: expect.any(String),
      encryptedSourceRefreshAuthority: retainedSourceAuthority,
      failureReason: null,
    })
    expect(store.collections["operational-alerts"]).toEqual([
      expect.objectContaining({
        dedupeKey: expect.stringContaining(
          "openprovider_domain_lookup_ambiguous",
        ),
        status: "resolved",
      }),
    ])
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

  it("recovers an indeterminate Cloudflare zone creation from an exact read without repeating the write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.listCloudflareZones
      .mockResolvedValueOnce([])
      .mockResolvedValue([{
        id: "zone-1",
        name: "example.nl",
        nameServers: CLOUDFLARE_NAMESERVERS,
        status: "active",
        raw: {},
      }])
    fixture.dependencies.createOrReuseCloudflareZone.mockRejectedValueOnce(
      new CloudflareIndeterminateWriteError("Cloudflare zone creation"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    const recovered = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    expect(recovered).toEqual({
      status: "completed",
      migrationId: migration.id,
      message: "Automatic existing-domain migration completed.",
    })

    expect(fixture.dependencies.createOrReuseCloudflareZone).toHaveBeenCalledOnce()
    expect(fixture.dependencies.batchCreateCloudflareMigrationDnsRecords)
      .toHaveBeenCalledTimes(1)
    expect(fixture.dependencies.batchCreateCloudflareMigrationDnsRecords)
      .toHaveBeenCalledWith("zone-1", expect.any(Array))
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "completed",
      cloudflareZoneId: "zone-1",
      cloudflareZoneState: "confirmed",
    })
  })

  it("stops for manual review when exact Cloudflare zone authority is ambiguous", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.listCloudflareZones.mockResolvedValue([
      {
        id: "zone-1",
        name: "example.nl",
        nameServers: CLOUDFLARE_NAMESERVERS,
        status: "active",
        raw: {},
      },
      {
        id: "zone-2",
        name: "example.nl",
        nameServers: ["cara.ns.cloudflare.com", "dan.ns.cloudflare.com"],
        status: "active",
        raw: {},
      },
    ])

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("Multiple exact Cloudflare zones"),
    })
    expect(fixture.dependencies.createOrReuseCloudflareZone).not.toHaveBeenCalled()
    expect(fixture.dependencies.loginOpenProvider).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "cloudflare_zone_lookup_ambiguous",
      reconciliationRequired: true,
    })
  })

  it("escalates indeterminate Cloudflare DNS creation without repeating records", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.batchCreateCloudflareMigrationDnsRecords.mockRejectedValue(
      new CloudflareIndeterminateWriteError("Cloudflare DNS batch creation"),
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

    expect(fixture.dependencies.batchCreateCloudflareMigrationDnsRecords)
      .toHaveBeenCalledTimes(1)
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      encryptedTransferCode: null,
      failureReason: "cloudflare_dns_outcome_unresolved",
    })
  })

  it("fails closed on unexpected existing Cloudflare records before any DNS or registrar write", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.records.push({
      id: "foreign-record",
      record: {
        type: "A",
        name: "unexpected.example.nl",
        ttl: 300,
        content: "192.0.2.200",
        proxied: false,
      },
      raw: {},
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("unexpected records"),
    })

    expect(fixture.dependencies.batchCreateCloudflareMigrationDnsRecords)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.loginOpenProvider).not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "cloudflare_zone_contains_unexpected_records",
      encryptedTransferCode: null,
      semanticComparison: {
        equivalent: false,
        unexpected: expect.arrayContaining([
          expect.stringContaining("unexpected.example.nl"),
        ]),
      },
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

  it("waits through a crashed customer-create claim lease and retries only after exact absence", async () => {
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
    fixture.dependencies.createOpenProviderCustomerHandle.mockResolvedValue({
      handle: "OWNER-CLIENT",
      raw: {},
    })
    const update = store.payload.update as unknown as ReturnType<typeof vi.fn>
    type ConditionalMigrationUpdateArgs = MockUpdateArgs & {
      where?: MockFindArgs["where"]
    }
    const originalUpdate = update.getMockImplementation() as (
      args: ConditionalMigrationUpdateArgs,
    ) => Promise<unknown>
    let crashAfterClaim = true
    update.mockImplementation(async (args: ConditionalMigrationUpdateArgs) => {
      const result = await originalUpdate(args)
      const history = Array.isArray(args.data.stateHistory)
        ? args.data.stateHistory
        : []
      const lastHistory = history.at(-1) as Record<string, unknown> | undefined
      if (
        crashAfterClaim &&
        args.collection === "domain-migrations" &&
        args.where &&
        lastHistory?.reason === "openprovider_customer_handle_write_prepared"
      ) {
        crashAfterClaim = false
        throw new Error("worker stopped after customer claim")
      }
      return result
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).rejects.toThrow("worker stopped after customer claim")
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      providerTransferState: "prepared",
      reconciliationRequired: true,
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          reason: "openprovider_customer_handle_write_prepared",
        }),
      ]),
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-28T09:02:00.000Z",
      }),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("claim lease"),
    })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies({
        ...fixture.dependencies,
        now: () => "2026-07-28T09:06:00.000Z",
      }),
    )).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.findOpenProviderCustomerByReference)
      .toHaveBeenCalledTimes(3)
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
  })

  it("allows only one concurrent customer-create effect after the optimistic claim", async () => {
    const store = createStore()
    Object.assign(store.collections["checkout-profiles"]![0]!, {
      firstName: "Ada",
      lastName: "Lovelace",
      billingAddress: {
        street: "Main Street",
        number: "10",
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
    const createGate: {
      release?: (value: { handle: string; raw: object }) => void
    } = {}
    let signalCreateStarted: (() => void) | null = null
    const createStarted = new Promise<void>((resolve) => {
      signalCreateStarted = resolve
    })
    fixture.dependencies.createOpenProviderCustomerHandle.mockImplementation(
      () => new Promise((resolve) => {
        createGate.release = resolve
        signalCreateStarted?.()
      }),
    )

    const first = prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    await createStarted
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("claim lease"),
    })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()

    createGate.release?.({ handle: "OWNER-CLIENT", raw: {} })
    await expect(first).resolves.toMatchObject({ status: "completed" })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
  })

  it("does not interpret a registrar prepared checkpoint as customer-create authority", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const stored = store.collections["domain-migrations"]![0]!
    Object.assign(stored, {
      providerCustomerHandle: null,
      providerTransferState: "prepared",
      transferRequestedAt: "2026-07-28T08:50:00.000Z",
      stateHistory: [
        ...(Array.isArray(stored.stateHistory) ? stored.stateHistory : []),
        {
          state: stored.state,
          at: "2026-07-28T08:50:00.000Z",
          reason: "provider_transfer_write_prepared",
        },
      ],
    })
    const fixture = workflowDependencies()
    fixture.dependencies.findOpenProviderCustomerByReference.mockResolvedValue(null)

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("conflicts with a registrar"),
    })

    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(stored).toMatchObject({
      state: "failed",
      failureReason: "openprovider_customer_handle_checkpoint_conflict",
    })
  })

  it("persists deterministic customer-create rejection as terminal manual review without retry", async () => {
    const store = createStore()
    Object.assign(store.collections["checkout-profiles"]![0]!, {
      firstName: "Ada",
      lastName: "Lovelace",
      billingAddress: {
        street: "Main Street",
        number: "10",
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
      new OpenProviderApiError(
        "OpenProvider customer creation",
        422,
        "CUSTOMER_VALIDATION_FAILED",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("full governed refund was queued"),
    })

    const stored = store.collections["domain-migrations"]![0]!
    expect(stored).toMatchObject({
      state: "failed",
      providerTransferState: "not_started",
      reconciliationRequired: false,
      failureReason: "openprovider_customer_handle_write_rejected",
      encryptedTransferCode: null,
      stateHistory: expect.arrayContaining([
        expect.objectContaining({
          reason: "openprovider_customer_handle_write_rejected",
        }),
      ]),
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: String(store.collections["payment-attempts"]![0]!.id),
        scenario: "unfulfillable_before_provider_commit",
      },
      queue: "default",
      overrideAccess: true,
    })
    expect(store.collections.orders![0]).toMatchObject({ state: "exception" })
    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
  })

  it("conservatively checkpoints a local failure after customer claim as indeterminate", async () => {
    const store = createStore()
    Object.assign(store.collections["checkout-profiles"]![0]!, {
      firstName: "Ada",
      lastName: "Lovelace",
      billingAddress: {
        street: "Main Street",
        number: "10",
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
      new Error("local response decoding failed"),
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
      failureReason: "openprovider_customer_handle_local_failure_indeterminate",
    })

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("remains indeterminate"),
    })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
  })

  it("treats a customer-create provider 503 as indeterminate instead of rejected", async () => {
    const store = createStore()
    Object.assign(store.collections["checkout-profiles"]![0]!, {
      firstName: "Ada",
      lastName: "Lovelace",
      billingAddress: {
        street: "Main Street",
        number: "10",
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
      new OpenProviderApiError(
        "OpenProvider customer creation",
        503,
        "PROVIDER_UNAVAILABLE",
      ),
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
      failureReason: "openprovider_customer_handle_indeterminate",
    })
    expect(store.payload.jobs.queue).not.toHaveBeenCalledWith(
      expect.objectContaining({ task: "request-mollie-refund" }),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("remains indeterminate"),
    })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
  })

  it("recovers indeterminate customer creation from one exact reference without repeating the POST", async () => {
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
    fixture.dependencies.findOpenProviderCustomerByReference
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        handle: "OWNER-CLIENT",
        comments: "domain-migration:order:600:v1",
        raw: {},
      })
    fixture.dependencies.createOpenProviderCustomerHandle.mockRejectedValueOnce(
      new OpenProviderIndeterminateWriteError(
        "OpenProvider customer creation",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({ status: "waiting" })
    const customerRecovery = await prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )
    expect(customerRecovery).toEqual({
      status: "completed",
      migrationId: migration.id,
      message: "Automatic existing-domain migration completed.",
    })

    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .toHaveBeenCalledOnce()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      providerCustomerHandle: "OWNER-CLIENT",
      providerTransferState: "confirmed",
    })
    expect(store.collections["managed-domains"]![0]).toMatchObject({
      providerCustomerHandle: "OWNER-CLIENT",
    })
  })

  it("stops for manual review when exact customer-reference authority is ambiguous", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.findOpenProviderCustomerByReference.mockRejectedValue(
      new OpenProviderAmbiguousCustomerReferenceLookupError(
        "domain-migration:order:600:v1",
      ),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("Multiple exact Openprovider customers"),
    })
    expect(fixture.dependencies.createOpenProviderCustomerHandle)
      .not.toHaveBeenCalled()
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "openprovider_customer_reference_ambiguous",
      reconciliationRequired: true,
    })
  })

  it("stops for manual review when exact registrar domain authority is ambiguous", async () => {
    const store = createStore()
    const migration = await preparedMigration(store)
    const fixture = workflowDependencies()
    fixture.dependencies.findOpenProviderDomain.mockRejectedValue(
      new OpenProviderAmbiguousDomainLookupError("example.nl"),
    )

    await expect(prepareDomainMigration(
      store.payload,
      migration.id,
      asMigrationDependencies(fixture.dependencies),
    )).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("Multiple exact Openprovider domains"),
    })
    expect(fixture.dependencies.transferOpenProviderDomain).not.toHaveBeenCalled()
    expect(fixture.dependencies.updateOpenProviderDomainNameservers)
      .not.toHaveBeenCalled()
    expect(store.collections["domain-migrations"]![0]).toMatchObject({
      state: "failed",
      failureReason: "openprovider_domain_lookup_ambiguous",
      reconciliationRequired: true,
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
