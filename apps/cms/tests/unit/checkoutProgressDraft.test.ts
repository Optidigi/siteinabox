import { describe, expect, it } from "vitest"

import type { CheckoutProfileDraft } from "@/lib/checkout/checkoutProfile"

import { createCheckoutProgressDraft } from "@/components/preview/checkout/checkoutProgressDraft"

const details: CheckoutProfileDraft = {
  partyType: "registered_business",
  firstName: "Ada",
  lastName: "Lovelace",
  registeredBusinessName: "Ada Lovelace BV",
  kvkNumber: "12345678",
  intendedCompanyName: "",
  street: "Kerkstraat",
  number: "1",
  suffix: "",
  zipcode: "1011AA",
  city: "Amsterdam",
  country: "NL",
  phoneCountryCode: "+31",
  phoneAreaCode: "20",
  phoneSubscriberNumber: "12345678",
}

describe("createCheckoutProgressDraft", () => {
  it("projects only resumable profile fields and omits undefined values", () => {
    expect(createCheckoutProgressDraft({
      details,
      domainMode: "new_registration",
      domainQuery: "example.nl",
      selectedDomain: "example.nl",
      decision: "review",
      billingPeriod: "annual",
      migrationSourceMechanism: null,
    })).toEqual({
      domainMode: "new_registration",
      domainQuery: "example.nl",
      selectedDomain: "example.nl",
      decision: "review",
      billingPeriod: "annual",
      migrationSourceMechanism: null,
      profileDraft: {
        partyType: "registered_business",
        firstName: "Ada",
        lastName: "Lovelace",
        registeredBusinessName: "Ada Lovelace BV",
        kvkNumber: "12345678",
        intendedCompanyName: "",
        street: "Kerkstraat",
        number: "1",
        suffix: "",
        zipcode: "1011AA",
        city: "Amsterdam",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "20",
        phoneSubscriberNumber: "12345678",
      },
    })
  })

  it("applies transition overrides after the base projection", () => {
    expect(createCheckoutProgressDraft({
      details,
      domainMode: "existing_domain",
      domainQuery: "example.nl",
      selectedDomain: "example.nl",
      decision: "review",
      billingPeriod: "annual",
      migrationSourceMechanism: "authorized_axfr_v1",
      overrides: {
        decision: "domain",
        selectedDomain: null,
        migrationSourceMechanism: null,
      },
    })).toMatchObject({
      decision: "domain",
      selectedDomain: null,
      migrationSourceMechanism: null,
      profileDraft: {
        firstName: "Ada",
      },
    })
  })
})
