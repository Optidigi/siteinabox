import type { CollectionBeforeChangeHook } from "payload"

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

export const protectTenantCommercialPolicy: CollectionBeforeChangeHook = ({ data, originalDoc, req, operation }) => {
  if (!data) return data
  const original = record(originalDoc)
  const nextPolicy = record(data.platformPricing ?? original.platformPricing)
  const previousPolicy = record(original.platformPricing)
  const normalized = (policy: Record<string, unknown>) => ({ mode: policy.mode ?? "standard", reason: policy.reason ?? "", expiresAt: policy.expiresAt ?? null })
  const changed = JSON.stringify(normalized(nextPolicy)) !== JSON.stringify(normalized(previousPolicy)) ||
    JSON.stringify(data.enabledServices ?? original.enabledServices ?? ["website"]) !== JSON.stringify(original.enabledServices ?? ["website"]) ||
    (data.emailPaymentMethod ?? original.emailPaymentMethod ?? "mollie") !== (original.emailPaymentMethod ?? "mollie")
  const historyChanged = "commercialPolicyHistory" in data &&
    JSON.stringify(data.commercialPolicyHistory) !== JSON.stringify(original.commercialPolicyHistory)
  if (operation === "create" && nextPolicy.mode !== "exempt" && !historyChanged) return data
  if ((changed || historyChanged) && (req.context?.tenantCommercialPolicyMutation !== true || req.user?.role !== "super-admin")) {
    throw new Error("Customer service and pricing policies require the commercial policy action.")
  }
  if (nextPolicy.mode === "exempt" && !String(nextPolicy.reason ?? "").trim()) {
    throw new Error("A platform pricing exemption requires a reason.")
  }
  if (nextPolicy.expiresAt && !Number.isFinite(Date.parse(String(nextPolicy.expiresAt)))) {
    throw new Error("Invalid pricing exemption end date.")
  }
  if (changed) {
    data.commercialPolicyHistory = [...(Array.isArray(original.commercialPolicyHistory) ? original.commercialPolicyHistory : []), {
      changedAt: new Date().toISOString(), changedBy: String(req.user?.id),
      services: data.enabledServices ?? original.enabledServices ?? ["website"],
      emailPaymentMethod: data.emailPaymentMethod ?? original.emailPaymentMethod ?? "mollie",
      previousPolicy, policy: nextPolicy,
    }]
  }
  return data
}
