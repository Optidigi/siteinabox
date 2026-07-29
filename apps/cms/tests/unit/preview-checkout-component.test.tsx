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

const quote = (billingPeriod: "monthly" | "annual") => {
  const netAmountMinor = billingPeriod === "annual" ? 19_000 : 1_900
  const vatAmountMinor = billingPeriod === "annual" ? 3_990 : 399
  return {
    token: `signed-${billingPeriod}`,
    quote: {
      schemaVersion: 3 as const,
      catalogVersion: "2026-07-26.1",
      packageCode: `siteinabox-${billingPeriod}`,
      billingPeriod,
      lineItems: [],
      domainIncludedAllowanceNetMinor: 1_000,
      providerOperationPriceNetMinor: 1_000,
      domainSurchargeNetMinor: 0,
      migrationServiceFeeNetMinor: 0,
      migrationClassification: null,
      migrationSourceMechanism: null,
      migrationSourceZoneHash: null,
      migrationInputEnvelope: null,
      migrationSecretKey: null,
      planPriceNetMinor: netAmountMinor,
      vatRateBasisPoints: 2_100 as const,
      futureSubscriptionNetMinor: netAmountMinor,
      futureSubscriptionVatMinor: vatAmountMinor,
      futureSubscriptionGrossMinor: netAmountMinor + vatAmountMinor,
      selectedDomain: "analytical-engines.nl",
      domainMode: "new_registration" as const,
      providerQuotedAt: "2026-07-28T10:00:00.000Z",
      quoteIssuedAt: "2026-07-28T10:00:00.000Z",
      quoteExpiresAt: "2026-07-28T10:15:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-1",
      domainRenewalExplanation: "renewal",
      currency: "EUR" as const,
      netAmountMinor,
      vatAmountMinor,
      grossAmountMinor: netAmountMinor + vatAmountMinor,
    },
  }
}

describe("PreviewCheckout Phase 3 flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })))
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  it("exposes three named steps and submits no registrant identity in the final hidden form", async () => {
    const saveProfileAction = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: "invalid" as const,
        message: "invalid details",
        fieldErrors: {
          firstName: "First name is required",
          lastName: "Last name is required",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: "saved" as const,
        message: "saved",
        profile,
      })
    const { container } = render(
      <PreviewCheckout
        customerEmail="owner@example.test"
        currentDomain="analytical-engines.nl"
        domainReady
        initialProfile={profile}
        initialDetails={profile}
        initialQuotes={{ monthly: quote("monthly"), annual: quote("annual") }}
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
    const errorSummary = await screen.findByLabelText("checkoutErrorSummaryLabel")
    await waitFor(() => expect(document.activeElement).toBe(errorSummary))
    const firstError = screen.getByRole("link", { name: "First name is required" })
    fireEvent.click(firstError)
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByLabelText("checkoutFirstName"),
    ))
    fireEvent.submit(profileForm!)
    await waitFor(() => expect(saveProfileAction).toHaveBeenCalledTimes(2))
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
    expect((paymentForm?.querySelector('[name="checkoutQuoteToken"]') as HTMLInputElement).value)
      .toBe("signed-annual")

    fireEvent.click(screen.getByRole("button", { name: "checkoutStepDomain" }))
    const domainHeading = await screen.findByRole("heading", { name: "checkoutDomainTitle" })
    expect(document.activeElement).toBe(domainHeading)
    fireEvent.click(screen.getByRole("button", { name: "checkoutStepDetails" }))
    expect(document.activeElement).toBe(
      await screen.findByRole("heading", { name: "checkoutDetailsTitle" }),
    )
    fireEvent.click(screen.getByRole("button", {
      name: "checkoutStepSubscriptionOverview",
    }))
    expect(document.activeElement).toBe(
      await screen.findByRole("heading", {
        name: "checkoutSubscriptionOverviewTitle",
      }),
    )
  })

  it("keeps existing-domain migration fail-closed and exposes its authorized source inputs only when enabled", async () => {
    const checkDomainAction = vi.fn().mockResolvedValue({
      ok: true,
      status: "preflight_complete" as const,
      domain: "example.nl",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationClassification: null,
      migrationPreflightOnly: true,
      migrationPublicEvidence: {
        checkedAt: "2026-07-29T12:00:00.000Z",
        authoritativeNameservers: ["ns1.example.test", "ns2.example.test"],
        dnssecDsPresent: true,
        dnssecDsRecords: ["12345 13 2 " + "AB".repeat(32)],
        dnssecDsTtl: 3600,
        probableDnsProvider: "Example DNS",
        registrar: "Example Registrar",
        supplementalOnly: true as const,
      },
      message: "Nothing has been transferred or ordered.",
    })
    const commonProps = {
      customerEmail: "owner@example.test",
      currentDomain: null,
      domainReady: false,
      initialProfile: profile,
      initialDetails: profile,
      initialQuotes: null,
      enabledMigrationSourceMethods: [
        "cloudflare_api_v1" as const,
        "authorized_axfr_v1" as const,
        "validated_provider_export_v1" as const,
      ],
      catalog: {
        version: "2026-07-26.1",
        currency: "EUR" as const,
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
      },
      paymentStatus: "not_started",
      previewHref: "/ami-care",
      prewarmHref: "/ami-care/checkout/prewarm",
      suggestionsHref: "/ami-care/checkout/suggestions",
      checkDomainAction,
      saveProfileAction: vi.fn(),
      startPaymentAction: vi.fn(),
      termsHref: "https://www.siteinabox.nl/voorwaarden",
      privacyHref: "https://www.siteinabox.nl/privacy",
      termsVersion: "2026-07-07.1",
      privacyVersion: "2026-07-18.1",
      businessUseDeclarationVersion: "business-use-declaration-2026-07-26.1",
      businessUseDeclarationText: "Ik sluit deze overeenkomst uitsluitend zakelijk.",
      locale: "nl-NL",
    }
    const preflightOnly = render(<PreviewCheckout {...commonProps} />)
    const preflightMode = screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }) as HTMLInputElement
    expect(preflightMode.disabled).toBe(false)
    fireEvent.click(preflightMode)
    expect(screen.queryByLabelText("checkoutMigrationZoneExportLabel")).toBeNull()
    expect(screen.queryByLabelText("checkoutMigrationTransferCodeLabel")).toBeNull()
    expect(screen.getByText("checkoutDomainModeExistingPreflight")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("checkoutDomainLabel"), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      document.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )
    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(1))
    expect((await screen.findByRole("status")).textContent).toContain(
      "ns1.example.test, ns2.example.test",
    )
    expect(
      (screen.getByText("checkoutMigrationPreflightNoOrder") as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(screen.queryByRole("button", { name: "checkoutNext" })).toBeNull()
    expect(screen.queryByText("checkoutDomainAvailableDetail")).toBeNull()
    preflightOnly.unmount()

    const { container } = render(
      <PreviewCheckout {...commonProps} existingDomainMigrationEnabled />,
    )
    const existingMode = screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    })
    expect((existingMode as HTMLInputElement).disabled).toBe(false)
    fireEvent.click(existingMode)
    fireEvent.change(screen.getByLabelText("checkoutDomainLabel"), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )
    await screen.findByText("checkoutMigrationSourceLegend")
    expect(screen.queryByLabelText("checkoutMigrationZoneExportLabel")).toBeNull()
    fireEvent.click(screen.getByRole("radio", {
      name: "checkoutMigrationSourceExport",
    }))
    expect((screen.getByLabelText(
      "checkoutMigrationZoneExportLabel",
    ) as HTMLInputElement).type).toBe("file")
    expect((screen.getByLabelText(
      "checkoutMigrationTransferCodeLabel",
    ) as HTMLInputElement).type).toBe("password")
    expect(screen.queryByRole("radio", {
      name: "checkoutMigrationAutomaticChoice",
    })).toBeNull()
    expect(screen.queryByRole("radio", {
      name: "checkoutMigrationAssistedChoice",
    })).toBeNull()
    expect(screen.queryByText("checkoutMigrationAssistedChoice")).toBeNull()
    expect(screen.getByText("checkoutMigrationTransferAuthorization")).toBeTruthy()
    expect(
      container.querySelector<HTMLInputElement>(
        '#checkout-domain-form input[name="domainMode"]',
      )?.value,
    ).toBe("existing_domain")
    expect(container.querySelector('input[type="hidden"][name="transferCode"]'))
      .toBeNull()
  })
})
