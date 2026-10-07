import { z } from "zod"
import type { MollieCustomer, MollieMandate, MolliePayment, MollieRefund } from "./mollieAdapter"

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`)).max(128)
const text = z.string().max(4096)
const nullableText = text.nullable().optional()
const timestamp = z.iso.datetime({ offset: true }).nullable().optional()
const metadata = z.record(z.string(), z.unknown()).nullable().optional()
export const mollieAmountSchema = z.object({ currency: z.literal("EUR"), value: z.string().regex(/^\d+\.\d{2}$/).max(18) }).refine(({ value }) => Number.isSafeInteger(Number(value.replace(".", ""))), "Unsafe money amount")
const status = (known: readonly string[]) => text.transform((value) => known.includes(value) ? value : "unknown")
const refund = z.object({
  id: id("re"), status: status(["queued", "pending", "processing", "refunded", "failed", "canceled"]),
  amount: mollieAmountSchema, createdAt: timestamp, description: nullableText, metadata,
})
const chargeback = z.object({
  id: id("chb"), amount: mollieAmountSchema, createdAt: timestamp,
  reason: z.object({ code: nullableText, description: nullableText }).nullable().optional(),
})
const checkoutUrl = z.string().url().max(4096).refine((value) => {
  const url = new URL(value)
  return url.protocol === "https:" && !url.username && !url.password && !url.port &&
    (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"))
}, "Untrusted Mollie checkout URL")
const payment = z.object({
  id: id("tr"), status: status(["open", "canceled", "pending", "authorized", "expired", "failed", "paid"]), amount: mollieAmountSchema,
  amountChargedBack: mollieAmountSchema.optional(), amountRefunded: mollieAmountSchema.optional(), amountRemaining: mollieAmountSchema.optional(),
  customerId: id("cst").nullable().optional(), mandateId: id("mdt").nullable().optional(),
  sequenceType: status(["first", "recurring", "oneoff"]).nullable().optional(),
  authorizedAt: timestamp, paidAt: timestamp, failedAt: timestamp,
  canceledAt: timestamp, expiredAt: timestamp, createdAt: timestamp, metadata,
  _embedded: z.object({ refunds: z.array(refund).max(250).optional(), chargebacks: z.array(chargeback).max(250).optional() }).optional(),
  _links: z.object({ checkout: z.object({ href: checkoutUrl }).optional() }).optional(),
})
const completePayment = payment.superRefine((value, ctx) => {
  if (value._embedded?.refunds?.some((item) => item.status === "unknown")) ctx.addIssue({ code: "custom", message: "Unknown financial adjustment state" })
  const minor = (amount: { value: string }) => Number(amount.value.replace(".", ""))
  const refunds = value._embedded?.refunds ?? []
  const chargebacks = value._embedded?.chargebacks ?? []
  const refunded = refunds.filter(item => item.status === "refunded").reduce((sum, item) => sum + minor(item.amount), 0)
  const pendingRefunded = refunds.filter(item => ["queued", "pending", "processing"].includes(item.status)).reduce((sum, item) => sum + minor(item.amount), 0)
  const chargedBack = chargebacks.reduce((sum, item) => sum + minor(item.amount), 0)
  if (!Number.isSafeInteger(refunded + pendingRefunded) || !Number.isSafeInteger(chargedBack) ||
      new Set(refunds.map(item => item.id)).size !== refunds.length || new Set(chargebacks.map(item => item.id)).size !== chargebacks.length) {
    ctx.addIssue({ code: "custom", message: "Invalid financial adjustment evidence" })
  }
  // The API describes the aggregate as already refunded, but does not promise
  // atomic snapshots across in-flight refund states. Known pending evidence
  // may explain an aggregate between completed and active totals; it remains
  // refund_pending in the business projection and cannot grant paid authority.
  if ((value.amountRefunded && minor(value.amountRefunded) > 0 &&
       (minor(value.amountRefunded) < refunded || minor(value.amountRefunded) > refunded + pendingRefunded)) ||
      (value.amountChargedBack && minor(value.amountChargedBack) > 0 && chargedBack !== minor(value.amountChargedBack))) {
    ctx.addIssue({ code: "custom", message: "Missing financial adjustment evidence" })
  }
})
const customer = z.object({ id: id("cst"), name: nullableText, email: nullableText, metadata })
const mandate = z.object({ id: id("mdt"), status: status(["valid", "pending", "invalid"]), method: nullableText, createdAt: timestamp })
const nextLink = z.object({ next: z.object({ href: text.nullable().optional() }).nullable().optional() }).optional()

function parse<T>(schema: z.ZodType<T>, raw: unknown, operation: string): T {
  const result = schema.safeParse(raw)
  // Provider payloads and schema diagnostics can contain customer data or secrets.
  if (!result.success) throw new Error(`${operation}: invalid provider response.`)
  return result.data
}

export function parseMollieCustomer(raw: unknown): MollieCustomer { return parse(customer, raw, "Mollie customer") }
export function parseMolliePayment(raw: unknown, expectedId?: string): MolliePayment {
  const result = parse(completePayment, raw, "Mollie payment")
  if (expectedId && result.id !== expectedId) throw new Error("Mollie payment identity mismatch.")
  return result
}
export function parseMollieMandate(raw: unknown, expectedId: string): MollieMandate {
  const result = parse(mandate, raw, "Mollie mandate")
  if (result.id !== expectedId) throw new Error("Mollie mandate identity mismatch.")
  return result
}
export function parseMollieRefund(raw: unknown): MollieRefund { return parse(refund, raw, "Mollie refund") }
export function parseMollieCustomerList(raw: unknown) { return parse(z.object({ _embedded: z.object({ customers: z.array(customer).max(250) }), _links: nextLink }), raw, "Mollie customer list") }
export function parseMolliePaymentList(raw: unknown) { return parse(z.object({ _embedded: z.object({ payments: z.array(completePayment).max(250) }), _links: nextLink }), raw, "Mollie payment list") }
export function assertMollieId(value: string, prefix: "tr" | "cst" | "mdt"): void { parse(id(prefix), value, "Mollie request identity") }


// IDs documented by Mollie's current Get payment method contract. Unknown
// capability IDs cannot establish that recurring payment setup is supported.
const methodId = z.enum(["alma", "applepay", "bacs", "bancomatpay", "bancontact", "banktransfer", "belfius", "billie", "billink", "bizum", "blik", "creditcard", "directdebit", "eps", "giftcard", "ideal", "in3", "kbc", "klarna", "mbway", "mobilepay", "multibanco", "mybank", "paybybank", "paypal", "paysafecard", "pointofsale", "przelewy24", "riverty", "satispay", "swish", "trustly", "twint", "vipps", "voucher", "wero"])
export function parseMollieMethods(raw: unknown) {
  return parse(z.object({ _embedded: z.object({ methods: z.array(z.object({ id: methodId })).min(1).max(250) }) }), raw, "Mollie payment methods")
}
