import { z } from "zod"
import { applyPlatformPricing, type PlatformPricingPolicy } from "../tenants/services.ts"

export const mailQuoteSchema = z.object({
  version: z.literal(2), serviceId: z.number().int().positive(), productId: z.string().uuid(),
  operation: z.enum(["initial", "seats", "renewal"]), baseQuantity: z.number().int().min(0), targetQuantity: z.number().int().min(1).max(300),
  annualUnitNetMinor: z.number().int().positive(), providerAnnualUnitCostMinor: z.number().int().positive(),
  servicePeriodStartsAt: z.string().datetime().nullable(), servicePeriodEndsAt: z.string().datetime().nullable(),
  providerCommitmentStartsAt: z.string().datetime().nullable(), providerCommitmentEndsAt: z.string().datetime().nullable(),
  commitmentTermId: z.string().min(1), quantity: z.number().int().min(1).max(300),
  currency: z.literal("EUR"), unitNetMinor: z.number().int().positive(), providerUnitCostMinor: z.number().int().positive(),
  platformNetMinor: z.number().int().min(0), platformDiscountNetMinor: z.number().int().min(0),
  subtotalNetMinor: z.number().int().positive(), vatAmountMinor: z.number().int().min(0), totalGrossMinor: z.number().int().positive(),
  issuedAt: z.string().datetime(), expiresAt: z.string().datetime(), pricingHash: z.string().min(1),
  sponsored: z.boolean().default(false), // Legacy draft marker: never accepted as funding authority.
  prepaidAuthorizationId: z.string().uuid().nullable().default(null),
  paymentProvider: z.enum(["mollie", "manual"]),
  legacyInfoForwardTo: z.string().email().nullable(), routingHash: z.string().length(64),
})
export type MailQuote = z.infer<typeof mailQuoteSchema>

export function proratedMailUnit(annualMinor: number, startsAt: string, endsAt: string, now = new Date()) {
  const start = Date.parse(startsAt), end = Date.parse(endsAt)
  if (!Number.isSafeInteger(annualMinor) || annualMinor <= 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || now.getTime() >= end || now.getTime() < start) throw new Error("A verified current commitment period is required for additional seats.")
  return Math.max(1, Math.ceil(annualMinor * (end - now.getTime()) / (end - start)))
}

export function mailPrice(input: { quantity: number; unitNetMinor: number; providerUnitCostMinor: number; platformNetMinor: number; policy?: PlatformPricingPolicy | null }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 300 || !Number.isSafeInteger(input.unitNetMinor) || !Number.isSafeInteger(input.providerUnitCostMinor) || input.unitNetMinor < input.providerUnitCostMinor || input.providerUnitCostMinor <= 0) throw new Error("Email price configuration is invalid.")
  const amounts = applyPlatformPricing({ platformNetMinor: input.platformNetMinor, providerNetMinor: input.unitNetMinor * input.quantity, policy: input.policy })
  const vatAmountMinor = Math.round(amounts.subtotalNetMinor * 0.21)
  return { ...amounts, vatAmountMinor, totalGrossMinor: amounts.subtotalNetMinor + vatAmountMinor }
}

export function assertPaidMailOrder(input: {
  orderId: string | number; tenantId: string | number; orderTenantId: string | null;
  orderStatus: string; paymentStatus: string; paymentOrderId: string | null; paymentTenantId: string | null;
  attemptState: string; purpose: string; grossMinor: number; paidGrossMinor: number; currency: string; paidCurrency: string;
  provider?: string; providerMode?: string | null;
}) {
  if (String(input.tenantId) !== input.orderTenantId || input.orderTenantId !== input.paymentTenantId ||
    String(input.orderId) !== input.paymentOrderId || input.paymentStatus !== "paid" ||
    !["fulfillment_pending", "fulfilled"].includes(input.orderStatus) || !["paid", "refund_failed"].includes(input.attemptState) ||
    input.provider === "mollie" && input.providerMode !== "live" ||
    input.purpose !== "first_payment" || input.grossMinor !== input.paidGrossMinor || input.currency !== input.paidCurrency) {
    throw new Error("Email provisioning requires the matching settled order and payment.")
  }
}

export function mailProviderAnnualCostMinor(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) throw new Error("PAX8_CURRENT_COST_INVALID")
  const minor = Math.ceil(Number(value) * 100)
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("PAX8_CURRENT_COST_INVALID")
  return minor
}
