/**
 * Development-only checkout review states. This module is imported by the
 * Vite browser harness and is never reachable from the customer application.
 */
export const checkoutScenarioIds = [
  "domain-start",
  "domain-loading",
  "domain-results",
  "domain-selected",
  "domain-premium",
  "domain-error",
  "existing-ready",
  "existing-blocked",
  "existing-review",
  "details-known",
  "details-missing",
  "editing-details",
  "profile-conflict",
  "review-ready",
  "declaration-block",
  "quote-refreshed",
  "payment-redirecting",
  "payment-pending",
  "payment-failed",
  "fulfilment-pending",
  "fulfilment-action-verify",
  "fulfilment-action-transfer",
  "fulfilment-complete",
] as const

export type CheckoutScenarioId = typeof checkoutScenarioIds[number]

export type CheckoutScenario = {
  id: CheckoutScenarioId
  family: "domain" | "existing" | "review" | "payment" | "fulfilment"
  /** Interaction performed by the browser harness after the real UI mounts. */
  driver:
    | "none"
    | "search"
    | "select-domain"
    | "existing-ready"
    | "existing-blocked"
    | "edit-details"
    | "save-conflict"
    | "submit-payment"
  initial: "address" | "review" | "payment" | "fulfilment"
}

const define = <T extends readonly CheckoutScenario[]>(scenarios: T): T => scenarios

export const checkoutScenarios = define([
  { id: "domain-start", family: "domain", driver: "none", initial: "address" },
  { id: "domain-loading", family: "domain", driver: "search", initial: "address" },
  { id: "domain-results", family: "domain", driver: "search", initial: "address" },
  { id: "domain-selected", family: "domain", driver: "select-domain", initial: "address" },
  { id: "domain-premium", family: "domain", driver: "search", initial: "address" },
  { id: "domain-error", family: "domain", driver: "search", initial: "address" },
  { id: "existing-ready", family: "existing", driver: "existing-ready", initial: "address" },
  { id: "existing-blocked", family: "existing", driver: "existing-blocked", initial: "address" },
  { id: "existing-review", family: "existing", driver: "none", initial: "review" },
  { id: "details-known", family: "review", driver: "none", initial: "review" },
  { id: "details-missing", family: "review", driver: "none", initial: "review" },
  { id: "editing-details", family: "review", driver: "edit-details", initial: "review" },
  { id: "profile-conflict", family: "review", driver: "save-conflict", initial: "review" },
  { id: "review-ready", family: "review", driver: "none", initial: "review" },
  { id: "declaration-block", family: "review", driver: "submit-payment", initial: "review" },
  { id: "quote-refreshed", family: "review", driver: "submit-payment", initial: "review" },
  { id: "payment-redirecting", family: "payment", driver: "submit-payment", initial: "review" },
  { id: "payment-pending", family: "payment", driver: "none", initial: "payment" },
  { id: "payment-failed", family: "payment", driver: "none", initial: "payment" },
  { id: "fulfilment-pending", family: "fulfilment", driver: "none", initial: "fulfilment" },
  { id: "fulfilment-action-verify", family: "fulfilment", driver: "none", initial: "fulfilment" },
  { id: "fulfilment-action-transfer", family: "fulfilment", driver: "none", initial: "fulfilment" },
  { id: "fulfilment-complete", family: "fulfilment", driver: "none", initial: "fulfilment" },
] as const satisfies readonly CheckoutScenario[])

export const checkoutScenario = (value: string | null): CheckoutScenario =>
  checkoutScenarios.find((scenario) => scenario.id === value) ?? checkoutScenarios[0]
