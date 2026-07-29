import React from "react"
import { createRoot } from "react-dom/client"
import { NextIntlClientProvider } from "next-intl"

import { PreviewCheckout } from "@/components/preview/PreviewCheckout"
import messages from "@/locales/en.json"
import "@/styles/globals.css"

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
  street: "Market Street",
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
  sourceRequestId: "browser-contract",
  createdAt: "2026-07-28T10:00:00.000Z",
}

const quote = (
  billingPeriod: "monthly" | "annual",
  selectedDomain = "analytical-engines.nl",
) => {
  const planPriceNetMinor = billingPeriod === "annual" ? 19_000 : 1_900
  const vatAmountMinor = billingPeriod === "annual" ? 3_990 : 399
  return {
    token: `browser-${billingPeriod}`,
    quote: {
      schemaVersion: 3 as const,
      catalogVersion: "2026-07-26.1",
      packageCode: `siteinabox-${billingPeriod}`,
      billingPeriod,
      lineItems: [{
        code: `siteinabox-${billingPeriod}`,
        description: "Siteinabox",
        quantity: 1 as const,
        netAmountMinor: planPriceNetMinor,
      }],
      domainIncludedAllowanceNetMinor: 1_000,
      providerOperationPriceNetMinor: 1_000,
      domainSurchargeNetMinor: 0,
      migrationServiceFeeNetMinor: 0,
      migrationClassification: null,
      migrationSourceZoneHash: null,
      migrationInputEnvelope: null,
      migrationSecretKey: null,
      planPriceNetMinor,
      vatRateBasisPoints: 2_100 as const,
      futureSubscriptionNetMinor: planPriceNetMinor,
      futureSubscriptionVatMinor: vatAmountMinor,
      futureSubscriptionGrossMinor: planPriceNetMinor + vatAmountMinor,
      selectedDomain,
      domainMode: "new_registration" as const,
      providerQuotedAt: "2026-07-28T10:00:00.000Z",
      quoteIssuedAt: "2026-07-28T10:00:00.000Z",
      quoteExpiresAt: "2099-07-28T10:15:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-1",
      domainRenewalExplanation: "Renewal is charged separately before the safe cutoff.",
      currency: "EUR" as const,
      netAmountMinor: planPriceNetMinor,
      vatAmountMinor,
      grossAmountMinor: planPriceNetMinor + vatAmountMinor,
    },
  }
}

const saveProfileAction = async (_previous: unknown, formData: FormData) => {
  if (formData.get("firstName") === "Ada") {
    return {
      ok: false,
      status: "invalid" as const,
      message: "Check the highlighted fields.",
      fieldErrors: { firstName: "First name requires confirmation." },
    }
  }
  return {
    ok: true,
    status: "saved" as const,
    message: "Saved.",
    profile,
    quotes: { monthly: quote("monthly"), annual: quote("annual") },
  }
}

const pending = new URLSearchParams(window.location.search).get("payment") === "pending"
const initialDomain = pending ? "analytical-engines.nl" : null

createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={{ preview: messages.preview }}>
    <PreviewCheckout
      customerEmail="owner@example.test"
      currentDomain={initialDomain}
      domainReady={Boolean(initialDomain)}
      initialProfile={profile}
      initialDetails={profile}
      initialQuotes={initialDomain
        ? {
            monthly: quote("monthly", initialDomain),
            annual: quote("annual", initialDomain),
          }
        : null}
      initialStep={pending ? "overview" : "domain"}
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
      paymentStatus={pending ? "pending_provider" : "not_started"}
      previewHref="/preview"
      prewarmHref="/prewarm"
      suggestionsHref="/suggestions"
      checkDomainAction={async (_previous, formData) => {
        const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
        if (domain === "service-error.nl") {
          return {
            ok: false,
            status: "service_error",
            domain,
            domainMode: "new_registration",
            message: "The live domain check is temporarily unavailable.",
          }
        }
        return {
          ok: true,
          status: "available",
          domain,
          domainMode: "new_registration",
          included: true,
          extraFeeAmount: null,
          extraFeeCurrency: null,
          message: `${domain} is available.`,
          quotes: {
            monthly: quote("monthly", domain),
            annual: quote("annual", domain),
          },
        }
      }}
      saveProfileAction={saveProfileAction}
      startPaymentAction={async () => ({
        ok: false,
        status: "payment_pending",
        message: "Payment processing is still pending.",
      })}
      termsHref="https://www.siteinabox.nl/terms"
      privacyHref="https://www.siteinabox.nl/privacy"
      termsVersion="2026-07-07.1"
      privacyVersion="2026-07-18.1"
      businessUseDeclarationVersion="business-use-2026-07-26.1"
      businessUseDeclarationText="I enter this agreement exclusively for business use."
      locale="en-NL"
    />
  </NextIntlClientProvider>,
)
