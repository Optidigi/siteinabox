import { describe, expect, it, vi } from "vitest"

import {
  captureDomainOffboardingContinuityEvidence,
  confirmDomainTransferCompletedByCustomer,
  exportDomainDnsPortability,
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
  schemaVersion: 2 as const,
  domain: "example.nl",
  capturedAt: "2026-07-28T10:00:00.000Z",
  authoritativeNameservers: [
    "ada.ns.cloudflare.com",
    "bob.ns.cloudflare.com",
  ],
  dnssecStatus: "signed" as const,
  parentDsRecords: ["12345 13 2 ABCD"],
  zoneSnapshotHash: "a".repeat(64),
  mailRecordSetHash: "b".repeat(64),
  serviceRecordSetHash: "c".repeat(64),
  preservationMode: "retain_existing_dns_and_mail" as const,
}

const createStore = (domainOverrides: MockDoc = {}) => {
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
    providerRenewalDate: "2027-07-29T00:00:00.000Z",
    reconciliationRequired: false,
    transferOutProviderMissingCount: 0,
    stateHistory: [],
    ...domainOverrides,
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
  it("exports the complete current authoritative zone to the contracting customer", async () => {
    const store = createStore({
      state: "provider_hold",
      authoritativeDnsStatus: "failed",
    })
    const records = [
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
        id: "dkim",
        record: {
          type: "TXT" as const,
          name: "selector._domainkey.example.nl",
          ttl: 300,
          content: "v=DKIM1; p=public-key",
          proxied: false,
        },
        raw: {},
      },
    ]

    await expect(exportDomainDnsPortability(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-29T18:00:00.000Z",
    }, {
      providerReadsAllowed: () => true,
      listCloudflareMigrationDnsRecords: vi.fn(async () => records),
      verifyParentDsAbsent: vi.fn(async () => ({
        status: "present" as const,
        records: ["12345 13 2 ABCD"],
        ttl: 3_600,
        reason: "parent_ds_present",
      })),
    })).resolves.toMatchObject({
      format: "siteinabox-dns-portability-v2",
      domain: "example.nl",
      complete: true,
      dnssec: {
        parentStatus: "present",
        parentDsRecords: ["12345 13 2 ABCD"],
      },
      records: expect.arrayContaining([
        expect.objectContaining({ type: "MX", target: "mail.example.net" }),
        expect.objectContaining({
          type: "TXT",
          name: "selector._domainkey.example.nl",
        }),
      ]),
    })
  })

  it("allows an unexpired provider-held domain to start transfer-out", async () => {
    const store = createStore({ state: "provider_hold" })

    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "provider-hold-transfer",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: EVIDENCE,
      now: "2026-07-29T18:00:00.000Z",
    })).resolves.toMatchObject({
      custodyStatus: "offboarding_requested",
      state: "provider_hold",
    })
  })

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
      parentDsRecords: ["12345 13 2 ABCD"],
      preservationMode: "retain_existing_dns_and_mail",
    })
    expect(evidence.zoneSnapshotHash).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence.mailRecordSetHash).not.toBe(evidence.zoneSnapshotHash)
  })

  it("fails closed when parent DNSSEC evidence is indeterminate", async () => {
    const store = createStore()
    const getAuthCode = vi.fn()
    await expect(captureDomainOffboardingContinuityEvidence(
      store.payload,
      {
        managedDomainId: 10,
        actor: ACTOR,
        now: "2026-07-28T10:00:00.000Z",
      },
      {
        providerReadsAllowed: () => true,
        listCloudflareMigrationDnsRecords: vi.fn(async () => [{
          id: "www",
          record: {
            type: "CNAME" as const,
            name: "www.example.nl",
            ttl: 300,
            content: "origin.example.net",
            proxied: false,
          },
          raw: {},
        }]),
        verifyParentDsAbsent: vi.fn(async () => ({
          status: "indeterminate" as const,
          records: [],
          reason: "resolver_error",
        })),
      },
    )).rejects.toThrow("DNSSEC state is indeterminate")
    expect(store.update).not.toHaveBeenCalled()
    expect(getAuthCode).not.toHaveBeenCalled()
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
      now: "2026-07-29T18:00:00.000Z",
    })
    await prepareDomainTransferOutCode(store.payload, 10, {
      providerReadsAllowed: () => true,
      providerWritesAllowed: () => true,
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
      getOpenProviderDomainAuthCode: vi.fn(async () => ({
        delivery: "provider_returned" as const,
        authCode: "sensitive-epp-code",
      })),
      sealSecret: (value, binding) =>
        sealMigrationSecret(value, binding, ENCRYPTION_ENV),
    }, "2026-07-29T18:01:00.000Z")

    expect(store.domain.encryptedTransferOutCode).not.toContain(
      "sensitive-epp-code",
    )
    const revealed = await revealDomainTransferOutCode(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-29T18:02:00.000Z",
    }, {
      openSecret: (value, binding) =>
        openMigrationSecret(value, binding, ENCRYPTION_ENV),
    })
    expect(revealed.authCode).toBe("sensitive-epp-code")
    await markDomainTransferOutStarted(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-29T18:03:00.000Z",
    })
    const findOpenProviderDomain = vi.fn(async () => null)
    const first = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-29T18:04:00.000Z"))
    expect(first.status).toBe("pending")
    expect(store.domain.custodyStatus).toBe("transfer_pending")

    const withoutCustomerConfirmation = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-29T18:20:00.000Z"))
    expect(withoutCustomerConfirmation.status).toBe("pending")
    expect(store.domain.custodyStatus).toBe("transfer_pending")

    await confirmDomainTransferCompletedByCustomer(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      now: "2026-07-29T18:21:00.000Z",
    })
    const confirmed = await reconcileDomainTransferOut(store.payload, 10, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain,
    }, new Date("2026-07-29T18:22:00.000Z"))
    expect(confirmed.status).toBe("transferred_out")
    expect(store.domain).toMatchObject({
      ...originalService,
      custodyStatus: "transferred_out",
      encryptedTransferOutCode: null,
      transferOutCodeDeletedAt: "2026-07-29T18:22:00.000Z",
      transferOutCustomerConfirmedAt: "2026-07-29T18:21:00.000Z",
      renewalIntent: false,
      providerAutorenew: "unknown",
    })
    expect(findOpenProviderDomain).toHaveBeenCalledTimes(3)
  })

  it("allows transfer-out while website entitlement and future renewal are stopped", async () => {
    const store = createStore({
      entitlementStatus: "blocked",
      renewalIntent: false,
    })
    const dnsBefore = {
      cloudflareZoneId: store.domain.cloudflareZoneId,
      cloudflareDnsRecordIds: store.domain.cloudflareDnsRecordIds,
      authoritativeDnsStatus: store.domain.authoritativeDnsStatus,
      httpsStatus: store.domain.httpsStatus,
    }

    await requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "cancelled-website-transfer-out",
      reason: "Customer cancelled website service and is moving the domain.",
      continuityEvidence: EVIDENCE,
      now: "2026-07-29T19:00:00.000Z",
    })

    expect(store.domain).toMatchObject({
      state: "active",
      custodyStatus: "offboarding_requested",
      entitlementStatus: "blocked",
      renewalIntent: false,
      ...dnsBefore,
    })
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

  it("keeps legacy evidence readable but requires current DNSSEC evidence for new requests", async () => {
    const store = createStore()
    const {
      parentDsRecords: _currentParentDsRecords,
      ...legacyEvidence
    } = EVIDENCE
    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "legacy-evidence",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: {
        ...legacyEvidence,
        schemaVersion: 1,
        dnssecStatus: "unknown",
      },
    })).rejects.toThrow("current DNSSEC continuity evidence")
    expect(store.update).not.toHaveBeenCalled()
  })

  it("rejects unsupported TLDs before creating partial offboarding state", async () => {
    const store = createStore()
    store.domain.tld = "xyz"
    store.domain.domainNameAscii = "example.xyz"
    store.order.domain = "example.xyz"

    await expect(requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "unsupported-tld",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: {
        ...EVIDENCE,
        domain: "example.xyz",
      },
    })).rejects.toThrow("not contract-enabled for .xyz")
    expect(store.update).not.toHaveBeenCalled()
  })

  it("uses the provider-backed outgoing transfer contract for non-.nl TLDs", async () => {
    const store = createStore({
      tld: "be",
      domainNameAscii: "example.be",
    })
    store.order.domain = "example.be"

    await requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "be-transfer-out",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: {
        ...EVIDENCE,
        domain: "example.be",
      },
      now: "2026-07-29T18:00:00.000Z",
    })
    await prepareDomainTransferOutCode(store.payload, 10, {
      providerReadsAllowed: () => true,
      providerWritesAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: vi.fn(async () => ({
        id: "9001",
        domain: "example.be",
        status: "ACT",
        ownerHandle: null,
        adminHandle: null,
        nameServers: [],
        renewalDate: "2027-07-29T00:00:00.000Z",
        autorenew: "on" as const,
        verificationEmailStatus: null,
        verificationEmailDescription: null,
        raw: {},
      })),
      getOpenProviderDomainAuthCode: vi.fn(async () => ({
        delivery: "registrant_email" as const,
      })),
      sealSecret: (value, binding) =>
        sealMigrationSecret(value, binding, ENCRYPTION_ENV),
    }, "2026-07-29T18:01:00.000Z")

    expect(store.domain).toMatchObject({
      custodyStatus: "transfer_code_ready",
      tld: "be",
    })
    expect(store.domain).toMatchObject({
      transferOutCodeDeliveryStatus: "registrant_email",
      encryptedTransferOutCode: null,
    })
  })

  it("does not trigger registrant-email auth-code delivery while provider writes are disabled", async () => {
    const store = createStore({
      tld: "be",
      domainNameAscii: "example.be",
    })
    store.order.domain = "example.be"
    const getOpenProviderDomainAuthCode = vi.fn()
    await requestDomainOffboarding(store.payload, {
      managedDomainId: 10,
      actor: ACTOR,
      requestId: "be-write-gate",
      reason: "Customer is moving registrar custody.",
      continuityEvidence: { ...EVIDENCE, domain: "example.be" },
      now: "2026-07-29T18:00:00.000Z",
    })

    await expect(prepareDomainTransferOutCode(store.payload, 10, {
      providerReadsAllowed: () => true,
      providerWritesAllowed: () => false,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: vi.fn(async () => ({
        id: "9001",
        domain: "example.be",
        status: "ACT",
        ownerHandle: null,
        adminHandle: null,
        nameServers: [],
        renewalDate: "2027-07-29T00:00:00.000Z",
        autorenew: "on" as const,
        verificationEmailStatus: null,
        verificationEmailDescription: null,
        raw: {},
      })),
      getOpenProviderDomainAuthCode,
    }, "2026-07-29T18:01:00.000Z")).rejects.toThrow(
      "does not allow provider-delivered transfer codes",
    )
    expect(getOpenProviderDomainAuthCode).not.toHaveBeenCalled()
  })
})
