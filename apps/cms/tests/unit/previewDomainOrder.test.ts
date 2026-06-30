import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/domains/openprovider", () => ({
  checkOpenProviderDomainAvailability: vi.fn(),
}))

import { checkOpenProviderDomainAvailability } from "@/lib/domains/openprovider"
import { checkAndRecordPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"

describe("preview domain order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "228.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "7.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
  })

  it("suggests only available alternative domains within the provider cost cap", async () => {
    const run = {
      id: 123,
      domainOrder: null,
    }
    const payload = {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }

    vi.mocked(checkOpenProviderDomainAvailability).mockImplementation(async (domain: string) => {
      if (domain === "acme.nl") {
        return {
          status: "unavailable",
          domain,
          available: false,
          premium: false,
          price: null,
          internalReason: null,
        }
      }
      if (domain === "acmesite.nl") {
        return {
          status: "available",
          domain,
          available: true,
          premium: false,
          price: { amount: "5.95", currency: "EUR" },
          internalReason: null,
        }
      }
      if (domain === "acme-online.nl") {
        return {
          status: "available",
          domain,
          available: true,
          premium: false,
          price: { amount: "6.50", currency: "EUR" },
          internalReason: null,
        }
      }
      return {
        status: "available",
        domain,
        available: true,
        premium: false,
        price: { amount: "8.00", currency: "EUR" },
        internalReason: null,
      }
    })

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "acme.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainUnavailable",
      domain: "acme.nl",
      suggestions: ["acmesite.nl", "acme-online.nl"],
    })
    expect(run.domainOrder).toMatchObject({
      status: "unavailable",
      domain: "acme.nl",
      maxProviderPriceAmount: "7.00",
      maxProviderPriceCurrency: "EUR",
    })
  })
})
