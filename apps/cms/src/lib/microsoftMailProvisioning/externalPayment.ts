import { z } from "zod"

export const externalMailPaymentSchema = z.object({
  id: z.string().uuid(),
  domain: z.string().min(3),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(300),
  term: z.literal("annual"),
  maxGrossMinor: z.number().int().positive().max(100000000),
  reference: z.string().trim().min(1).max(500),
  approvedBy: z.number().int().positive(),
  approvedByEmail: z.string().email(),
  approvedAt: z.string().datetime(),
  consumedOrderId: z.number().int().positive().nullable(),
}).strict()
export type ExternalMailPayment = z.infer<typeof externalMailPaymentSchema>

/** This is a bounded funding approval, independent of platform-fee exemption. */
export function externalMailPaymentForQuote(value: unknown, input: {
  domain: string; productId: string; quantity: number; operation: string; totalGrossMinor: number
}): ExternalMailPayment | null {
  if (value == null) return null
  const approval = externalMailPaymentSchema.parse(value)
  if (input.operation !== "initial" || approval.consumedOrderId !== null) return null
  if (approval.domain !== input.domain || approval.productId !== input.productId) throw new Error("External payment domain or product changed. Contact Siteinabox.")
  if (approval.quantity !== input.quantity) throw new Error("Set up the approved prepaid mailbox count first. Additional mailboxes can be purchased afterward.")
  if (input.totalGrossMinor > approval.maxGrossMinor) throw new Error("Order exceeds the externally covered amount. Refresh approval before confirming.")
  return approval
}
