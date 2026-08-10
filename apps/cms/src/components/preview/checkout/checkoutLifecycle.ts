import type { CustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import type { CustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"

export const checkoutStatusNeedsPolling = (input: {
  paymentReturn: boolean
  paymentStatus: string
  migrationStatus: CustomerMigrationStatus | null
  provisioningStatus: CustomerProvisioningStatus | null
}): boolean => {
  if (!input.paymentReturn) return false
  if (
    ["failed", "canceled", "cancelled", "expired"].includes(
      input.paymentStatus,
    )
  ) {
    return false
  }
  if (
    input.provisioningStatus?.stages.some(
      (stage) =>
        stage.status === "review" ||
        (stage.code === "activation" && stage.status === "complete"),
    )
  ) {
    return false
  }
  if (input.migrationStatus) {
    if (
      ["completed", "custom_quote_required", "failed", "rolled_back"]
        .includes(input.migrationStatus.state)
    ) {
      return false
    }
    if (
      input.migrationStatus.actions.some((action) =>
        ["required", "failed", "overdue"].includes(action.status))
    ) {
      return false
    }
  }
  return true
}
