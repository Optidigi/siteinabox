import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  capabilities: vi.fn(),
  check: vi.fn(),
}))

vi.mock("@siteinabox/contracts/tld-capabilities", () => ({
  productionTldCapabilitiesAt: mocks.capabilities,
}))
vi.mock("@/lib/domains/previewDomainOrder", () => ({
  checkPreviewDomainOrders: mocks.check,
}))

describe("preview domain discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.capabilities.mockReturnValue([
      { tld: "nl" }, { tld: "com" }, { tld: "info" }, { tld: "org" }, { tld: "eu" },
      { tld: "net" }, { tld: "be" }, { tld: "de" }, { tld: "online" }, { tld: "shop" },
    ])
    mocks.check.mockResolvedValue([{
      domain: "acme.nl", messageKey: "checkoutDomainAvailable", included: true,
      extraFeeAmount: null, extraFeeCurrency: null, providerQuotedAt: "2026-08-03T10:00:00.000Z",
      productionOperationEnabled: true,
    }])
  })

  it("derives a bounded primary batch on the server and returns no checkout state", async () => {
    const { searchPreviewDomains } = await import("@/lib/domains/previewDomainSearch")
    const signal = new AbortController().signal
    const response = await searchPreviewDomains({ run: { id: 1 } as never, query: "acme", mode: "primary", signal })

    expect(mocks.check).toHaveBeenCalledWith(
      { id: 1 }, ["acme.nl", "acme.com", "acme.info", "acme.org", "acme.eu"], null,
      { requireProductionCapability: false, signal },
    )
    expect(response).toEqual({
      hasMore: true,
      results: [{
        domain: "acme.nl", availability: "available", purchasable: true, included: true,
        extraFee: null, checkedAt: "2026-08-03T10:00:00.000Z",
      }],
    })
    expect(JSON.stringify(response)).not.toContain("quotes")
    expect(JSON.stringify(response)).not.toContain("profileVersion")
  })

  it("checks additional extensions only when explicitly requested", async () => {
    const { previewDomainSearchCandidates } = await import("@/lib/domains/previewDomainSearch")
    expect(previewDomainSearchCandidates("acme", "more")).toEqual(
      ["acme.net", "acme.be", "acme.de", "acme.online", "acme.shop"],
    )
  })
})
