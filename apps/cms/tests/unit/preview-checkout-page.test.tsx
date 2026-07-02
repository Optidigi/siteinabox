import { describe, expect, it, vi } from "vitest"
import type { ComponentProps } from "react"
import type { PreviewCheckout } from "@/components/preview/PreviewCheckout"

const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  isPreviewHost: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  checkDomainAction: vi.fn(),
  startPaymentAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "nl-NL"),
  getTranslations: vi.fn(async () => (key: string) => key),
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found")
  }),
}))

vi.mock("@/components/preview/PreviewCheckout", () => ({
  PreviewCheckout: vi.fn(() => null),
}))

vi.mock("@/components/preview/PreviewLoginShell", () => ({
  PreviewLoginShell: vi.fn(() => null),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/preview/previewHost", () => ({
  isPreviewHost: mocks.isPreviewHost,
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadPreviewGrantContext: mocks.loadPreviewGrantContext,
  normalizePreviewClientSlug: (value: string) => value.trim().toLowerCase(),
}))

vi.mock("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions", () => ({
  checkPreviewCheckoutDomainAction: mocks.checkDomainAction,
  startPreviewCheckoutPaymentAction: mocks.startPaymentAction,
}))

type PreviewCheckoutProps = ComponentProps<typeof PreviewCheckout>

const baseContext = (overrides: Record<string, unknown> = {}) => ({
  customerEmail: "customer@example.com",
  clientSlug: "ami-care",
  tenant: {
    name: "Ami Care",
    domain: "ami-care.siteinabox.test",
  },
  run: {
    id: 123,
    payment: null,
    clientApproval: null,
    domainOrder: null,
    ...overrides,
  },
})

async function renderCheckoutProps(overrides: Record<string, unknown> = {}): Promise<PreviewCheckoutProps> {
  vi.clearAllMocks()
  mocks.isPreviewHost.mockResolvedValue(true)
  mocks.getSession.mockResolvedValue({ user: { email: "Customer@Example.com" } })
  mocks.loadPreviewGrantContext.mockResolvedValue(baseContext(overrides))

  const { default: PreviewCheckoutPage } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/page")
  const element = await PreviewCheckoutPage({
    params: Promise.resolve({ clientSlug: "AMI-CARE" }),
  })

  expect(element).toBeTruthy()
  return (element as { props: PreviewCheckoutProps }).props
}

describe("preview checkout page domain initialization", () => {
  it("does not initialize checkout from the tenant domain when no domain order is ready", async () => {
    const props = await renderCheckoutProps()

    expect(props.currentDomain).toBeNull()
    expect(props.domainReady).toBe(false)
  })

  it("initializes checkout only from a ready domain order domain", async () => {
    const props = await renderCheckoutProps({
      domainOrder: {
        status: "ready_to_register",
        domain: "customer-selected.nl",
      },
    })

    expect(props.currentDomain).toBe("customer-selected.nl")
    expect(props.domainReady).toBe(true)
  })
})
