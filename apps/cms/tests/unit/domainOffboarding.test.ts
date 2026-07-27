import { describe, expect, it, vi } from "vitest"

import {
  captureDomainOffboardingContinuityEvidence,
  confirmDomainTransferCompletedByCustomer,
  markDomainTransferOutStarted,
  prepareDomainTransferOutCode,
  reconcileDomainTransferOut,
  requestDomainOffboarding,
  revealDomainTransferOutCode,
} from "@/lib/domains/offboarding"
import {
  openMigrationSecret,
  sealMigrationSecret,
} from "@/lib/domains/migrationSecrets"
import {
  asPayload,
  type MockDoc,
  type MockUpdateArgs,
} from "../_helpers/mockPayload"

const ENCRYPTION_ENV = {
  DOMAIN_MIGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString("base64"),
} as unknown as NodeJS.ProcessEnv
const ACTOR = {
  email: "customer@example.com",
  tenantId: 1,
}
const EVIDENCE = {
  schemaVersion: 1 as const,
  domain: "example.nl",
  capturedAt: "2026-07-28T10:00:00.000Z",
  authoritativeNameservers: [
    "ada.ns.cloudflare.com",
    "bob.ns.cloudflare.com",
  ],
  dnssecStatus: "signed" as const,
  zoneSnapshotHash: "a".repeat(64),
  mailRecordSetHash: "b".repeat(64),
  serviceRecordSetHash: "c".repeat(64),
  preservationMode: "retain_existing_dns_and_mail" as const,
}

const createStore = () => {
  const domain: MockDoc = {
    id: 10,
    domainNameAscii: "example.nl",
    tld: "nl",
    originatingOrder: 20,
    registrantProfile: 30,
    tenant: 1,
    state: "active",
    custodyStatus: "managed",
    provider: "openprovider",
    providerDomainId: "9001",
    cloudflareZoneId: "zone-1",
    cloudflareNameservers: [
      "ada.ns.cloudflare.com",
      "bob.ns.cloudflare.com",
    ],
    cloudflareDnsRecordIds: ["mail", "dkim", "dmarc", "website"],
    authoritativeDnsStatus: "verified",
    httpsStatus: "verified",
    entitlementStatus: "active",
    customerStatus: "active",
    renewalIntent: true,
    providerAutorenew: "on",
    reconciliationRequired: false,
    transferOutProviderMissingCount: 0,
    stateHistory: [],
  }
  const order: MockDoc = {
    id: 20,
    tenant: 1,
    domain: "example.nl",
    customerEmail: "customer@example.com",
  }
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    if (collection !== "managed-domains" || String(id) !== "10") {
      throw new Error(`Unexpected update ${collection} ${id}`)
    }
    Object.assign(domain, data)
    return domain
  })
  const payload = asPayload({
    findByID: vi.fn(async ({
      collection,
      id,
    }: {
      collection: string
      id: string | number
    }) => {
      if (collection === "managed-domains" && String(id) === "10") return domain
      if (collection === "orders" && String(id) === "20") return order
      throw new Error(`Missing ${collection} ${id}`)
    }),
    update,
  })
  return { domain, order, payload, update }
}

describe("domain offboarding and transfer-out rehearsal", () => {
  it("freezes hashes from the complete authoritative provider zone", async () => {
    const store = createStore()
    const listRecords = vi.fn(async () => [
      {
        id: "mx",
        record: {
          type: "MX" as const,
          name: "example.nl",
          ttl: 3_600,
          priority: 10,
          target: "mail.example.net",
          proxied: false,
        },
        raw: {},
      },
      {
        id: "www",
        record: {
          type: "CNAME" as const,
          name: "www.example.nl",
          ttl: 300,
          content: "origin.example.net",
          proxied: false,
        },
        raw: {},
      },
    ])
    const evidence = await captureDomainOffboardingContinuityEvidence(
      store.payload,
      {
        managedDomainId: 10,
        actor: ACTOR,
        now: "2026-07-28T10:00:00.000Z",
      },
      {
        providerReadsAllowed: () => true,
        listCloudflareMigrationDnsRecords: listRecords,
        verifyParentDsAbsent: vi.fn(async () => ({
          status: "present" as const,
          records: ["12345 13 2 ABCD"],
          reason: "parent_ds_present",
        })),
      },
    )
    expect(listRecords).toHaveBeenCalledWith("zone-1")
    expect(evidence).toMatchObject({
      domain: "example.nl",
      dnssecStatus: "signed",
      preservationMode: "retain_existing_dns_and_mail",
    })
    expect(evidence.zoneSnapshotHash).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence.mailRecordSetHash).not.toBe(evidence.zoneSnapshotHash)
  })

  it("preserves DNS, mail, HTTPS and entitlement until transfer is confirmed twice", async () => {
    const store = createStore()
    const originalService = {
      state: store.domain.state,
      cloudflareZoneId: store.domain.cloudflareZoneId,
      cloudflareNameservers: store.domain.cloudflareNameservers,
      cloudflareDnsRecordIds: store.domain.cloudflareDnsRecordIds,
      authoritativeDnsStatus: store.domain.authoritativeDnsStatus,
      httpsStatus: store.domain.httpsStatus,
      entitlementStatus: store.domain.entitlementStatus,
      customerStatus: store.domain.customerStatus,
    }

    await requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "offboarding-request-1",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: EVIDENCE,
      now: "2026-07-28T10:00:00.000Z",
    })
    await prepareDomainTransferOutCode(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: vi.fn(async () => ({
        id: "9001",
        domain: "example.nl",
        status: "ACT",
        ownerHandle: null,
        adminHandle: null,
        nameServers: [],
        renewalDate: "2027-07-28T00:00:00.000Z",
        autorenew: "on" as const,
        verificationEmailStatus: null,
        verificationEmailDescription: null,
        raw: {},
      })),
      getOpenProviderDomainAuthCode: vi.fn(async () => "sensitive-epp-code"),
      sealSecret: (value, binding) =>
        sealMigrationSecret(value, binding, ENCRYPTION_ENV),
    }, "2026-07-28T10:01:00.000Z")

    expect(store.domain.encryptedTransferOutCode).not.toContain(
      "sensitive-epp-code",
    )
    const revealed = await revealDomainTransferOutCode(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-28T10:02:00.000Z",
    }, {
      openSecret: (value, binding) =>
        openMigrationSecret(value, binding, ENCRYPTION_ENV),
    })
    expect(revealed.authCode).toBe("sensitive-epp-code")
    await markDomainTransferOutStarted(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-28T10:03:00.000Z",
    })
    const findOpenProviderDomain = vi.fn(async () => null)
    const first = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-28T10:04:00.000Z"))
    expect(first.status).toBe("pending")
    expect(store.domain.custodyStatus).toBe("transfer_pending")

    const withoutCustomerConfirmation = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-28T10:20:00.000Z"))
    expect(withoutCustomerConfirmation.status).toBe("pending")
    expect(store.domain.custodyStatus).toBe("transfer_pending")

    await confirmDomainTransferCompletedByCustomer(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-28T10:21:00.000Z",
    })
    const confirmed = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-28T10:22:00.000Z"))
    expect(confirmed.status).toBe("transferred_out")
    expect(store.domain).toMatchObject({
      ...originalService,
      custodyStatus: "transferred_out",
      encryptedTransferOutCode: null,
      transferOutCodeDeletedAt: "2026-07-28T10:22:00.000Z",
      transferOutCustomerConfirmedAt: "2026-07-28T10:21:00.000Z",
      renewalIntent: false,
      providerAutorenew: "unknown",
    })
    expect(findOpenProviderDomain).toHaveBeenCalledTimes(3)
  })

  it("rejects cross-tenant and non-contracting-customer requests", async () => {
    const store = createStore()
    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: { email: "customer@example.com", tenantId: 2 },
      requestId: "cross-tenant",
      reason: "Invalid tenant.",
      continuityEvidence: EVIDENCE,
    })).rejects.toThrow("authenticated contracting customer")
    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: { email: "other@example.com", tenantId: 1 },
      requestId: "wrong-customer",
      reason: "Invalid customer.",
      continuityEvidence: EVIDENCE,
    })).rejects.toThrow("authenticated contracting customer")
    expect(store.update).not.toHaveBeenCalled()
  })

  it("rejects unsupported TLDs before creating partial offboarding state", async () => {
    const store = createStore()
    store.domain.tld = "be"
    store.domain.domainNameAscii = "example.be"
    store.order.domain = "example.be"

    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "unsupported-tld",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: {
        ...EVIDENCE,
        domain: "example.be",
      },
    })).rejects.toThrow("currently supports only .nl")
    expect(store.update).not.toHaveBeenCalled()
  })
})
