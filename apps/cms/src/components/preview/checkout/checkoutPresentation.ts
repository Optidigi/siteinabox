export type CheckoutDecision = "domain" | "review"
export type CheckoutLifecyclePhase = "address" | "review" | "payment" | "fulfilment"
export type CheckoutPrimaryActionKind =
  | "check_domain"
  | "continue_to_review"
  | "complete_details"
  | "pay"
  | "wait"

export type CheckoutPrimaryActionLabel =
  | "check_domain"
  | "check_again"
  | "domain_unavailable"
  | "migration_no_order"
  | "verify_migration_source"
  | "continue_to_review"
  | "complete_details"
  | "pay"
  | "payment_complete"
  | "wait"

export type CheckoutPrimaryAction = {
  kind: CheckoutPrimaryActionKind
  label: CheckoutPrimaryActionLabel
  disabled: boolean
  pending: boolean
  describedBy?: string
}

export type CheckoutPresentation = {
  decision: CheckoutDecision
  phase: CheckoutLifecyclePhase
  primaryAction: CheckoutPrimaryAction
}

export type CheckoutDomainResultKind =
  | "loading"
  | "info"
  | "success"
  | "unavailable"
  | "error"
  | null

/**
 * Normalizes authoritative checkout state for rendering only. Callers supply
 * server-decided readiness and lifecycle facts; this adapter never calculates
 * price, provider eligibility, migration method, payment success, or fulfilment.
 */
export function createCheckoutPresentation(input: {
  decision: CheckoutDecision
  paymentActive: boolean
  fulfilmentActive: boolean
  domainReady: boolean
  profileReady: boolean
  quoteReady?: boolean
  selectedDomain?: boolean
  checkPending?: boolean
  profilePending?: boolean
  paymentPending?: boolean
  paymentBlocked?: boolean
  declarationsAccepted?: boolean
  paymentInProgress: boolean
  paymentComplete?: boolean
  domainResultKind?: CheckoutDomainResultKind
  preflightComplete?: boolean
  sourceAcquisitionReady?: boolean
}): CheckoutPresentation {
  if (input.fulfilmentActive) {
    return {
      decision: input.decision,
      phase: "fulfilment",
      primaryAction: { kind: "wait", label: "wait", disabled: true, pending: false },
    }
  }
  if (input.paymentActive) {
    return {
      decision: input.decision,
      phase: "payment",
      primaryAction: {
        kind: "wait",
        label: input.paymentComplete ? "payment_complete" : "wait",
        disabled: true,
        pending: input.paymentInProgress,
      },
    }
  }
  if (input.decision === "domain") {
    if (input.domainReady) {
      return {
        decision: input.decision,
        phase: "address",
        primaryAction: {
          kind: "continue_to_review",
          label: "continue_to_review",
          disabled: false,
          pending: false,
        },
      }
    }
    const unavailable = input.domainResultKind === "unavailable"
    return {
      decision: input.decision,
      phase: "address",
      primaryAction: {
        kind: "check_domain",
        label: input.preflightComplete
          ? "migration_no_order"
          : input.checkPending
            ? "check_domain"
            : input.sourceAcquisitionReady
              ? "verify_migration_source"
              : unavailable
                ? "domain_unavailable"
                : input.domainResultKind === "error"
                  ? "check_again"
                  : "check_domain",
        disabled: Boolean(input.checkPending || unavailable || input.preflightComplete),
        pending: Boolean(input.checkPending),
      },
    }
  }
  if (!input.profileReady) {
    return {
      decision: input.decision,
      phase: "review",
      primaryAction: {
        kind: "complete_details",
        label: "complete_details",
        disabled: Boolean(input.profilePending),
        pending: Boolean(input.profilePending),
      },
    }
  }
  return {
    decision: input.decision,
    phase: "review",
    primaryAction: {
      kind: "pay",
      label: input.paymentComplete ? "payment_complete" : "pay",
      disabled: Boolean(
        input.paymentPending ||
        input.paymentBlocked ||
        !input.declarationsAccepted ||
        !input.selectedDomain ||
        !input.quoteReady ||
        input.paymentInProgress ||
        input.paymentComplete,
      ),
      pending: Boolean(input.paymentPending),
      describedBy: input.paymentBlocked
        ? "migration-recollection-payment-block"
        : undefined,
    },
  }
}
