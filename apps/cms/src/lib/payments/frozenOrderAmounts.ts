import type { Order } from "@/payload-types"

export type FrozenOrderAmounts = {
  netAmountMinor: number
  vatAmountMinor: number
  grossAmountMinor: number
}

export function frozenOrderAmounts(
  order: Order,
  invalidMessage = "Frozen order amounts are invalid.",
): FrozenOrderAmounts {
  const netAmountMinor = order.subtotalNetMinor
  const vatAmountMinor = order.vatAmountMinor
  const grossAmountMinor = order.totalGrossMinor
  if (
    Number.isSafeInteger(netAmountMinor) &&
    Number.isSafeInteger(vatAmountMinor) &&
    Number.isSafeInteger(grossAmountMinor) &&
    netAmountMinor != null &&
    vatAmountMinor != null &&
    grossAmountMinor != null
  ) {
    return { netAmountMinor, vatAmountMinor, grossAmountMinor }
  }
  const legacyAmounts = {
    netAmountMinor: Math.round(Number(order.subtotalNet) * 100),
    vatAmountMinor: Math.round(Number(order.vatAmount) * 100),
    grossAmountMinor: Math.round(Number(order.totalGross) * 100),
  }
  if (
    !Object.values(legacyAmounts).every(
      (amount) => Number.isSafeInteger(amount) && amount >= 0,
    )
  ) {
    throw new Error(invalidMessage)
  }
  return legacyAmounts
}
