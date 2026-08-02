// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkoutStatusNeedsPolling,
  PreviewCheckout,
} from "@/components/preview/PreviewCheckout"
import type { PreviewCheckoutActionState } from "@/lib/checkout/previewCheckoutContract"

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
      schemaVersion: 4 as const,
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
      transferRenewalEffect: null,
      domainRenewalExplanation: "renewal",
      currency: "EUR" as const,
      netAmountMinor,
      vatAmountMinor,
      grossAmountMinor: netAmountMinor + vatAmountMinor,
    },
  }
}

const baseCheckoutProps = () => ({
  clientSlug: "ami-care",
  customerEmail: "owner@example.test",
  currentDomain: "analytical-engines.nl",
  domainReady: true,
  initialProfile: profile,
  initialDetails: profile,
  initialQuotes: { monthly: quote("monthly"), annual: quote("annual") },
  catalog: {
    version: "2026-07-26.1",
    currency: "EUR" as const,
    vatRateBasisPoints: 2_100,
    plans: {
      monthly: { code: "siteinabox-monthly", netAmountMinor: 1_900 },
      annual: { code: "siteinabox-annual", netAmountMinor: 19_000 },
    },
    domainIncludedAllowanceNetMinor: 1_000,
    migrations: { automaticNetAmountMinor: 0 },
  },
  paymentStatus: "not_started",
  previewHref: "/ami-care",
  prewarmHref: "/ami-care/checkout/prewarm",
  checkDomainAction: vi.fn(),
  saveProfileAction: vi.fn(),
  startPaymentAction: vi.fn(),
  termsHref: "https://www.siteinabox.nl/voorwaarden",
  privacyHref: "https://www.siteinabox.nl/privacy",
  termsVersion: "2026-07-07.1",
  privacyVersion: "2026-07-18.1",
  locale: "nl-NL",
})

describe("PreviewCheckout Phase 3 flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })))
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  it("lets a current release-pending recheck invalidate an older ready draft", async () => {
    const checkDomainAction = vi.fn(async (
      _state: unknown,
      formData: FormData,
    ) => ({
      ok: false,
      status: "release_pending" as const,
      domain: "analytical-engines.nl",
      domainMode: "new_registration" as const,
      message: "example.nl is available, but registration is not released.",
      requestToken: String(formData.get("requestToken") ?? ""),
    }))
    const { container } = render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        checkDomainAction={checkDomainAction}
      />,
    )

    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "analytical-engines.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(1))
    const status = await screen.findByRole("status")
    expect(status.textContent).toContain("checkoutDomainReleasePendingTitle")
    expect(status.textContent).toContain(
      "example.nl is available, but registration is not released.",
    )
    expect(screen.queryByRole("button", { name: "checkoutNext" })).toBeNull()
    expect(screen.queryByText(/checkoutDomainAvailableDetail/)).toBeNull()
  })

  it("starts the configured extension checks together and publishes their rows as one batch", async () => {
    const resolvers = new Map<string, (state: PreviewCheckoutActionState) => void>()
    const checkDomainAction = vi.fn((_state: unknown, formData: FormData) =>
      new Promise<PreviewCheckoutActionState>((resolve) => {
        resolvers.set(String(formData.get("domain")), resolve)
      }))
    const { container } = render(
      <PreviewCheckout {...baseCheckoutProps()} checkDomainAction={checkDomainAction} />,
    )

    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "acme" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(5))
    expect(checkDomainAction.mock.calls.map(([, formData]) =>
      String((formData as FormData).get("domain")))).toEqual([
      "acme.nl", "acme.com", "acme.info", "acme.org", "acme.eu",
    ])

    await act(async () => {
      resolvers.get("acme.nl")?.({
        ok: false,
        status: "unavailable",
        domain: "acme.nl",
        domainMode: "new_registration",
        message: "acme.nl is unavailable.",
      })
    })
    expect(container.querySelector('[data-domain-status="unavailable"]')).toBeNull()

    await act(async () => {
      for (const domain of ["acme.com", "acme.info", "acme.org", "acme.eu"]) {
        resolvers.get(domain)?.({
          ok: false,
          status: "unavailable",
          domain,
          domainMode: "new_registration",
          message: `${domain} is unavailable.`,
        })
      }
    })
    await waitFor(() => expect(
      container.querySelectorAll('[data-domain-status="unavailable"]'),
    ).toHaveLength(5))
  })

  it("falls back from an unavailable typed extension to the same name on configured extensions", async () => {
    const checkDomainAction = vi.fn(async (_state: unknown, formData: FormData) => {
      const domain = String(formData.get("domain"))
      return {
        ok: false,
        status: "unavailable" as const,
        domain,
        domainMode: "new_registration" as const,
        message: `${domain} is unavailable.`,
      }
    })
    const { container } = render(
      <PreviewCheckout {...baseCheckoutProps()} checkDomainAction={checkDomainAction} />,
    )

    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "taken.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(5))
    expect(checkDomainAction.mock.calls.map(([, formData]) =>
      String((formData as FormData).get("domain")))).toEqual([
      "taken.nl", "taken.com", "taken.info", "taken.org", "taken.eu",
    ])
  })

  it("shows the frozen transfer-renewal effect in the final review", () => {
    const monthly = quote("monthly")
    const annual = quote("annual")
    const existing = {
      monthly: {
        ...monthly,
        quote: {
          ...monthly.quote,
          domainMode: "existing_domain" as const,
          transferRenewalEffect: "unchanged" as const,
          domainRenewalExplanation:
            "De domeintransfer wijzigt de huidige verlengdatum niet.",
        },
      },
      annual: {
        ...annual,
        quote: {
          ...annual.quote,
          domainMode: "existing_domain" as const,
          transferRenewalEffect: "unchanged" as const,
          domainRenewalExplanation:
            "De domeintransfer wijzigt de huidige verlengdatum niet.",
        },
      },
    }
    render(<PreviewCheckout
      {...baseCheckoutProps()}
      initialQuotes={existing}
      initialStep="overview"
    />)

    expect(screen.getByText("checkoutTransferRenewalEffect")).toBeTruthy()
    expect(screen.getAllByText("checkoutTransferRenewalEffectUnchanged")).toHaveLength(2)
    expect(screen.getByText("checkoutDomainRenewalExplanationUnchanged")).toBeTruthy()
    expect(screen.queryByText(
      "De domeintransfer wijzigt de huidige verlengdatum niet.",
    )).toBeNull()
  })

  it("exposes two decisions and submits no registrant identity in the final hidden form", async () => {
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
        checkDomainAction={vi.fn()}
        saveProfileAction={saveProfileAction}
        startPaymentAction={vi.fn()}
        termsHref="https://www.siteinabox.nl/voorwaarden"
        privacyHref="https://www.siteinabox.nl/privacy"
        termsVersion="2026-07-07.1"
        privacyVersion="2026-07-18.1"
        locale="nl-NL"
      />,
    )

    expect(screen.getByRole("listitem", { name: "checkoutStepDomain" }).getAttribute("aria-current"))
      .toBe("step")
    expect(screen.getByRole("listitem", { name: "checkoutStepPayment" })).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)

    fireEvent.click(screen.getAllByRole("button", { name: "checkoutNext" })[0]!)
    const detailsHeading = await screen.findByRole("heading", { name: "checkoutReviewHeroTitle" })
    expect(document.activeElement).toBe(detailsHeading)
    expect(screen.getByText("Ada Lovelace")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "checkoutContactGroup Ada Lovelace", expanded: false }))
    expect(screen.getAllByText("owner@example.test")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", {
      name: "checkoutEdit checkoutContactGroup",
    }))
    await screen.findByRole("dialog")
    expect((screen.getByLabelText("checkoutFirstName") as HTMLInputElement).value).toBe("Ada")
    expect((screen.getByLabelText("checkoutRegistrantEmail") as HTMLInputElement).readOnly).toBe(true)

    const profileForm = document.querySelector<HTMLFormElement>("#checkout-profile-form")
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
    await screen.findByRole("heading", { name: "checkoutPlanTitle" })
    expect(document.activeElement).toBe(detailsHeading)

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
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    const previewApproval = paymentForm?.querySelector('[name="previewApproval"]') as HTMLInputElement
    expect(previewApproval.value).toBe("")
    fireEvent.click(container.querySelector("#checkout-preview-approval")!)
    expect(previewApproval.value).toBe("accepted")

    fireEvent.click(screen.getByRole("button", { name: "checkoutStepDomain" }))
    const domainHeading = await screen.findByRole("heading", { name: "checkoutDomainHeroTitle" })
    expect(document.activeElement).toBe(domainHeading)
    fireEvent.click(screen.getByRole("button", { name: "checkoutStepPayment" }))
    expect(document.activeElement).toBe(
      await screen.findByRole("heading", { name: "checkoutReviewHeroTitle" }),
    )
  })

  it("keeps existing-domain migration fail-closed and exposes its authorized source inputs only when enabled", async () => {
    const migrationPublicEvidence = {
      checkedAt: "2026-07-29T12:00:00.000Z",
      authoritativeNameservers: ["ns1.example.test", "ns2.example.test"],
      dnssecDsPresent: true,
      dnssecDsRecords: ["12345 13 2 " + "AB".repeat(32)],
      dnssecDsTtl: 3600,
      probableDnsProvider: "Example DNS",
      registrar: "Example Registrar",
      supplementalOnly: true as const,
    }
    const checkDomainAction = vi.fn().mockImplementation(
      async (_state: unknown, formData: FormData) => {
        await new Promise((resolve) => window.setTimeout(resolve, 0))
        const sourceMethod = String(formData.get("migrationSourceMethod") ?? "")
        return {
          ok: sourceMethod === "",
          status: sourceMethod === "" ? "preflight_complete" as const : "invalid" as const,
          domain: "example.nl",
          domainMode: "existing_domain" as const,
          migrationReadiness: "unsupported" as const,
          migrationClassification: null,
          migrationSourceMechanism: sourceMethod || undefined,
          migrationPreflightOnly: true,
          migrationPublicEvidence,
          message: sourceMethod === ""
            ? "Nothing has been transferred or ordered."
            : "Correct the transfer authorization and try again.",
          requestToken:
            document.querySelector<HTMLInputElement>(
              '#checkout-domain-form input[name="requestToken"]',
            )?.value ?? String(formData.get("requestToken") ?? ""),
        }
      },
    )
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
      checkDomainAction,
      saveProfileAction: vi.fn(),
      startPaymentAction: vi.fn(),
      termsHref: "https://www.siteinabox.nl/voorwaarden",
      privacyHref: "https://www.siteinabox.nl/privacy",
      termsVersion: "2026-07-07.1",
      privacyVersion: "2026-07-18.1",
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
    expect(screen.getAllByText("checkoutDomainModeExistingPreflight").length).toBeGreaterThanOrEqual(1)
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      document.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )
    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("ns1.example.test, ns2.example.test")).toBeTruthy()
    expect(
      screen.queryAllByText("checkoutMigrationPreflightNoOrder").every(
        (element) => (element as HTMLButtonElement).disabled,
      ),
    ).toBe(true)
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()
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
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )
    await screen.findByText("checkoutMigrationSourceLegend")
    expect(screen.queryByLabelText("checkoutMigrationZoneExportLabel")).toBeNull()
    expect(screen.queryByRole("radio", {
      name: "checkoutMigrationSourceExport",
    })).toBeNull()
    expect(screen.queryByRole("radio", {
      name: "checkoutMigrationAutomaticChoice",
    })).toBeNull()
    expect(screen.queryByRole("radio", {
      name: "checkoutMigrationAssistedChoice",
    })).toBeNull()
    expect(screen.queryByText("checkoutMigrationAssistedChoice")).toBeNull()
    expect(screen.getByText("checkoutMigrationTransferAuthorization")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", {
      name: "checkoutMigrationSourceAxfr",
    }))
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )
    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(3))
    expect(screen.queryByLabelText("checkoutMigrationZoneExportLabel")).toBeNull()
    expect(screen.getByLabelText("checkoutMigrationTransferCodeLabel")).toBeTruthy()
    expect(
      container.querySelector<HTMLInputElement>(
        '#checkout-domain-form input[name="domainMode"]',
      )?.value,
    ).toBe("existing_domain")
    expect(container.querySelector('input[type="hidden"][name="transferCode"]'))
      .toBeNull()
  })

  it("does not present a failed existing-domain preflight as complete", async () => {
    const checkDomainAction = vi.fn(async (
      _state: unknown,
      formData: FormData,
    ) => ({
      ok: false,
      status: "service_error" as const,
      domain: "example.nl",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationPreflightOnly: true,
      message: "checkoutMigrationPublicPreflightFailed",
      requestToken: String(formData.get("requestToken") ?? ""),
    }))
    const { container } = render(<PreviewCheckout
      {...baseCheckoutProps()}
      currentDomain={null}
      domainReady={false}
      initialQuotes={null}
      checkDomainAction={checkDomainAction}
    />)

    fireEvent.click(screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }))
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    expect(await screen.findByText("checkoutMigrationPreflightUnavailableTitle")).toBeTruthy()
    expect(screen.queryByText("checkoutMigrationPreflightComplete")).toBeNull()
    expect(screen.getByRole("button", { name: "checkoutCheckAgain" })).toBeTruthy()
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()
  })

  it("turns a public transfer blocker into an alert and suppresses source controls", async () => {
    const checkDomainAction = vi.fn(async (
      _state: unknown,
      formData: FormData,
    ) => ({
      ok: false,
      status: "preflight_complete" as const,
      domain: "example.com",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationClassification: null,
      migrationPreflightOnly: true,
      migrationPublicEvidence: {
        checkedAt: "2026-07-30T12:00:00.000Z",
        authoritativeNameservers: ["ns1.example.test"],
        dnssecDsPresent: false,
        dnssecDsRecords: [],
        dnssecDsTtl: null,
        probableDnsProvider: "cloudflare",
        registrar: "Example Registrar",
        registryStatuses: ["client transfer prohibited"],
        registryTransferEvidence: "confirmed" as const,
        transferBlockers: ["rdap_status:client_transfer_prohibited"],
        supplementalOnly: true as const,
      },
      message: "Resolve the registrar lock before continuing.",
      requestToken: String(formData.get("requestToken") ?? ""),
    }))
    const { container } = render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        currentDomain={null}
        domainReady={false}
        initialQuotes={null}
        existingDomainMigrationEnabled
        enabledMigrationSourceMethods={[
          "cloudflare_api_v1",
          "authorized_axfr_v1",
        ]}
        cloudflareSourceOAuthEnabled
        checkDomainAction={checkDomainAction}
      />,
    )

    fireEvent.click(screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }))
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.com" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("checkoutMigrationTransferBlockedTitle")
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()
    expect(screen.queryByLabelText("checkoutMigrationTransferCodeLabel")).toBeNull()
    expect(screen.queryByText("checkoutMigrationVerifySource")).toBeNull()
    expect(screen.queryByRole("button", { name: "checkoutNext" })).toBeNull()
  })

  it("keeps source credentials hidden while rechecking an unreleased transfer TLD", async () => {
    const blocked = (requestToken: string) => ({
      ok: false,
      status: "preflight_complete" as const,
      domain: "example.com",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationClassification: null,
      migrationPreflightOnly: true,
      migrationReleaseBlocked: true,
      migrationPublicEvidence: {
        checkedAt: "2026-07-30T12:00:00.000Z",
        authoritativeNameservers: ["ns1.example.test"],
        dnssecDsPresent: false,
        dnssecDsRecords: [],
        dnssecDsTtl: null,
        probableDnsProvider: "cloudflare",
        registrar: "Example Registrar",
        registryStatuses: [],
        registryTransferEvidence: "confirmed" as const,
        transferBlockers: [],
        supplementalOnly: true as const,
      },
      message: "This transfer TLD is not released.",
      requestToken,
    })
    const deferred: {
      resolve?: (value: ReturnType<typeof blocked>) => void
    } = {}
    const checkDomainAction = vi.fn((
      _state: unknown,
      formData: FormData,
    ) => {
      const result = blocked(String(formData.get("requestToken") ?? ""))
      if (checkDomainAction.mock.calls.length === 1) {
        return Promise.resolve(result)
      }
      return new Promise<ReturnType<typeof blocked>>((resolve) => {
        deferred.resolve = resolve
      })
    })
    const { container } = render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        currentDomain={null}
        domainReady={false}
        initialQuotes={null}
        existingDomainMigrationEnabled
        enabledMigrationSourceMethods={["authorized_axfr_v1"]}
        checkDomainAction={checkDomainAction}
      />,
    )
    fireEvent.click(screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }))
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.com" },
    })
    const form = container.querySelector<HTMLFormElement>(
      "#checkout-domain-form",
    )!
    fireEvent.submit(form)
    await screen.findAllByText("This transfer TLD is not released.")
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()

    fireEvent.submit(form)
    await waitFor(() => expect(checkDomainAction).toHaveBeenCalledTimes(2))
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()
    expect(screen.queryByLabelText("checkoutMigrationTransferCodeLabel"))
      .toBeNull()

    deferred.resolve?.(blocked(
      String(checkDomainAction.mock.calls[1]?.[1].get("requestToken") ?? ""),
    ))
    await waitFor(() =>
      expect(screen.getAllByText("This transfer TLD is not released.").length).toBeGreaterThanOrEqual(1))
    expect(screen.queryByText("checkoutMigrationSourceLegend")).toBeNull()
  })

  it("uses provider-directed Cloudflare OAuth while retaining safe source choices", async () => {
    const checkDomainAction = vi.fn(async (
      _state: unknown,
      formData: FormData,
    ) => ({
      ok: true,
      status: "preflight_complete" as const,
      domain: "example.nl",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationClassification: null,
      migrationSourceMechanism: undefined,
      migrationPreflightOnly: true,
      migrationPublicEvidence: {
        checkedAt: "2026-07-30T12:00:00.000Z",
        authoritativeNameservers: [
          "ada.ns.cloudflare.com",
          "bob.ns.cloudflare.com",
        ],
        dnssecDsPresent: false,
        dnssecDsRecords: [],
        dnssecDsTtl: null,
        probableDnsProvider: "cloudflare",
        registrar: "Example Registrar",
        supplementalOnly: true as const,
      },
      message: "Preflight complete.",
      requestToken: String(formData.get("requestToken") ?? ""),
    }))
    const props = {
      clientSlug: "example",
      customerEmail: "owner@example.test",
      initialProfile: profile,
      initialDetails: profile,
      initialQuotes: null,
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
      previewHref: "/example",
      prewarmHref: "/example/checkout/prewarm",
      checkDomainAction,
      saveProfileAction: vi.fn(),
      startPaymentAction: vi.fn(),
      termsHref: "https://www.siteinabox.nl/voorwaarden",
      privacyHref: "https://www.siteinabox.nl/privacy",
      termsVersion: "2026-07-07.1",
      privacyVersion: "2026-07-18.1",
      locale: "nl-NL",
      existingDomainMigrationEnabled: true,
      cloudflareSourceOAuthEnabled: true,
      enabledMigrationSourceMethods: [
        "cloudflare_api_v1" as const,
        "authorized_axfr_v1" as const,
      ],
    }
    const { container, rerender } = render(<PreviewCheckout {...props} />)
    fireEvent.click(screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }))
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    const connect = await screen.findByRole("button", {
      name: "checkoutMigrationCloudflareConnect",
    })
    const connectForm = container.querySelector<HTMLFormElement>(
      `#${connect.getAttribute("form")}`,
    )
    expect(connectForm?.getAttribute("method")).toBe("post")
    expect(connectForm?.getAttribute("action")).toBe(
      "/api/domain-migration-source/cloudflare/start",
    )
    expect(container.querySelectorAll("form form")).toHaveLength(0)
    expect(screen.queryByLabelText("checkoutMigrationSourceTokenLabel")).toBeNull()
    expect(screen.getByRole("radio", {
      name: "checkoutMigrationSourceCloudflare",
    })).toBeTruthy()
    expect(screen.getByRole("radio", {
      name: "checkoutMigrationSourceAxfr",
    })).toBeTruthy()
    expect(screen.queryByLabelText("checkoutMigrationTransferCodeLabel")).toBeTruthy()

    rerender(<PreviewCheckout
      {...props}
      cloudflareSourceAuthorization="opaque-source-handle"
      cloudflareSourceDomain="example.nl"
      cloudflareSourceResult="connected"
    />)
    expect(screen.getByText("checkoutMigrationCloudflareConnectedTitle")).toBeTruthy()
    expect(container.querySelector<HTMLInputElement>(
      'input[name="cloudflareSourceAuthorization"]',
    )?.value).toBe("opaque-source-handle")
    expect(screen.getByLabelText("checkoutMigrationTransferCodeLabel")).toBeTruthy()
    expect(screen.queryByText("checkoutMigrationAssistedChoice")).toBeNull()
  })

  it("explains why a non-Cloudflare domain has no enabled automatic source", async () => {
    const checkDomainAction = vi.fn(async (
      _state: unknown,
      formData: FormData,
    ) => ({
      ok: true,
      status: "preflight_complete" as const,
      domain: "example.nl",
      domainMode: "existing_domain" as const,
      migrationReadiness: "unsupported" as const,
      migrationClassification: null,
      migrationPreflightOnly: true,
      migrationPublicEvidence: {
        checkedAt: "2026-07-30T12:00:00.000Z",
        authoritativeNameservers: ["ns1.example.test", "ns2.example.test"],
        dnssecDsPresent: false,
        dnssecDsRecords: [],
        dnssecDsTtl: null,
        probableDnsProvider: "example-dns",
        registrar: "Example Registrar",
        supplementalOnly: true as const,
      },
      message: "Preflight complete.",
      requestToken: String(formData.get("requestToken") ?? ""),
    }))
    const props = baseCheckoutProps()
    const { container } = render(<PreviewCheckout
      {...props}
      currentDomain={null}
      domainReady={false}
      initialQuotes={null}
      existingDomainMigrationEnabled
      cloudflareSourceOAuthEnabled
      enabledMigrationSourceMethods={["cloudflare_api_v1"]}
      checkDomainAction={checkDomainAction}
    />)

    fireEvent.click(screen.getByRole("radio", {
      name: /checkoutDomainModeExisting/,
    }))
    fireEvent.change(screen.getByLabelText(/checkout(?:Existing)?DomainLabel/), {
      target: { value: "example.nl" },
    })
    fireEvent.submit(
      container.querySelector<HTMLFormElement>("#checkout-domain-form")!,
    )

    expect(await screen.findByText(
      "checkoutMigrationNoAutomaticSourceTitle",
    )).toBeTruthy()
    expect(screen.getByText(
      "checkoutMigrationNoAutomaticSourceDescription",
    )).toBeTruthy()
    expect(screen.queryByRole("button", {
      name: "checkoutMigrationCloudflareConnect",
    })).toBeNull()
    expect(screen.queryByRole("button", { name: "checkoutNext" })).toBeNull()
    expect(
      (screen.getByLabelText(/checkout(?:Existing)?DomainLabel/) as HTMLInputElement).disabled,
    ).toBe(false)
  })

  it("recollects an accepted Cloudflare source only through a bound OAuth handle", () => {
    const annual = quote("annual")
    const monthly = quote("monthly")
    const existingQuotes = {
      annual: {
        ...annual,
        quote: {
          ...annual.quote,
          domainMode: "existing_domain" as const,
          selectedDomain: "example.nl",
          migrationClassification: "automatic" as const,
          migrationSourceMechanism: "cloudflare_api_v1" as const,
          migrationSourceZoneHash: "zone-hash",
          migrationSecretKey: "secret-key",
          transferRenewalEffect: "unchanged" as const,
          domainRenewalExplanation:
            "De domeintransfer wijzigt de huidige verlengdatum niet.",
        },
      },
      monthly: {
        ...monthly,
        quote: {
          ...monthly.quote,
          domainMode: "existing_domain" as const,
          selectedDomain: "example.nl",
          migrationClassification: "automatic" as const,
          migrationSourceMechanism: "cloudflare_api_v1" as const,
          migrationSourceZoneHash: "zone-hash",
          migrationSecretKey: "secret-key",
          transferRenewalEffect: "unchanged" as const,
          domainRenewalExplanation:
            "De domeintransfer wijzigt de huidige verlengdatum niet.",
        },
      },
    }
    const props = {
      clientSlug: "example",
      customerEmail: "owner@example.test",
      currentDomain: "example.nl",
      domainReady: true,
      initialProfile: profile,
      initialDetails: profile,
      initialQuotes: existingQuotes,
      acceptedOrderId: 90,
      requiresMigrationRecollection: true,
      existingDomainMigrationEnabled: true,
      cloudflareSourceOAuthEnabled: true,
      enabledMigrationSourceMethods: ["cloudflare_api_v1" as const],
      catalog: {
        version: "2026-07-26.1",
        currency: "EUR" as const,
        vatRateBasisPoints: 2_100,
        plans: {
          monthly: { code: "siteinabox-monthly", netAmountMinor: 1_900 },
          annual: { code: "siteinabox-annual", netAmountMinor: 19_000 },
        },
        domainIncludedAllowanceNetMinor: 1_000,
        migrations: { automaticNetAmountMinor: 0 },
      },
      paymentStatus: "canceled",
      previewHref: "/example",
      prewarmHref: "/example/checkout/prewarm",
      checkDomainAction: vi.fn(),
      saveProfileAction: vi.fn(),
      startPaymentAction: vi.fn(),
      recollectAcceptedMigrationInputAction: vi.fn(),
      termsHref: "https://www.siteinabox.nl/voorwaarden",
      privacyHref: "https://www.siteinabox.nl/privacy",
      termsVersion: "2026-07-07.1",
      privacyVersion: "2026-07-18.1",
      locale: "nl-NL",
    }
    const { container, rerender } = render(<PreviewCheckout {...props} />)

    expect(container.querySelector("#accepted-cloudflare-source-token")).toBeNull()
    const reconnect = screen.getByRole("button", {
      name: "checkoutMigrationCloudflareReconnect",
    })
    expect(reconnect.getAttribute("form")).toBe(
      "accepted-cloudflare-source-reconnect-form",
    )
    expect(container.querySelectorAll("form form")).toHaveLength(0)
    expect((screen.getByRole("button", {
      name: "checkoutMigrationRecollectionSubmit",
    }) as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <PreviewCheckout
        {...props}
        cloudflareSourceAuthorization="opaque-source-handle"
        cloudflareSourceDomain="example.nl"
        cloudflareSourceResult="connected"
      />,
    )
    const recollectionForm = container.querySelector<HTMLFormElement>(
      'form input[name="acceptedOrderId"][value="90"]',
    )?.closest("form")
    expect(recollectionForm?.querySelector<HTMLInputElement>(
      'input[name="cloudflareSourceAuthorization"]',
    )?.value).toBe("opaque-source-handle")
    expect(recollectionForm?.querySelector("#accepted-cloudflare-source-token"))
      .toBeNull()
    expect((screen.getByRole("button", {
      name: "checkoutMigrationRecollectionSubmit",
    }) as HTMLButtonElement).disabled).toBe(false)
    expect(container.querySelectorAll("form form")).toHaveLength(0)
  })
})

describe("PreviewCheckout live lifecycle status", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("polls serialized server projections without overlap and stops at activation", async () => {
    vi.useFakeTimers()
    const loadLiveStatusAction = vi.fn(async () => ({
      paymentStatus: "completed",
      migrationStatus: null,
      provisioningStatus: {
        domain: "analytical-engines.nl",
        registrantVerificationDueAt: null,
        updatedAt: "2026-07-30T10:00:00.000Z",
        stages: [
          { code: "payment" as const, status: "complete" as const },
          { code: "activation" as const, status: "complete" as const },
        ],
      },
      billingAgreement: null,
    }))
    const view = render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        paymentReturn
        paymentStatus="pending_provider"
        loadLiveStatusAction={loadLiveStatusAction}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/checkoutProvisioningStatusTitle/)).toBeTruthy()
    expect(screen.getByText("checkoutProvisioningStage_activation")).toBeTruthy()
    expect(screen.getAllByText("checkoutProvisioningStageStatus_complete").length).toBeGreaterThanOrEqual(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(1)

    view.unmount()
  })

  it("does not overlap a slow lifecycle status request", async () => {
    vi.useFakeTimers()
    let resolveStatus: ((value: {
      paymentStatus: string
      migrationStatus: null
      provisioningStatus: null
      billingAgreement: null
    }) => void) | undefined
    const pendingStatus = new Promise<{
      paymentStatus: string
      migrationStatus: null
      provisioningStatus: null
      billingAgreement: null
    }>((resolve) => {
      resolveStatus = resolve
    })
    const loadLiveStatusAction = vi.fn(() => pendingStatus)
    render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        paymentReturn
        paymentStatus="pending_provider"
        loadLiveStatusAction={loadLiveStatusAction}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveStatus?.({
        paymentStatus: "failed",
        migrationStatus: null,
        provisioningStatus: null,
        billingAgreement: null,
      })
      await pendingStatus
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(1)
  })

  it("stops polling for terminal payments and customer-action states", () => {
    expect(checkoutStatusNeedsPolling({
      paymentReturn: true,
      paymentStatus: "failed",
      migrationStatus: null,
      provisioningStatus: null,
    })).toBe(false)
    expect(checkoutStatusNeedsPolling({
      paymentReturn: true,
      paymentStatus: "completed",
      provisioningStatus: null,
      migrationStatus: {
        migrationId: 7,
        domain: "existing.nl",
        state: "awaiting_customer",
        classification: "automatic",
        sourceMechanism: "cloudflare_api_v1",
        operatorAuthorization: "not_required",
        updatedAt: "2026-07-30T10:00:00.000Z",
        actions: [{
          action: "confirm_transfer",
          status: "required",
          deadlineAt: null,
        }],
      },
    })).toBe(false)
  })

  it("restarts lifecycle polling after a customer migration action succeeds", async () => {
    vi.useFakeTimers()
    const submitMigrationTransferCodeAction = vi.fn(async () => ({
      ok: true,
      status: "saved" as const,
      message: "checkoutMigrationActionSaved",
    }))
    const loadLiveStatusAction = vi.fn()
      .mockResolvedValueOnce({
        paymentStatus: "completed",
        migrationStatus: {
          migrationId: 7,
          domain: "existing.nl",
          state: "awaiting_provider" as const,
          classification: "automatic" as const,
          sourceMechanism: "cloudflare_api_v1" as const,
          operatorAuthorization: "not_required" as const,
          updatedAt: "2026-07-30T10:01:00.000Z",
          actions: [],
        },
        provisioningStatus: null,
        billingAgreement: null,
      })
      .mockResolvedValueOnce({
        paymentStatus: "completed",
        migrationStatus: {
          migrationId: 7,
          domain: "existing.nl",
          state: "completed" as const,
          classification: "automatic" as const,
          sourceMechanism: "cloudflare_api_v1" as const,
          operatorAuthorization: "not_required" as const,
          updatedAt: "2026-07-30T10:02:00.000Z",
          actions: [],
        },
        provisioningStatus: null,
        billingAgreement: null,
      })
    const { container } = render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        paymentStatus="completed"
        migrationStatus={{
          migrationId: 7,
          domain: "existing.nl",
          state: "awaiting_customer",
          classification: "automatic",
          sourceMechanism: "cloudflare_api_v1",
          operatorAuthorization: "not_required",
          updatedAt: "2026-07-30T10:00:00.000Z",
          actions: [{
            action: "provide_epp_code",
            status: "required",
            deadlineAt: null,
          }],
        }}
        loadLiveStatusAction={loadLiveStatusAction}
        submitMigrationTransferCodeAction={submitMigrationTransferCodeAction}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(loadLiveStatusAction).not.toHaveBeenCalled()

    const transferCode = container.querySelector<HTMLInputElement>(
      'input[name="transferCode"]',
    )
    expect(transferCode).toBeTruthy()
    fireEvent.change(transferCode!, { target: { value: "opaque-code" } })
    await act(async () => {
      fireEvent.submit(transferCode!.closest("form")!)
      await Promise.resolve()
    })
    expect(submitMigrationTransferCodeAction).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(loadLiveStatusAction).toHaveBeenCalledTimes(2)
  })

  it("offers authenticated period-end cancellation and shows its effective date", async () => {
    const scheduleCancellationAction = vi.fn(async () => ({
      ok: true,
      status: "scheduled" as const,
      message: "checkoutCancellationScheduled",
      agreement: {
        id: 8,
        state: "cancellation_scheduled" as const,
        billingPeriod: "annual" as const,
        currentPeriodEndsAt: "2027-07-30T10:00:00.000Z",
        cancelAt: "2027-07-30T10:00:00.000Z",
        updatedAt: "2026-07-30T10:01:00.000Z",
      },
    }))
    render(
      <PreviewCheckout
        {...baseCheckoutProps()}
        billingAgreement={{
          id: 8,
          state: "active",
          billingPeriod: "annual",
          currentPeriodEndsAt: "2027-07-30T10:00:00.000Z",
          cancelAt: null,
          updatedAt: "2026-07-30T10:00:00.000Z",
        }}
        scheduleCancellationAction={scheduleCancellationAction}
      />,
    )

    fireEvent.click(screen.getByRole("button", {
      name: "checkoutCancelAtPeriodEnd",
    }))
    await waitFor(() => {
      expect(scheduleCancellationAction).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText(/checkoutCancellationEffectiveAt/))
      .toBeTruthy()
  })
})
