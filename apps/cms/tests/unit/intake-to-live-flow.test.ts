import { beforeEach, describe, expect, it, vi } from "vitest"
import { checkAndRecordPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"
import { createMollieCheckoutForGenerationRun, applyMollieWebhookPayment } from "@/lib/payments/molliePayments"
import { POST as intakePOST } from "@/app/(payload)/api/intake/route"

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
  | "communication-preferences"
  | "communication-preference-events"
  | "users"
  | "media"

type Store = Record<CollectionName, any[]>

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

const valueAtPath = (doc: any, path: string): unknown =>
  path.split(".").reduce((current, part) => {
    if (current == null) return undefined
    if (Array.isArray(current)) return undefined
    return current[part]
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
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, storedValue(entry)]),
  )
}

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  if (where.or) return where.or.some((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    const value = valueAtPath(doc, field)
    if (condition && typeof condition === "object" && "equals" in condition) {
      return sameRelation(value, (condition as any).equals)
    }
    if (condition && typeof condition === "object" && "in" in condition) {
      return Array.isArray((condition as any).in) && (condition as any).in.map(String).includes(String(value))
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
    "communication-preferences": [],
    "communication-preference-events": [],
    users: [],
    media: [],
  }
  const payload = {
    auth: vi.fn(async () => ({ user: null })),
    find: vi.fn(async (args: any) => {
      const docs = (store[args.collection as CollectionName] ?? []).filter((doc: any) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    }),
    create: vi.fn(async (args: any) => {
      const now = new Date().toISOString()
      const doc = storedValue({ ...args.data, id: nextId++, createdAt: now, updatedAt: now })
      const docs = store[args.collection as CollectionName]
      docs.unshift(doc)
      return doc
    }),
    findByID: vi.fn(async (args: any) => {
      const doc = (store[args.collection as CollectionName] ?? []).find((entry: any) => String(entry.id) === String(args.id))
      if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
      return doc
    }),
    update: vi.fn(async (args: any) => {
      const docs = store[args.collection as CollectionName] ?? []
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const existing = docs[index]!
      docs[index] = storedValue({ ...existing, ...args.data, id: existing.id, updatedAt: new Date().toISOString() })
      return docs[index]
    }),
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { payload: payload as any, store }
}

const installProviderFetch = () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
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
    if (url.includes("api.mollie.com/v2/customers/cst_flow_123/subscriptions")) {
      return new Response(JSON.stringify({ id: "sub_flow_123", status: "active" }), { status: 201 })
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
      return new Response(JSON.stringify({ data: { handle: "OWNER-FLOW" } }), { status: 200 })
    }
    if (url.includes("api.openprovider.eu/v1beta/domains")) {
      return new Response(JSON.stringify({ code: 0, data: { id: 9100, status: "ACT" } }), { status: 200 })
    }
    if (url.includes("dns_records")) {
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
    if (url.includes("api.cloudflare.com/client/v4/zones") && !url.includes("dns_records")) {
      return new Response(JSON.stringify({
        success: true,
        result: {
          id: "zone_flow",
          name: "flow-live.nl",
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
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "499.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_AMOUNT", "49.00")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_CURRENCY", "EUR")
    vi.stubEnv("MOLLIE_SITE_SUBSCRIPTION_INTERVAL", "1 month")
    vi.stubEnv("SITE_URL", "https://admin.siteinabox.nl")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv("SIAB_RENDERER_TARGET_HOST", "renderer.siteinabox.nl")
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
    installProviderFetch()
  })

  it("stores intake, generates draft CMS data, records checkout, activates, and requests final handoff", async () => {
    const { payload, store } = createPayloadStub()
    mocks.getPayload.mockResolvedValue(payload)

    const response = await intakePOST(new Request("https://admin.siteinabox.nl/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(richIntake()),
    }) as any)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.status).toBe("preview_ready")
    expect(store["intake-submissions"]).toHaveLength(1)
    expect(store["site-generation-runs"]).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(2)
    expect(store.pages.some((page) => page.slug === "privacy-en-cookieverklaring")).toBe(true)

    const pages = store.pages
    const tenants = store.tenants
    const runs = store["site-generation-runs"]
    const snapshots = store["published-site-snapshots"]

    for (const page of pages) {
      await payload.update({
        collection: "pages",
        id: page.id,
        data: { status: "published" },
        depth: 0,
        overrideAccess: true,
      })
    }

    let run = runs[0]!
    const domain = await checkAndRecordPreviewDomainOrder(payload, run, "flow-live.nl", registrant)
    run = domain.run
    run = await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: {
        clientApproval: { status: "approved", approvedAt: "2026-07-02T09:00:00.000Z" },
      },
      depth: 0,
      overrideAccess: true,
    })

    const order = await payload.create({
      collection: "orders",
      data: {
        generationRun: run.id,
        tenant: tenants[0]!.id,
        customerEmail: "demo@example.com",
        domain: "flow-live.nl",
        totalGross: 499,
        currency: "EUR",
        paymentStatus: "pending",
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: "agreement-acceptances",
      data: {
        order: order.id,
        acceptanceVersion: "platform-terms-2026-07-07",
      },
      overrideAccess: true,
    })

    const checkout = await createMollieCheckoutForGenerationRun(payload, {
      runId: run.id,
      customerEmail: "demo@example.com",
      clientSlug: "flow-demo",
      selectedDomain: "flow-live.nl",
      actor: "demo@example.com",
      orderId: order.id,
    })
    expect(checkout.checkoutUrl).toBe("https://www.mollie.com/checkout/flow")

    await applyMollieWebhookPayment(payload, "tr_flow_123", async () => ({
      id: "tr_flow_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
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
      mollieSubscriptionId: "sub_flow_123",
      selectedDomain: "flow-live.nl",
    })
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
