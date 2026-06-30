import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("customer preview UI", () => {
  it("uses a dedicated customer preview canvas mode without editor metadata badges", () => {
    const customizer = read("src/components/preview/PreviewCustomizer.tsx")

    expect(customizer).toContain('view: "preview"')
    expect(customizer).toContain('view="preview"')
    expect(customizer).toContain('variant="success"')
    expect(customizer).toContain('variant="secondary" disabled')
    expect(customizer).toContain('t("paymentComplete")')
    expect(customizer).toContain("grid w-full grid-cols-2")
    expect(customizer).toContain("sm:flex sm:w-auto")
    expect(customizer).toContain("reviewHref")
    expect(customizer).not.toContain("stylesReady")
    expect(customizer).not.toContain("pagesNav")
  })

  it("guards customer preview media with preview grants instead of making tenant media public", () => {
    const route = read("src/app/(payload)/siab-media/[tenantId]/[...path]/route.ts")
    const access = read("src/lib/preview/previewAccess.ts")

    expect(route).toContain("previewAuth.api.getSession")
    expect(route).toContain("hasActivePreviewGrantForTenant")
    expect(route).toContain("isPreviewMediaHost")
    expect(access).toContain("hasActivePreviewGrantForTenant")
  })

  it("exposes a guarded review route and stores customer notes on the current preview run", () => {
    const page = read("src/app/(frontend)/(site-preview)/[clientSlug]/review/page.tsx")
    const action = read("src/app/(frontend)/(site-preview)/[clientSlug]/review/actions.ts")
    const review = read("src/components/preview/PreviewReview.tsx")

    expect(page).toContain("isPreviewHost")
    expect(page).toContain("previewAuth.api.getSession")
    expect(action).toContain("clientApproval")
    expect(action).toContain("reviewNotes")
    expect(review).toContain("Textarea")
  })

  it("renders checkout as a branded two-step flow with domain fee states", () => {
    const checkout = read("src/components/preview/PreviewCheckout.tsx")
    const page = read("src/app/(frontend)/(site-preview)/[clientSlug]/checkout/page.tsx")

    expect(checkout).toContain('type CheckoutStep = "domain" | "payment"')
    expect(checkout).toContain("CheckoutStepper")
    expect(checkout).toContain("grid-cols-2")
    expect(checkout).not.toContain('id: "details"')
    expect(checkout).toContain('src="/logos/logo-light.svg"')
    expect(checkout).toContain('src="/logos/logo-dark.svg"')
    expect(checkout).toContain("checkoutDomainExtraFeeInline")
    expect(checkout).toContain("domainReady")
    expect(checkout).toContain("CheckoutActionBar")
    expect(checkout).toContain("checkoutDomainOccupied")
    expect(checkout).toContain("border-warning")
    expect(checkout).toContain("bg-warning")
    expect(checkout).toContain('variant="success"')
    expect(checkout).toContain("formatDomainHolderName")
    expect(checkout).not.toContain("checkoutSecureBadge")
    expect(checkout).not.toContain("checkoutDescription")
    expect(checkout).not.toContain("checkoutTotalBadge")
    expect(checkout).not.toContain("checkoutDetailsOverviewTitle")
    expect(checkout).not.toContain("checkoutRenewalTitle")
    expect(checkout).not.toContain("checkoutEdit")
    expect(checkout).not.toContain("Pencil")
    expect(checkout).not.toContain("checkoutSummaryTitle")
    expect(page).toContain("deriveRegistrantDefaults")
    expect(page).toContain("registrant={registrant}")
    expect(page).toContain('domainReady={domainOrder.status === "ready_to_register"')
  })
})
