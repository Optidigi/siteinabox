// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PreviewCheckout } from "@/components/preview/PreviewCheckout"

const translate = Object.assign(
  (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  {
    rich: (key: string) => key,
  },
)

vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}))

const profile = {
  profileKey: "run:500:checkout-profile:1",
  profileVersion: 1,
  customerEmail: "owner@example.test",
  customerName: "Ada Lovelace",
  contractingPartyName: "Analytical Engines B.V.",
  partyType: "registered_business" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  registeredBusinessName: "Analytical Engines B.V.",
  kvkNumber: "12345678",
  intendedCompanyName: "",
  street: "Markt",
  number: "1",
  suffix: "",
  zipcode: "1234AB",
  city: "Utrecht",
  country: "NL",
  phoneCountryCode: "+31",
  phoneAreaCode: "30",
  phoneSubscriberNumber: "1234567",
  supersedesProfileKey: null,
  revisionReason: "initial_capture" as const,
  actorEmail: "owner@example.test",
  sourceRequestId: "req-1",
  createdAt: "2026-07-26T12:00:00.000Z",
}

describe("PreviewCheckout Phase 3 flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })))
  })

  it("exposes three named steps and submits no registrant identity in the final hidden form", async () => {
    const saveProfileAction = vi.fn(async () => ({
      ok: true,
      status: "saved" as const,
      message: "saved",
      profile,
    }))
    const { container } = render(
      <PreviewCheckout
        customerEmail="owner@example.test"
        currentDomain="analytical-engines.nl"
        domainReady
        initialProfile={profile}
        initialDetails={profile}
        catalog={{
          version: "2026-07-26.1",
          currency: "EUR",
          vatRateBasisPoints: 2_100,
          plans: {
            monthly: { code: "siteinabox-monthly", netAmountMinor: 1_900 },
            annual: { code: "siteinabox-annual", netAmountMinor: 19_000 },
          },
          domainIncludedAllowanceNetMinor: 1_000,
          migrations: {
            automaticNetAmountMinor: 0,
            assistedStandardNetAmountMinor: 4_900,
          },
        }}
        paymentStatus="not_started"
        previewHref="/ami-care"
        prewarmHref="/ami-care/checkout/prewarm"
        suggestionsHref="/ami-care/checkout/suggestions"
        checkDomainAction={vi.fn()}
        saveProfileAction={saveProfileAction}
        startPaymentAction={vi.fn()}
        termsHref="https://www.siteinabox.nl/voorwaarden"
        privacyHref="https://www.siteinabox.nl/privacy"
        termsVersion="2026-07-07.1"
        privacyVersion="2026-07-18.1"
        businessUseDeclarationVersion="business-use-declaration-2026-07-26.1"
        businessUseDeclarationText="Ik sluit deze overeenkomst uitsluitend zakelijk."
        locale="nl-NL"
      />,
    )

    expect(screen.getByRole("listitem", { name: "checkoutStepDomain" }).getAttribute("aria-current"))
      .toBe("step")
    expect(screen.getByRole("listitem", { name: "checkoutStepDetails" })).toBeTruthy()
    expect(screen.getByRole("listitem", { name: "checkoutStepSubscriptionOverview" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "checkoutNext" }))
    const detailsHeading = await screen.findByRole("heading", { name: "checkoutDetailsTitle" })
    expect(document.activeElement).toBe(detailsHeading)
    expect((screen.getByRole("radio", { name: /checkoutPartyRegistered/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText("checkoutRegistrantEmail") as HTMLInputElement).readOnly).toBe(true)

    const profileForm = container.querySelector<HTMLFormElement>("#checkout-profile-form")
    expect(profileForm).not.toBeNull()
    fireEvent.submit(profileForm!)
    await waitFor(() => expect(saveProfileAction).toHaveBeenCalledTimes(1))
    const overviewHeading = await screen.findByRole("heading", { name: "checkoutSubscriptionOverviewTitle" })
    expect(document.activeElement).toBe(overviewHeading)
    expect(screen.getByText("Ik sluit deze overeenkomst uitsluitend zakelijk.")).toBeTruthy()

    const paymentForm = container.querySelector<HTMLFormElement>("#checkout-payment-form")
    expect((paymentForm?.querySelector('[name="expectedProfileKey"]') as HTMLInputElement).value)
      .toBe("run:500:checkout-profile:1")
    expect((paymentForm?.querySelector('[name="expectedProfileVersion"]') as HTMLInputElement).value)
      .toBe("1")
    expect(paymentForm?.querySelector('[name="registrantEmail"]')).toBeNull()
    expect(paymentForm?.querySelector('[name="companyName"]')).toBeNull()
    expect(paymentForm?.querySelector('[name="firstName"]')).toBeNull()
  })
})
