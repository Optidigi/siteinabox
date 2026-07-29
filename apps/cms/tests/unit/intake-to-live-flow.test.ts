import { beforeEach, describe, expect, it, vi } from "vitest"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { checkAndRecordPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"
import { createMollieCheckoutForGenerationRun, applyMollieWebhookPayment } from "@/lib/payments/molliePayments"
import { fulfillPaidOrder } from "@/lib/payments/fulfillOrder"
import { deliverCommerceNotification } from "@/lib/commerce/notifications"
import { reconcileCommerceEdgeRouting } from "@/lib/domains/edgeRouting"
import { POST as intakePOST } from "@/app/(payload)/api/intake/route"

import { asNextRequest, asGenerationRun, asMockDoc } from "../_helpers/cast"
import { createArgs, relationId, updateArgs } from "../_helpers/payloadApi"
import { asFindClient } from "../_helpers/payloadFindClient"
import { asPayload, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  sendEmail: vi.fn(),
  signInMagicLink: vi.fn(),
}))

vi.mock("payload", () => ({
  getPayload: mocks.getPayload,
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/domains/verification", () => ({
  verifyDnssecChain: vi.fn(async () => ({
    status: "verified",
    reason: null,
  })),
  verifyParentDsAbsent: vi.fn(async () => ({
    status: "absent",
    records: [],
    reason: null,
  })),
  verifyAuthoritativeDns: vi.fn(async (_domain: string, nameServers: string[]) => ({
    status: "verified",
    delegatedNameServers: nameServers,
    respondingNameServers: nameServers,
    reason: null,
  })),
  verifyPreservedDnsRecords: vi.fn(async () => ({
    status: "verified",
    checkedRecordCount: 0,
    failures: [],
    reason: null,
  })),
  verifyHttpsEndpoint: vi.fn(async () => ({
    status: "verified",
    httpStatus: 404,
    reason: null,
  })),
}))

vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return {
    ...actual,
    getPlatformMailSender: () => "noreply@siteinabox.nl",
    sendEmail: mocks.sendEmail,
  }
})

vi.mock("@/lib/betterAuth", () => ({
  auth: {
    api: {
      signInMagicLink: mocks.signInMagicLink,
    },
  },
}))

type CollectionName =
  | "intake-submissions"
  | "site-generation-runs"
  | "tenants"
  | "pages"
  | "site-settings"
  | "published-site-snapshots"
  | "orders"
  | "agreement-acceptances"
  | "checkout-profiles"
  | "payment-attempts"
  | "billing-agreements"
  | "accounting-documents"
  | "managed-domains"
  | "commerce-notification-deliveries"
  | "communication-preferences"
  | "communication-preference-events"
  | "users"
  | "media"

type Store = Record<CollectionName, MockDoc[]>

const richIntake = () => ({
  submittedAt: "2026-07-02T08:00:00.000Z",
  source: "public-intake",
  company: {
    source: "kvk",
    companyName: "Flow Demo",
    kvkNumber: "12345678",
    address: "Stationsplein 1, Roermond",
    website: "https://flow-demo.nl",
    mainActivity: "Interieuradvies",
    secondaryActivities: ["Projectbegeleiding"],
  },
  content: {
    intro: "Wij helpen ondernemers met praktische interieurplannen.",
    offers: [{ value: "Interieuradvies" }],
    audience: "Lokale ondernemers",
    situation: "Klanten willen hun ruimte professioneler maken.",
    approach: "We starten met een intake en concreet plan.",
    workModes: ["on_location", "fixed_region"],
    region: "Limburg",
    notes: "",
  },
  contact: {
    selectedActions: ["message", "quote"],
    formType: "multiple",
    formOptions: ["message", "quote"],
    primaryAction: "quote",
    phoneNumber: "0612345678",
    whatsappMode: "same",
    whatsappNumber: "",
    locationOptions: ["region"],
    publicRegion: "Limburg",
    publicAddress: "",
    availabilityMode: "appointment_only",
    openingHours: "",
  },
  visual: {
    logo: { mode: "textlogo", file: null, text: "Flow Demo" },
    color: {
      sourceType: "preset",
      sourceValue: "green",
      selectedPalette: "palette_1",
      tokens: {
        background: "#ffffff",
        foreground: "#111111",
        card: "#ffffff",
        cardForeground: "#111111",
        primary: "#146c43",
        primaryForeground: "#ffffff",
        secondary: "#e7f3ed",
        secondaryForeground: "#111111",
        muted: "#f3f4f6",
        mutedForeground: "#4b5563",
        accent: "#d1fae5",
        accentForeground: "#111111",
        border: "#d1d5db",
        input: "#d1d5db",
        ring: "#146c43",
        destructive: "#dc2626",
        destructiveForeground: "#ffffff",
      },
    },
    shape: "slightly_rounded",
    typography: "clear",
  },
  finalDetails: {
    name: "Demo Contact",
    email: "demo@example.com",
    phone: "0612345678",
  },
  legal: {
    businessUseDeclaration: {
      accepted: true,
      statementVersion: "business-use-2026-07-07.1",
      recordedAt: "2026-07-02T08:00:00.000Z",
    },
    termsAcceptance: {
      accepted: true,
      ...CURRENT_INTAKE_TERMS_ACCEPTANCE,
      recordedAt: "2026-07-02T08:00:00.000Z",
    },
    marketingConsent: {
      granted: false,
      statementVersion: "marketing-opt-in-2026-07-07.1",
      recordedAt: "2026-07-02T08:00:00.000Z",
    },
    privacyNotice: {
      documentVersion: "2026-07-07.1",
      url: "https://www.siteinabox.nl/privacy-en-cookieverklaring",
    },
  },
  domain: "flow-demo.nl",
  email: "demo@example.com",
  addOns: [],
  notes: null,
})

const registrant = {
  companyName: "Flow Demo",
  firstName: "Demo",
  lastName: "Contact",
  email: "demo@example.com",
  street: "Stationsplein",
  number: "1",
  suffix: null,
  zipcode: "6041GN",
  city: "Roermond",
  country: "NL",
  state: null,
  phoneCountryCode: "+31",
  phoneAreaCode: "06",
  phoneSubscriberNumber: "12345678",
  locale: "nl_NL",
}

const valueAtPath = (doc: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") return undefined
    if (Array.isArray(current)) return undefined
    return (current as Record<string, unknown>)[part]
  }, doc)

const sameRelation = (value: unknown, expected: unknown): boolean => {
  const normalizedValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as { id?: unknown }).id
    : value
  const normalizedExpected = expected && typeof expected === "object" && !Array.isArray(expected)
    ? (expected as { id?: unknown }).id
    : expected
  return String(normalizedValue) === String(normalizedExpected)
}

const storedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(storedValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(asMockDoc(value))
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, storedValue(entry)]),
  )
}

const matchesWhere = (doc: MockDoc, where: MockWhere | undefined): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: MockDoc) => matchesWhere(doc, entry))
  if (where.or) return (where.or as MockWhere[]).some((entry) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    const value = valueAtPath(doc, field)
    if (condition && typeof condition === "object" && "equals" in condition) {
      return sameRelation(value, asMockDoc(condition).equals)
    }
    if (condition && typeof condition === "object" && "in" in condition) {
      return Array.isArray(asMockDoc(condition).in) && (asMockDoc(condition).in as unknown[]).map(String).includes(String(value))
    }
    if (condition && typeof condition === "object" && "not_in" in condition) {
      return Array.isArray(asMockDoc(condition).not_in) &&
        !(asMockDoc(condition).not_in as unknown[]).map(String).includes(String(value))
    }
    if (condition && typeof condition === "object" && "exists" in condition) {
      return asMockDoc(condition).exists === true
        ? value != null
        : value == null
    }
    return value === condition
  })
}

const createPayloadStub = () => {
  let nextId = 1
  const store: Store = {
    "intake-submissions": [],
    "site-generation-runs": [],
    tenants: [],
    pages: [],
    "site-settings": [],
    "published-site-snapshots": [],
    orders: [],
    "agreement-acceptances": [],
    "checkout-profiles": [],
    "payment-attempts": [],
    "billing-agreements": [],
    "accounting-documents": [],
    "managed-domains": [],
    "commerce-notification-deliveries": [],
    "communication-preferences": [],
    "communication-preference-events": [],
    users: [],
    media: [],
  }
  const payload = {
    auth: vi.fn(async () => ({ user: null })),
    find: vi.fn(async (args: MockFindArgs) => {
      const docs = (store[args.collection as CollectionName] ?? []).filter((doc: MockDoc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    }),
    create: vi.fn(async (args: MockCreateArgs) => {
      const now = new Date().toISOString()
      const data = args.data
      const doc = storedValue({ ...data, id: nextId++, createdAt: now, updatedAt: now })
      const docs = store[args.collection as CollectionName]
      docs.unshift(doc as MockDoc)
      return doc
    }),
    findByID: vi.fn(async (args: MockFindArgs & { id?: number | string }) => {
      const doc = (store[args.collection as CollectionName] ?? []).find((entry: MockDoc) => String(entry.id) === String(args.id))
      if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
      return doc
    }),
    update: vi.fn(async (args: MockUpdateArgs & { where?: MockWhere }) => {
      const docs = store[args.collection as CollectionName] ?? []
      if (args.where) {
        const updated = docs.filter((doc) => matchesWhere(doc, args.where))
        for (const doc of updated) {
          Object.assign(doc, args.data, { updatedAt: new Date().toISOString() })
        }
        return { docs: updated, totalDocs: updated.length }
      }
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const existing = docs[index]!
      docs[index] = storedValue({ ...existing, ...args.data, id: existing.id, updatedAt: new Date().toISOString() }) as MockDoc
      return docs[index]
    }),
    jobs: { queue: vi.fn(async () => ({ id: 1 })) },
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { payload: asPayload(payload), store }
}

const installProviderFetch = () => {
  let cloudflareZoneCreated = false
  let openproviderDomainRegistered = false
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (
      url.startsWith("https://www.siteinabox.nl/theme/images/")
      || url === "https://www.siteinabox.nl/og-default.png"
      || url.startsWith("https://images.unsplash.com/")
      || url.startsWith("https://cdn.jsdelivr.net/")
    ) {
      return new Response(new Uint8Array([0x53, 0x49, 0x41, 0x42]), { status: 200 })
    }
    if (url === "https://api.mollie.com/v2/customers") {
      return new Response(JSON.stringify({ id: "cst_flow_123", name: "Flow Demo", email: "demo@example.com" }), { status: 201 })
    }
    if (url === "https://api.mollie.com/v2/payments") {
      return new Response(JSON.stringify({
        id: "tr_flow_123",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        metadata: {
          generationRunId: 2,
          tenantId: 3,
          customerEmail: "demo@example.com",
          clientSlug: "flow-demo",
          selectedDomain: "flow-live.nl",
          mollieCustomerId: "cst_flow_123",
          sequenceType: "first",
          renewalInterval: "1 month",
        },
        _links: { checkout: { href: "https://www.mollie.com/checkout/flow" } },
      }), { status: 201 })
    }
    if (url.includes("api.openprovider.eu/v1beta/auth/login")) {
      return new Response(JSON.stringify({ data: { token: "op-token" } }), { status: 200 })
    }
    if (url.includes("api.openprovider.eu/v1beta/domains/check")) {
      return new Response(JSON.stringify({
        data: {
          results: [{
            domain: "flow-live.nl",
            status: "available",
            price: { product: { price: { create: "8.00" }, currency: "EUR" } },
          }],
        },
      }), { status: 200 })
    }
    if (url.includes("api.openprovider.eu/v1beta/customers")) {
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ data: { results: [] } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: { handle: "OWNER-FLOW" } }), { status: 200 })
    }
    if (url.includes("api.openprovider.eu/v1beta/domains")) {
      if (init?.method === "GET") {
        return new Response(JSON.stringify({
          data: {
            results: openproviderDomainRegistered
              ? [{
                  id: 9100,
                  domain: { name: "flow-live", extension: "nl" },
                  status: "ACT",
                  owner_handle: "OWNER-FLOW",
                  name_servers: [
                    { name: "ada.ns.cloudflare.com" },
                    { name: "bob.ns.cloudflare.com" },
                  ],
                  autorenew: "on",
                  verification_email_status: "not applicable",
                }]
              : [],
          },
        }), { status: 200 })
      }
      openproviderDomainRegistered = true
      return new Response(JSON.stringify({ code: 0, data: { id: 9100, status: "ACT" } }), { status: 200 })
    }
    if (url.includes("dns_records")) {
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        success: true,
        result: { id: "record_flow", name: "flow-live.nl", content: "renderer.siteinabox.nl", proxied: true },
      }), { status: 200 })
    }
    if (url.includes("/email/sending/subdomains/subdomain_flow")) {
      return new Response(JSON.stringify({
        success: true,
        result: {
          enabled: true,
          name: "mail.flow-live.nl",
          tag: "subdomain_flow",
          dkim_selector: "cf-bounce",
          return_path_domain: "cf-bounce.mail.flow-live.nl",
        },
      }), { status: 200 })
    }
    if (url.endsWith("/email/sending/subdomains")) {
      return new Response(JSON.stringify({
        success: true,
        result: [{
          enabled: true,
          name: "mail.flow-live.nl",
          tag: "subdomain_flow",
          dkim_selector: "cf-bounce",
          return_path_domain: "cf-bounce.mail.flow-live.nl",
        }],
      }), { status: 200 })
    }
    if (url.includes("/ssl/verification")) {
      return new Response(JSON.stringify({
        success: true,
        result: [{ certificate_status: "active" }],
      }), { status: 200 })
    }
    if (url.includes("api.cloudflare.com/client/v4/zones?") && !url.includes("dns_records")) {
      return new Response(JSON.stringify({
        success: true,
        result: cloudflareZoneCreated
          ? [{
              id: "zone_flow",
              name: "flow-live.nl",
              status: "active",
              name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
            }]
          : [],
      }), { status: 200 })
    }
    if (url.includes("api.cloudflare.com/client/v4/zones") && !url.includes("dns_records")) {
      cloudflareZoneCreated = true
      return new Response(JSON.stringify({
        success: true,
        result: {
          id: "zone_flow",
          name: "flow-live.nl",
          status: "active",
          name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
        },
      }), { status: 200 })
    }
    throw new Error(`Unexpected fetch ${url}`)
  }))
}

describe("intake-to-live mocked flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "production")
    vi.stubEnv(
      "COMMERCE_RELEASE_EVIDENCE_VERSION",
      "commerce-production-readiness-2026-07-29.1",
    )
    vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED", "1")
    vi.stubEnv("COMMERCE_ORIGIN_ISOLATION_VERIFIED", "1")
    vi.stubEnv("OPENPROVIDER_API_BASE_URL", "https://api.openprovider.eu/v1beta")
    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://api.cloudflare.com/client/v4")
    vi.stubEnv("SITE_URL", "https://admin.siteinabox.nl")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_ADMIN_HANDLE", "ADMIN-NL")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv(
      "DOMAIN_MIGRATION_ENCRYPTION_KEY",
      Buffer.alloc(32, 1).toString("base64"),
    )
    vi.stubEnv(
      "CLOUDFLARE_RENDERER_TUNNEL_ID",
      "11111111-1111-4111-8111-111111111111",
    )
    vi.stubEnv(
      "CLOUDFLARE_CMS_TUNNEL_ID",
      "22222222-2222-4222-8222-222222222222",
    )
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
    installProviderFetch()
  })

  it("stores intake, generates draft CMS data, records checkout, activates, and requests final handoff", async () => {
    const { payload, store } = createPayloadStub()
    mocks.getPayload.mockResolvedValue(payload)

    const response = await intakePOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(richIntake()),
    })))
    const body = await response.json()
    expect(response.status).toBe(202)
    expect(body.status).toBe("preview_ready")
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(6)
    expect(store.media.map((entry) => entry.filename).sort()).toEqual([
      "smoke-analytics-desk.jpg",
      "smoke-cta-mobile.png",
      "smoke-logo-aws.svg",
      "smoke-logo-docker.svg",
      "smoke-logo-github.svg",
      "smoke-logo-nextjs.svg",
      "smoke-logo-nodejs.svg",
      "smoke-logo-react.svg",
      "smoke-logo-slack.svg",
      "smoke-logo-vercel.svg",
      "smoke-office-interior.jpg",
      "smoke-portrait-a.jpg",
      "smoke-portrait-b.jpg",
      "smoke-portrait-c.jpg",
      "smoke-portrait-d.jpg",
      "smoke-portrait-professional.jpg",
      "smoke-team-collaboration.jpg",
      "smoke-workshop-session.jpg",
    ])
    expect(store.pages.some((page) => page.slug === "privacy-en-cookieverklaring")).toBe(true)

    const pages = store.pages
    const tenants = store.tenants
    const runs = store["site-generation-runs"]
    const snapshots = store["published-site-snapshots"]

    for (const page of pages) {
      await payload.update(updateArgs("pages", relationId({ id: page.id as number | string }), { status: "published" }, { depth: 0, overrideAccess: true }))
    }

    let run = asGenerationRun(runs[0]!)
    const domain = await checkAndRecordPreviewDomainOrder(
      payload,
      run,
      "flow-live.nl",
      registrant,
      { capabilityEffectiveAt: "2026-07-28T14:59:59.999Z" },
    )
    run = asGenerationRun(domain.run)
    run = asGenerationRun(await payload.update(updateArgs("site-generation-runs", run.id!, {
      clientApproval: { status: "approved", approvedAt: "2026-07-02T09:00:00.000Z" },
    }, { depth: 0, overrideAccess: true })))

    const checkoutProfile = await payload.create(createArgs("checkout-profiles", {
      profileKey: `run:${run.id}:checkout-profile:1`,
      profileVersion: 1,
      generationRun: run.id,
      tenant: tenants[0]!.id,
      customerName: "Demo Contact",
      firstName: "Demo",
      lastName: "Contact",
      customerEmail: "demo@example.com",
      partyType: "registered_business",
      contractingPartyName: "Flow Demo",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: {
        street: "Stationsplein",
        number: "1",
        suffix: null,
        zipcode: "6041GN",
        city: "Roermond",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "06",
        phoneSubscriberNumber: "12345678",
      },
      createdAt: "2026-07-02T09:00:00.000Z",
    }, { overrideAccess: true }))
    const order = await payload.create(createArgs("orders", {
      orderNumber: "SIAB-FLOW-001",
      generationRun: run.id,
      tenant: tenants[0]!.id,
      orderKind: "initial_subscription",
      state: "accepted",
      checkoutProfileKey: asMockDoc(checkoutProfile).profileKey,
      catalogVersion: "2026-07-26.1",
      packageCode: "siteinabox-monthly",
      billingPeriod: "monthly",
      customerName: "Demo Contact",
      customerEmail: "demo@example.com",
      companyName: "Flow Demo",
      billingAddress: { country: "NL" },
      domainRegistrant: {
        companyName: "Flow Demo",
        firstName: "Demo",
        lastName: "Contact",
        email: "demo@example.com",
        street: "Stationsplein",
        number: "1",
        suffix: null,
        zipcode: "6041GN",
        city: "Roermond",
        country: "NL",
        state: null,
        phoneCountryCode: "+31",
        phoneAreaCode: "06",
        phoneSubscriberNumber: "12345678",
        locale: "nl_NL",
      },
      quoteEvidence: {
        tldCapability: {
          tld: "nl",
          capabilityVersion: "tld-nl-2026-07-28.1",
          effectiveFrom: "2026-07-28T00:00:00.000Z",
        },
      },
      domain: "flow-live.nl",
      subtotalNetMinor: 41_240,
      vatAmountMinor: 8_660,
      totalGrossMinor: 49_900,
      subtotalNet: 412.4,
      vatAmount: 86.6,
      totalGross: 499,
      netLineItems: [{
        code: "siteinabox-monthly",
        description: "Siteinabox maandabonnement",
        quantity: 1,
        netAmountMinor: 41_240,
      }],
      lineItems: [],
      currency: "EUR",
      paymentStatus: "pending",
    }, { overrideAccess: true }))
    await payload.create(createArgs("agreement-acceptances", {
      order: order.id,
      tenant: tenants[0]!.id,
      actorEmail: "demo@example.com",
      acceptanceVersion: "platform-terms-2026-07-07",
    }, { overrideAccess: true }))

    const checkout = await createMollieCheckoutForGenerationRun(payload, {
      runId: relationId(run),
      customerEmail: "demo@example.com",
      clientSlug: "flow-demo",
      selectedDomain: "flow-live.nl",
      actor: "demo@example.com",
      orderId: relationId(order),
    })
    expect(checkout.checkoutUrl).toBe("https://www.mollie.com/checkout/flow")

    const synchronized = await applyMollieWebhookPayment(payload, "tr_flow_123", async () => ({
      id: "tr_flow_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_flow_123",
      mandateId: "mdt_flow_123",
      sequenceType: "first",
      paidAt: "2026-07-02T09:05:00.000Z",
      metadata: {
        paymentAttemptId: checkout.paymentAttempt.id,
        billingAgreementId: checkout.billingAgreement.id,
        idempotencyKey: checkout.paymentAttempt.idempotencyKey,
        purpose: "first_payment",
        generationRunId: run.id,
        tenantId: tenants[0]!.id,
        customerEmail: "demo@example.com",
        clientSlug: "flow-demo",
        selectedDomain: "flow-live.nl",
        mollieCustomerId: "cst_flow_123",
        sequenceType: "first",
        renewalInterval: "1 month",
        orderId: order.id,
      },
    }))
    expect(synchronized.fulfillmentRequired).toBe(true)
    const initialFulfillment = await fulfillPaidOrder(payload, {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    })
    expect(initialFulfillment.status).toBe("waiting")
    expect(store["managed-domains"][0]).toMatchObject({
      edgeRoutingStatus: "pending",
      httpsStatus: "pending",
      adminHttpsStatus: "pending",
    })

    const tunnel = (kind: "renderer" | "cms") => ({
      tunnel: {
        id: kind === "renderer"
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222",
        name: `siteinabox-${kind}`,
        status: "healthy" as const,
        remotelyManaged: true,
        raw: null,
      },
      ingress: [{ service: "http_status:404" as const }],
      configurationVersion: 1,
      connected: true,
      changed: true,
    })
    await expect(reconcileCommerceEdgeRouting(payload, {
      now: () => "2026-07-02T09:06:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => tunnel(kind)),
      buildDnsRecords: vi.fn(() => [
        {
          type: "CNAME" as const,
          name: "flow-live.nl",
          content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
          ttl: 1,
          proxied: true,
        },
        {
          type: "CNAME" as const,
          name: "www.flow-live.nl",
          content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
          ttl: 1,
          proxied: true,
        },
        {
          type: "CNAME" as const,
          name: "admin.flow-live.nl",
          content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
          ttl: 1,
          proxied: true,
        },
      ]),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
      reconcileDnsRecord: vi.fn(async (_zoneId, record) => ({
        id: `edge-${record.name}`,
        ...record,
        raw: null,
        ownershipDisposition: "created" as const,
      })),
      getHostnameCertificate: vi.fn(async (_zoneId, hostname) => ({
        hostname,
        universalSslEnabled: true,
        covered: true,
        certificateStatuses: ["active"],
        raw: null,
      })),
      verifyHttps: vi.fn(async () => ({
        status: "verified" as const,
        httpStatus: 200,
        reason: null,
      })),
    })).resolves.toMatchObject({ active: 1 })

    const fulfillment = await fulfillPaidOrder(payload, {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    })
    expect(fulfillment.status).toBe("fulfilled")
    const handoffDelivery = store["commerce-notification-deliveries"].find(
      (delivery) => delivery.kind === "site_live_handoff",
    )
    expect(handoffDelivery).toMatchObject({
      recipient: "demo@example.com",
      status: "queued",
    })
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
    await expect(deliverCommerceNotification({
      payload,
      deliveryId: handoffDelivery!.id as string | number,
    })).resolves.toBe("sent")

    const tenant = tenants[0]!
    const finalRun = runs[0]!
    expect(finalRun.errors).toMatchObject({
      postPaymentAutomation: {
        status: "activated",
        step: "publish_activate",
      },
    })
    expect(snapshots).toHaveLength(1)
    const snapshot = snapshots[0]!

    expect(tenant).toMatchObject({
      domain: "flow-live.nl",
      status: "active",
      activeSnapshot: snapshot.id,
      domainVerification: expect.objectContaining({ status: "verified" }),
      emailSending: expect.objectContaining({
        provider: "cloudflare",
        status: "verified",
        senderEmail: "noreply@mail.flow-live.nl",
      }),
    })
    expect(finalRun.payment).toMatchObject({
      status: "completed",
      mollieSubscriptionId: null,
      selectedDomain: "flow-live.nl",
    })
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/subscriptions"))).toBe(false)
    expect(finalRun.errors).toMatchObject({
      postPaymentAutomation: {
        status: "activated",
        step: "publish_activate",
        snapshotId: snapshot.id,
      },
    })
    expect(snapshot).toMatchObject({
      status: "active",
      domain: "flow-live.nl",
      sourceGenerationRun: run.id,
    })
    expect(snapshot.snapshot).toMatchObject({
      domain: "flow-live.nl",
      siteUrl: "https://flow-live.nl",
      settings: expect.objectContaining({ siteUrl: "https://flow-live.nl" }),
    })
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "demo@example.com",
        callbackURL: "https://admin.flow-live.nl",
        metadata: expect.objectContaining({
          intent: "site_live_handoff",
          siteUrl: "https://flow-live.nl",
          adminUrl: "https://admin.flow-live.nl",
        }),
      }),
    }))
  })
})
