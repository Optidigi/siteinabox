import { describe, expect, it } from "vitest"

import type {
  MigrationCustomerActionState,
  PreviewCheckoutActionState,
  PreviewCheckoutCancellationState,
  PreviewCheckoutDomainOption,
  PreviewCheckoutLiveStatus,
  PreviewCheckoutProfileActionState,
  PreviewCheckoutSuggestionsState,
} from "@/lib/checkout/previewCheckoutContract"

describe("preview checkout contract serialization", () => {
  it("preserves the domain option shape", () => {
    const state: PreviewCheckoutDomainOption = {
      domain: "example.nl",
      included: false,
      extraFeeAmount: "10.00",
      extraFeeCurrency: "EUR",
      extraFeeLabel: "€ 10,00",
    }

    expect(JSON.parse(JSON.stringify(state))).toEqual({
      domain: "example.nl",
      included: false,
      extraFeeAmount: "10.00",
      extraFeeCurrency: "EUR",
      extraFeeLabel: "€ 10,00",
    })
  })

  it("preserves checkout, profile and suggestion result shapes", () => {
    const checkout: PreviewCheckoutActionState = {
      ok: false,
      message: "conflict",
      status: "profile_conflict",
      domain: "example.nl",
      included: true,
      extraFeeAmount: null,
      extraFeeCurrency: null,
      extraFeeLabel: null,
      totalPriceLabel: null,
      domainSurchargeNetMinor: 0,
      requestToken: "request-1",
      suggestions: [],
      domainMode: "existing_domain",
      migrationReadiness: "ready_automatic",
      migrationClassification: "automatic",
      migrationSourceMechanism: "cloudflare_api_v1",
      migrationPreflightOnly: true,
      migrationReleaseBlocked: false,
      migrationPublicEvidence: {
        checkedAt: "2026-07-30T12:00:00.000Z",
        authoritativeNameservers: ["ns1.example.test"],
        dnssecDsPresent: true,
        dnssecDsRecords: ["12345 13 2 ABCD"],
        dnssecDsTtl: 3600,
        probableDnsProvider: "example",
        registrar: "example",
        registryStatuses: ["active"],
        registeredAt: null,
        lastTransferredAt: null,
        registryExpiryAt: "2027-07-30T12:00:00.000Z",
        registryTransferEvidence: "confirmed",
        transferBlockers: [],
        supplementalOnly: true,
      },
    }
    const profile: PreviewCheckoutProfileActionState = {
      ok: false,
      message: "conflict",
      status: "conflict",
      requestToken: "request-1",
      fieldErrors: { profileVersion: "conflict" },
    }
    const suggestions: PreviewCheckoutSuggestionsState = {
      ok: true,
      domain: "example.nl",
      suggestions: [],
      cursor: 5,
      done: true,
    }

    expect(JSON.parse(JSON.stringify({ checkout, profile, suggestions }))).toEqual({
      checkout,
      profile,
      suggestions,
    })
  })

  it("preserves migration, cancellation and live-status shapes", () => {
    const migration: MigrationCustomerActionState = {
      ok: false,
      status: "refresh_required",
      message: "refresh",
    }
    const cancellation: PreviewCheckoutCancellationState = {
      ok: true,
      status: "scheduled",
      message: "scheduled",
      agreement: null,
    }
    const live: PreviewCheckoutLiveStatus = {
      paymentStatus: "paid",
      migrationStatus: null,
      provisioningStatus: null,
      billingAgreement: null,
    }

    expect(JSON.parse(JSON.stringify({ migration, cancellation, live }))).toEqual({
      migration,
      cancellation,
      live,
    })
  })
})
