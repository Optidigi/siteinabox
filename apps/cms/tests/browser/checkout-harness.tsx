import React from "react"
import { createRoot } from "react-dom/client"
import { NextIntlClientProvider } from "next-intl"

import { PreviewCheckout } from "@/components/preview/PreviewCheckout"
import { ThemeProvider } from "@/components/theme-provider"
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
  existing?: {
    sourceMechanism:
      | "cloudflare_api_v1"
      | "authorized_axfr_v1"
      | "validated_provider_export_v1"
  },
) => {
  const planPriceNetMinor = billingPeriod === "annual" ? 19_000 : 1_900
  const vatAmountMinor = billingPeriod === "annual" ? 3_990 : 399
  return {
    token: `browser-${billingPeriod}`,
    quote: {
      schemaVersion: 4 as const,
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
      migrationClassification: existing ? "automatic" as const : null,
      migrationSourceMechanism: existing?.sourceMechanism ?? null,
      migrationSourceZoneHash: existing ? "browser-zone-hash" : null,
      migrationInputEnvelope: existing ? "browser-encrypted-input" : null,
      migrationSecretKey: existing ? "browser-secret-key" : null,
      planPriceNetMinor,
      vatRateBasisPoints: 2_100 as const,
      futureSubscriptionNetMinor: planPriceNetMinor,
      futureSubscriptionVatMinor: vatAmountMinor,
      futureSubscriptionGrossMinor: planPriceNetMinor + vatAmountMinor,
      selectedDomain,
      domainMode: existing
        ? "existing_domain" as const
        : "new_registration" as const,
      providerQuotedAt: "2026-07-28T10:00:00.000Z",
      quoteIssuedAt: "2026-07-28T10:00:00.000Z",
      quoteExpiresAt: "2099-07-28T10:15:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-1",
      transferRenewalEffect: existing ? "unchanged" as const : null,
      domainRenewalExplanation: "Renewal is charged separately before the safe cutoff.",
      currency: "EUR" as const,
      netAmountMinor: planPriceNetMinor,
      vatAmountMinor,
      grossAmountMinor: planPriceNetMinor + vatAmountMinor,
    },
  }
}

const searchParams = new URLSearchParams(window.location.search)
const pending = searchParams.get("payment") === "pending"
const existingScenario = searchParams.get("existing")
const existingDomain = existingScenario ? "existing-example.nl" : null
const cloudflareConnected = existingScenario === "cloudflare"
const initialDomain = pending ? "analytical-engines.nl" : null

const saveProfileAction = async (_previous: unknown, formData: FormData) => {
  if (!existingScenario && formData.get("firstName") === "Ada") {
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
    quotes: existingScenario
      ? {
          monthly: quote("monthly", existingDomain ?? "existing-example.nl", {
            sourceMechanism: cloudflareConnected
              ? "cloudflare_api_v1"
              : "authorized_axfr_v1",
          }),
          annual: quote("annual", existingDomain ?? "existing-example.nl", {
            sourceMechanism: cloudflareConnected
              ? "cloudflare_api_v1"
              : "authorized_axfr_v1",
          }),
        }
      : { monthly: quote("monthly"), annual: quote("annual") },
  }
}

createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={{ common: messages.common, preview: messages.preview }}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
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
      supportedDomainExtensions={["nl", "com", "eu", "org", "net", "be", "de", "info", "online", "shop"]}
      initialStep={pending ? "overview" : "domain"}
      existingDomainMigrationEnabled={Boolean(existingScenario)}
      cloudflareSourceOAuthEnabled={Boolean(existingScenario)}
      enabledMigrationSourceMethods={
        existingScenario === "unsupported"
          ? ["cloudflare_api_v1"]
          : existingScenario
            ? ["cloudflare_api_v1", "authorized_axfr_v1"]
            : []
      }
      cloudflareSourceAuthorization={
        cloudflareConnected ? "browser-cloudflare-source-handle" : null
      }
      cloudflareSourceDomain={cloudflareConnected ? existingDomain : null}
      cloudflareSourceResult={cloudflareConnected ? "connected" : null}
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
        const domainMode = String(formData.get("domainMode") ?? "new_registration")
        if (domainMode === "existing_domain") {
          const sourceMechanism = String(
            formData.get("migrationSourceMethod") ?? "",
          ) as
            | ""
            | "cloudflare_api_v1"
            | "authorized_axfr_v1"
            | "validated_provider_export_v1"
          const probableDnsProvider = existingScenario === "cloudflare"
            ? "cloudflare"
            : "example-dns"
          const publicEvidence = {
            checkedAt: "2026-07-30T12:00:00.000Z",
            authoritativeNameservers: [
              "ns1.existing-example.test",
              "ns2.existing-example.test",
            ],
            dnssecDsPresent: false,
            dnssecDsRecords: [],
            dnssecDsTtl: null,
            probableDnsProvider,
            registrar: "Example Registrar",
            supplementalOnly: true as const,
          }
          if (!sourceMechanism) {
            return {
              ok: true,
              status: "preflight_complete" as const,
              domain,
              domainMode: "existing_domain" as const,
              migrationReadiness: "unsupported" as const,
              migrationClassification: null,
              migrationPreflightOnly: true,
              migrationPublicEvidence: publicEvidence,
              message: "Public preflight completed without a provider write.",
            }
          }
          return {
            ok: true,
            status: "available" as const,
            domain,
            domainMode: "existing_domain" as const,
            migrationReadiness: "ready_automatic" as const,
            migrationClassification: "automatic" as const,
            migrationSourceMechanism: sourceMechanism,
            migrationPreflightOnly: false,
            migrationPublicEvidence: publicEvidence,
            message: "The complete DNS source is ready for automatic migration.",
            quotes: {
              monthly: quote("monthly", domain, { sourceMechanism }),
              annual: quote("annual", domain, { sourceMechanism }),
            },
          }
        }
        if (domain === "service-error.nl") {
          return {
            ok: false,
            status: "service_error",
            domain,
            domainMode: "new_registration",
            message: "The live domain check is temporarily unavailable.",
          }
        }
        if (domain === "analytical-engines.com") {
          return {
            ok: false,
            status: "unavailable",
            domain,
            domainMode: "new_registration",
            message: `${domain} is unavailable.`,
          }
        }
        if (domain === "analytical-engines.eu") {
          return {
            ok: false,
            status: "premium",
            domain,
            domainMode: "new_registration",
            message: `${domain} is premium.`,
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
    </ThemeProvider>
  </NextIntlClientProvider>,
)
