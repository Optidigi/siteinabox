import { describe, expect, it, vi } from "vitest"

import {
  provisionPaidDomainOrder,
} from "@/lib/domains/provisioning"
import {
  OpenProviderAmbiguousCustomerReferenceLookupError,
  OpenProviderAmbiguousDomainLookupError,
  OpenProviderApiError,
  OpenProviderCustomerReferenceLookupIncompleteError,
  OpenProviderIndeterminateWriteError,
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

const requestedProviderDomain = () => ({
  id: 9001,
  domain: "example.nl",
  status: "REQ",
  ownerHandle: "OWNER-CLIENT",
  adminHandle: null,
  nameServers: [],
  renewalDate: null,
  registryExpiryDate: null,
  autorenew: "off" as const,
  verificationEmailStatus: null,
  verificationEmailDescription: null,
  raw: {},
})

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

  it("does not create a customer when exact-reference search is incomplete", async () => {
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
        findOpenProviderCustomerByReference: vi.fn(async () => {
          throw new OpenProviderCustomerReferenceLookupIncompleteError()
        }),
        createOpenProviderCustomerHandle: createCustomer,
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    })).rejects.toBeInstanceOf(
      OpenProviderCustomerReferenceLookupIncompleteError,
    )
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

  it("recovers an indeterminate customer creation by exact reference without a second POST", async () => {
    const store = fixture()
    let customerLookupCount = 0
    const createCustomer = vi.fn(async () => {
      throw new OpenProviderIndeterminateWriteError(
        "customer creation response was lost",
      )
    })
    const createZone = vi.fn()
    const register = vi.fn()
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => {
          customerLookupCount += 1
          return customerLookupCount <= 2
            ? null
            : {
                handle: "OWNER-CLIENT",
                comments: "domain-registration:order:600:v1",
                raw: {},
              }
        }),
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
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_customer_handle_indeterminate",
        },
      })
    expect(createCustomer).toHaveBeenCalledOnce()

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerCustomerHandle: "OWNER-CLIENT",
          failureReason: "cloudflare_zone_lookup_ambiguous",
        },
      })
    expect(createCustomer).toHaveBeenCalledOnce()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("requires exact customer readback after a usable create response", async () => {
    const store = fixture()
    let customerVisible = false
    const createCustomer = vi.fn(async () => {
      expect(store.collections["managed-domains"]?.[0]).toMatchObject({
        providerRegistrationState: "prepared",
        reconciliationRequired: true,
        failureReason: "openprovider_customer_handle_prepared",
      })
      customerVisible = true
      return { handle: "UNTRUSTED-RESPONSE", raw: {} }
    })
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
        findOpenProviderCustomerByReference: vi.fn(async () =>
          customerVisible
            ? {
                handle: "OWNER-CLIENT",
                comments: "domain-registration:order:600:v1",
                raw: {},
              }
            : null),
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
        providerCustomerHandle: "OWNER-CLIENT",
        providerRegistrationState: "not_started",
        failureReason: "cloudflare_zone_lookup_ambiguous",
      },
    })
    expect(createCustomer).toHaveBeenCalledOnce()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("persists uncertainty when customer readback fails after a usable response", async () => {
    const store = fixture()
    let lookupCount = 0
    const createCustomer = vi.fn(async () => ({
      handle: "UNTRUSTED-RESPONSE",
      raw: {},
    }))
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
        findOpenProviderCustomerByReference: vi.fn(async () => {
          lookupCount += 1
          if (lookupCount === 1) return null
          throw new Error("readback unavailable")
        }),
        createOpenProviderCustomerHandle: createCustomer,
        listCloudflareZones: vi.fn(),
        createOrReuseCloudflareZone: createZone,
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      managedDomain: {
        providerCustomerHandle: null,
        providerRegistrationState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_customer_handle_indeterminate",
      },
    })
    expect(createCustomer).toHaveBeenCalledOnce()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("keeps a successful customer write prepared until exact readback appears", async () => {
    const store = fixture()
    let customerVisible = false
    const createCustomer = vi.fn(async () => ({
      handle: "OWNER-CLIENT",
      raw: {},
    }))
    const createZone = vi.fn()
    const register = vi.fn()
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () =>
          customerVisible
            ? {
                handle: "OWNER-CLIENT",
                comments: "domain-registration:order:600:v1",
                raw: {},
              }
            : null),
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
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerCustomerHandle: null,
          providerRegistrationState: "prepared",
          reconciliationRequired: true,
          failureReason: "openprovider_customer_handle_readback_pending",
        },
      })
    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        message: expect.stringContaining("lease has not elapsed"),
      })
    expect(createCustomer).toHaveBeenCalledOnce()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()

    customerVisible = true
    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        managedDomain: { providerCustomerHandle: "OWNER-CLIENT" },
      })
    expect(createCustomer).toHaveBeenCalledOnce()
  })

  it("sends concurrent lease-expired checkpoints to manual review without retry", async () => {
    const store = fixture()
    let now = NOW
    const createCustomer = vi.fn(async () => {
      throw new Error("local uncertainty after dispatch")
    })
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => now,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => null),
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
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerRegistrationState: "indeterminate",
          failureReason: "openprovider_customer_handle_indeterminate",
        },
      })
    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        message: expect.stringContaining("lease has not elapsed"),
      })
    expect(createCustomer).toHaveBeenCalledOnce()

    now = "2026-07-30T10:06:00.000Z"
    const results = await Promise.all([
      provisionPaidDomainOrder(store.payload, store.run, input),
      provisionPaidDomainOrder(store.payload, store.run, input),
    ])
    expect(results).toEqual([
      expect.objectContaining({
        status: "waiting",
        managedDomain: expect.objectContaining({
          state: "manual_review",
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_customer_handle_reconciliation_timeout",
        }),
      }),
      expect.objectContaining({
        status: "waiting",
        managedDomain: expect.objectContaining({
          state: "manual_review",
          failureReason: "openprovider_customer_handle_reconciliation_timeout",
        }),
      }),
    ])
    expect(createCustomer).toHaveBeenCalledOnce()
  })

  it("terminally rejects a deterministic customer write after exact absence", async () => {
    const store = fixture()
    const createCustomer = vi.fn(async () => {
      throw new OpenProviderApiError(
        "OpenProvider customer handle creation",
        422,
      )
    })
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => null),
        createOpenProviderCustomerHandle: createCustomer,
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "unfulfillable",
        managedDomain: {
          state: "manual_review",
          providerRegistrationState: "not_started",
          reconciliationRequired: false,
          failureReason: "openprovider_customer_handle_write_rejected",
        },
      })
    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "unfulfillable",
        managedDomain: {
          failureReason: "openprovider_customer_handle_write_rejected",
        },
      })
    expect(createCustomer).toHaveBeenCalledOnce()
  })

  it("keeps HTTP 503 customer writes indeterminate after exact absence", async () => {
    const store = fixture()
    const createCustomer = vi.fn(async () => {
      throw new OpenProviderApiError(
        "OpenProvider customer handle creation",
        503,
      )
    })

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => null),
        createOpenProviderCustomerHandle: createCustomer,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      managedDomain: {
        providerRegistrationState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_customer_handle_indeterminate",
      },
    })
    expect(createCustomer).toHaveBeenCalledOnce()
  })

  it("keeps HTTP 429 customer writes indeterminate after exact absence", async () => {
    const store = fixture()
    const createCustomer = vi.fn(async () => {
      throw new OpenProviderApiError(
        "OpenProvider customer handle creation",
        429,
      )
    })

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        findOpenProviderCustomerByReference: vi.fn(async () => null),
        createOpenProviderCustomerHandle: createCustomer,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      managedDomain: {
        providerRegistrationState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_customer_handle_indeterminate",
      },
    })
    expect(createCustomer).toHaveBeenCalledOnce()
  })

  it("lets concurrent workers dispatch one customer create after shared absence", async () => {
    const store = fixture()
    let customerVisible = false
    let initialLookups = 0
    let releaseInitialLookups!: () => void
    const bothInitialLookups = new Promise<void>((resolve) => {
      releaseInitialLookups = resolve
    })
    const findCustomer = vi.fn(async () => {
      if (customerVisible) {
        return {
          handle: "OWNER-CLIENT",
          comments: "domain-registration:order:600:v1",
          raw: {},
        }
      }
      initialLookups += 1
      if (initialLookups === 2) releaseInitialLookups()
      await bothInitialLookups
      return null
    })
    const createCustomer = vi.fn(async () => {
      customerVisible = true
      return { handle: "OWNER-CLIENT", raw: {} }
    })
    const createZone = vi.fn()
    const register = vi.fn()
    const dependencies = {
      now: () => NOW,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: vi.fn(async () => null),
      checkOpenProviderDomainAvailability: vi.fn(async () => available),
      findOpenProviderCustomerByReference: findCustomer,
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
    }

    const results = await Promise.all([
      provisionPaidDomainOrder(store.payload, store.run, {
        order: store.order,
        paymentAttemptId: 700,
        dependencies,
      }),
      provisionPaidDomainOrder(store.payload, store.run, {
        order: store.order,
        paymentAttemptId: 700,
        dependencies,
      }),
    ])

    expect(results).toHaveLength(2)
    expect(createCustomer).toHaveBeenCalledOnce()
    expect(createZone).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it("recovers an indeterminate registration on restart from exact owner readback without a second POST", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    let domainLookupCount = 0
    const register = vi.fn(async () => {
      throw new OpenProviderIndeterminateWriteError(
        "registration response was lost",
      )
    })

    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => {
          domainLookupCount += 1
          return domainLookupCount <= 2
            ? null
            : {
                id: 9001,
                domain: "example.nl",
                status: "REQ",
                ownerHandle: "OWNER-CLIENT",
                adminHandle: null,
                nameServers: [],
                renewalDate: null,
                registryExpiryDate: null,
                autorenew: "off" as const,
                verificationEmailStatus: null,
                verificationEmailDescription: null,
                raw: {},
              }
        }),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        registerOpenProviderDomain: register,
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        message: expect.stringContaining("no retry was sent"),
        managedDomain: {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        },
      })
    expect(domainLookupCount).toBe(2)
    expect(register).toHaveBeenCalledOnce()

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        message: expect.stringContaining("still processing"),
        managedDomain: {
          providerDomainId: "9001",
          providerRegistrationState: "confirmed",
          reconciliationRequired: true,
          failureReason: null,
        },
      })
    expect(domainLookupCount).toBe(3)
    expect(register).toHaveBeenCalledOnce()
  })

  it("keeps a successful registration response prepared until exact restart readback", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    let domainLookupCount = 0
    const register = vi.fn(async () => ({
      id: 9001,
      domain: "example.nl",
      status: "requested" as const,
      raw: {},
    }))
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => {
          domainLookupCount += 1
          return domainLookupCount <= 2 ? null : requestedProviderDomain()
        }),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        registerOpenProviderDomain: register,
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        message: expect.stringContaining("still processing"),
        managedDomain: {
          providerDomainId: "9001",
          providerRegistrationState: "prepared",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_readback_pending",
        },
      })
    expect(register).toHaveBeenCalledOnce()

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerRegistrationState: "confirmed",
          failureReason: null,
        },
      })
    expect(domainLookupCount).toBe(3)
    expect(register).toHaveBeenCalledOnce()
  })

  it("keeps a successful registration indeterminate when authoritative readback errors", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    let domainLookupCount = 0
    const register = vi.fn(async () => ({
      id: 9001,
      domain: "example.nl",
      status: "requested" as const,
      raw: {},
    }))
    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => {
          domainLookupCount += 1
          if (domainLookupCount === 1) return null
          if (domainLookupCount === 2) throw new Error("readback unavailable")
          return requestedProviderDomain()
        }),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        registerOpenProviderDomain: register,
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        message: expect.stringContaining("readback is awaiting reconciliation"),
        managedDomain: {
          providerDomainId: "9001",
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        },
      })
    expect(register).toHaveBeenCalledOnce()

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "waiting",
        managedDomain: {
          providerRegistrationState: "confirmed",
          failureReason: null,
        },
      })
    expect(domainLookupCount).toBe(3)
    expect(register).toHaveBeenCalledOnce()
  })

  it("terminally classifies a deterministic registration rejection after absence readback", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    const register = vi.fn(async () => {
      throw new OpenProviderApiError(
        "OpenProvider domain registration",
        422,
      )
    })

    const input = {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        registerOpenProviderDomain: register,
      },
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "unfulfillable",
        message: expect.stringContaining("deterministically rejected"),
        managedDomain: {
          state: "manual_review",
          providerRegistrationState: "not_started",
          reconciliationRequired: false,
          failureReason: "openprovider_registration_write_rejected",
        },
      })
    expect(register).toHaveBeenCalledOnce()

    await expect(provisionPaidDomainOrder(store.payload, store.run, input))
      .resolves.toMatchObject({
        status: "unfulfillable",
        managedDomain: {
          failureReason: "openprovider_registration_write_rejected",
        },
      })
    expect(register).toHaveBeenCalledOnce()
  })

  it("keeps a deterministic registration rejection indeterminate when absence readback fails", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    let domainLookupCount = 0
    const register = vi.fn(async () => {
      throw new OpenProviderApiError(
        "OpenProvider domain registration",
        422,
      )
    })

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => {
          domainLookupCount += 1
          if (domainLookupCount === 1) return null
          throw new Error("readback unavailable")
        }),
        checkOpenProviderDomainAvailability: vi.fn(async () => available),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("readback is awaiting reconciliation"),
      managedDomain: {
        providerRegistrationState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_registration_indeterminate",
      },
    })
    expect(register).toHaveBeenCalledOnce()
  })

  it("rejects exact registrar readback under a different customer owner", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
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
          status: "ACT",
          ownerHandle: "OWNER-OTHER",
          adminHandle: null,
          nameServers: [],
          renewalDate: null,
          registryExpiryDate: null,
          autorenew: "off" as const,
          verificationEmailStatus: null,
          verificationEmailDescription: null,
          raw: {},
        })),
        registerOpenProviderDomain: register,
      },
    })).resolves.toMatchObject({
      status: "unfulfillable",
      message: expect.stringContaining("different provider owner"),
      managedDomain: {
        state: "manual_review",
        failureReason: "provider_domain_owner_mismatch",
      },
    })
    expect(register).not.toHaveBeenCalled()
  })

  it("alerts and blocks DNS effects when registrar verification is suspended", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    const createDnsRecords = vi.fn()

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => ({
          ...requestedProviderDomain(),
          status: "ACT",
          verificationEmailStatus: "suspended",
          verificationEmailDescription: "Registrant verification is suspended.",
          verificationEmailExpiresAt: "2026-08-12T12:00:00.000Z",
        })),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone-1",
          name: "example.nl",
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          status: "active" as const,
          raw: {},
        }]),
        createCloudflareZoneDnsRecords: createDnsRecords,
      },
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("verification is required"),
      managedDomain: {
        providerRegistrationState: "confirmed",
        registrantVerificationStatus: "suspended",
        registrantVerificationDueAt: "2026-08-12T12:00:00.000Z",
        customerStatus: "verification_required",
        reconciliationRequired: true,
        failureReason: "registrant_verification_suspended",
      },
    })
    expect(createDnsRecords).not.toHaveBeenCalled()
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        dedupeKey: expect.stringContaining("registrant_verification_suspended"),
        severity: "critical",
        status: "open",
      }),
    )
  })

  it("blocks activation when public edge readiness is active but admin HTTPS is pending", async () => {
    const store = fixture()
    store.domain.providerCustomerHandle = "OWNER-CLIENT"
    store.domain.edgeRoutingStatus = "active"
    store.domain.httpsStatus = "verified"
    store.domain.adminHttpsStatus = "pending"
    const zone = {
      id: "zone-1",
      name: "example.nl",
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      status: "active" as const,
      raw: {},
    }

    await expect(provisionPaidDomainOrder(store.payload, store.run, {
      order: store.order,
      paymentAttemptId: 700,
      dependencies: {
        now: () => NOW,
        loginOpenProvider: vi.fn(async () => "token"),
        findOpenProviderDomain: vi.fn(async () => ({
          ...requestedProviderDomain(),
          status: "ACT",
          verificationEmailStatus: "not applicable",
        })),
        listCloudflareZones: vi.fn(async () => [zone]),
        verifyAuthoritativeDns: vi.fn(async (_domain, nameServers) => ({
          status: "verified" as const,
          delegatedNameServers: nameServers,
          respondingNameServers: nameServers,
          reason: null,
        })),
      },
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("administration routing"),
      managedDomain: {
        authoritativeDnsStatus: "verified",
        httpsStatus: "verified",
        edgeRoutingStatus: "active",
        adminHttpsStatus: "pending",
        entitlementStatus: "pending",
        reconciliationRequired: true,
      },
    })
    expect(store.collections.tenants?.[0]).toMatchObject({
      domain: "preview.siteinabox.test",
      status: "preview",
    })
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
