import { describe, expect, it, vi } from "vitest"

import {
  provisionPaidDomainOrder,
} from "@/lib/domains/provisioning"
import {
  OpenProviderAmbiguousCustomerReferenceLookupError,
  OpenProviderAmbiguousDomainLookupError,
} from "@/lib/domains/openprovider"
import type {
  CheckoutProfile,
  ManagedDomain,
  Order,
  PaymentAttempt,
  SiteGenerationRun,
} from "@/payload-types"
import {
  createMutablePayloadStore,
  type MockDoc,
} from "../_helpers/mockPayload"

const NOW = "2026-07-30T10:00:00.000Z"

const order = (): Order => ({
  id: 600,
  orderNumber: "SIAB-600",
  generationRun: 500,
  tenant: 1,
  state: "fulfillment_pending",
  checkoutProfileKey: "profile-500-v1",
  quoteEvidence: {
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
  domainRegistrant: {
    companyName: "Acme Studio",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "client@example.com",
    street: "Main Street",
    number: "10",
    suffix: null,
    zipcode: "1011AB",
    city: "Amsterdam",
    country: "NL",
    state: null,
    phoneCountryCode: "+31",
    phoneAreaCode: "20",
    phoneSubscriberNumber: "1234567",
    locale: "nl_NL",
  },
  legalDocuments: [10, 11],
  paymentStatus: "paid",
  paymentProvider: "mollie",
  providerPaymentId: "tr_paid",
  acceptedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
} as Order)

const attempt = (): PaymentAttempt => ({
  id: 700,
  order: 600,
  purpose: "first_payment",
  state: "paid",
  providerPaymentId: "tr_paid",
} as PaymentAttempt)

const profile = (): CheckoutProfile => ({
  id: 800,
  profileKey: "profile-500-v1",
  generationRun: 500,
  tenant: 1,
  profileVersion: 1,
  partyType: "registered_business",
  contractingPartyName: "Acme Studio",
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
  capturedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
} as CheckoutProfile)

const managedDomain = (): ManagedDomain => ({
  id: 950,
  domainNameAscii: "example.nl",
  tld: "nl",
  provisioningIdempotencyKey: "domain-registration:order:600:v1",
  originatingOrder: 600,
  registrantProfile: 800,
  tenant: 1,
  state: "registration_pending",
  custodyStatus: "managed",
  initialOperation: "registration",
  registrantOwnership: "customer",
  provider: "openprovider",
  providerCustomerHandle: null,
  providerRegistrationState: "not_started",
  registrantVerificationStatus: "not_checked",
  authoritativeDnsStatus: "pending",
  httpsStatus: "pending",
  edgeRoutingStatus: "pending",
  adminHttpsStatus: "pending",
  entitlementStatus: "pending",
  customerStatus: "provisioning",
  renewalIntent: true,
  providerAutorenew: "unknown",
  transferOutCodeDeliveryStatus: "not_requested",
  transferOutProviderMissingCount: 0,
  reconciliationRequired: false,
  stateHistory: [],
  createdAt: NOW,
  updatedAt: NOW,
} as ManagedDomain)

const run = (): SiteGenerationRun => ({
  id: 500,
  tenant: 1,
  status: "preview_ready",
  domainOrder: {
    status: "registration_requested",
    domain: "example.nl",
  },
} as unknown as SiteGenerationRun)

const fixture = () => {
  const currentOrder = order()
  const currentRun = run()
  const currentDomain = managedDomain()
  const collections: Record<string, MockDoc[]> = {
    orders: [currentOrder as unknown as MockDoc],
    "payment-attempts": [attempt() as unknown as MockDoc],
    "checkout-profiles": [profile() as unknown as MockDoc],
    "managed-domains": [currentDomain as unknown as MockDoc],
    tenants: [{
      id: 1,
      status: "preview",
      domain: "preview.siteinabox.test",
    }],
    "site-generation-runs": [currentRun as unknown as MockDoc],
    "operational-alerts": [],
  }
  const store = createMutablePayloadStore({ collections })
  return {
    ...store,
    order: currentOrder,
    run: currentRun,
    domain: currentDomain,
  }
}

const available = {
  status: "available" as const,
  domain: "example.nl",
  available: true,
  premium: false,
  price: null,
  internalReason: null,
}

describe("new-domain provider authority", () => {
  it("stops before every write when exact registrar-domain lookup is ambiguous", async () => {
    const store = fixture()
    const login = vi.fn(async () => "token")
    const availability = vi.fn(async () => available)
    const createCustomer = vi.fn()
    const createZone = vi.fn()
    const register = vi.fn()

    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: login,
        findOpenProviderDomain: vi.fn(async () => {
          throw new OpenProviderAmbiguousDomainLookupError("example.nl")
        }),
        checkOpenProviderDomainAvailability: availability,
        createOpenProviderCustomerHandle: createCustomer,
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    }
    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          state: "manual_review",
          reconciliationRequired: true,
          failureReason: "openprovider_domain_lookup_ambiguous",
        },
      })
    expect(login).toHaveBeenCalledOnce()
    expect(availability).not.toHaveBeenCalled()
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
    expect(store.collections["operational-alerts"]).toEqual([
      expect.objectContaining({
        severity: "critical",
        status: "open",
      }),
    ])

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({ status: "waiting" })
    expect(login).toHaveBeenCalledOnce()
  })

  it("stops after absent-domain reads but before writes on ambiguous customer authority", async () => {
    const store = fixture()
    const findDomain = vi.fn(async () => null)
    const availability = vi.fn(async () => available)
    const createCustomer = vi.fn()
    const createZone = vi.fn()
    const register = vi.fn()

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: findDomain,
        checkOpenProviderDomainAvailability: availability,
        findOpenProviderCustomerByReference: vi.fn(async () => {
          throw new OpenProviderAmbiguousCustomerReferenceLookupError(
            "domain-registration:order:600:v1",
          )
        }),
        createOpenProviderCustomerHandle: createCustomer,
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      managedDomain: {
        state: "manual_review",
        failureReason: "openprovider_customer_reference_ambiguous",
      },
    })
    expect(findDomain).toHaveBeenCalledOnce()
    expect(availability).toHaveBeenCalledOnce()
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("accepts exact customer authority but stops before writes on ambiguous zones", async () => {
    const store = fixture()
    const createCustomer = vi.fn()
    const createZone = vi.fn()
    const register = vi.fn()

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => ({
          handle: "OWNER-CLIENT",
          comments: "domain-registration:order:600:v1",
          raw: {},
        })),
        createOpenProviderCustomerHandle: createCustomer,
        listCloudflareZones: vi.fn(async () => [
          {
            id: "zone-1",
            name: "example.nl",
            nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
            status: "active" as const,
            raw: {},
          },
          {
            id: "zone-2",
            name: "example.nl",
            nameServers: ["cara.ns.cloudflare.com", "dan.ns.cloudflare.com"],
            status: "active" as const,
            raw: {},
          },
        ]),
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      managedDomain: {
        state: "manual_review",
        failureReason: "cloudflare_zone_lookup_ambiguous",
      },
    })
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("accepts one exact registrar domain without customer, zone, or registrar writes", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    const createCustomer = vi.fn()
    const createZone = vi.fn()
    const register = vi.fn()

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => ({
          id: 9001,
          domain: "example.nl",
          status: "REQ",
          ownerHandle: "OWNER-CLIENT",
          adminHandle: null,
          nameServers: [],
          renewalDate: null,
          autorenew: "off" as const,
          verificationEmailStatus: null,
          verificationEmailDescription: null,
          raw: {},
        })),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        createOpenProviderCustomerHandle: createCustomer,
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("still processing"),
    })
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })
})
