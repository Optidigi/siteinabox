import "server-only"
import type { Payload } from "payload"
import { relationshipId } from "../relationshipId"
import type { Order } from "@/payload-types"
export class PlatformPricingExemptError extends Error {}

export async function assertPlatformCollectionAllowed(payload: Payload, order: Pick<Order, "tenant" | "orderKind">) {
  if (order.orderKind !== "initial_subscription" && order.orderKind !== "subscription_renewal") return
  const tenantId = relationshipId(order.tenant)
  if (!tenantId) throw new Error("Platform billing requires a customer workspace.")
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
  if (tenant.platformPricing?.mode === "exempt") throw new PlatformPricingExemptError("This customer's platform plan is managed by Siteinabox. Automatic platform collection is disabled.")
}
