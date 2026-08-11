import type { CheckoutProfileDraft } from "@/lib/checkout/checkoutProfile"
import type { CheckoutProgressDraft } from "@/lib/checkout/checkoutProgress"

const CHECKOUT_PROGRESS_PROFILE_FIELDS = [
  "partyType",
  "firstName",
  "lastName",
  "registeredBusinessName",
  "kvkNumber",
  "intendedCompanyName",
  "street",
  "number",
  "suffix",
  "zipcode",
  "city",
  "country",
  "phoneCountryCode",
  "phoneAreaCode",
  "phoneSubscriberNumber",
  "euEligibilityBasis",
  "euEligibilityCountry",
] as const satisfies readonly (keyof CheckoutProfileDraft)[]

type CreateCheckoutProgressDraftInput = {
  details: CheckoutProfileDraft
  domainMode: CheckoutProgressDraft["domainMode"]
  domainQuery: string
  selectedDomain: CheckoutProgressDraft["selectedDomain"]
  decision: CheckoutProgressDraft["decision"]
  billingPeriod: CheckoutProgressDraft["billingPeriod"]
  migrationSourceMechanism: CheckoutProgressDraft["migrationSourceMechanism"]
  overrides?: Partial<CheckoutProgressDraft>
}

export const createCheckoutProgressDraft = ({
  details,
  domainMode,
  domainQuery,
  selectedDomain,
  decision,
  billingPeriod,
  migrationSourceMechanism,
  overrides = {},
}: CreateCheckoutProgressDraftInput): CheckoutProgressDraft => {
  const profileDraft = Object.fromEntries(
    CHECKOUT_PROGRESS_PROFILE_FIELDS
      .map((field) => [field, details[field]] as const)
      .filter(([, value]) => value !== undefined),
  ) as CheckoutProgressDraft["profileDraft"]

  return {
    domainMode,
    domainQuery,
    selectedDomain,
    decision,
    billingPeriod,
    migrationSourceMechanism,
    profileDraft,
    ...overrides,
  }
}
