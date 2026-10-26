export type WorkspaceService = "website" | "email"
export type WorkspaceServices = { enabledServices?: unknown }

/** Missing values preserve website access for existing tenants. */
export function hasWorkspaceService(tenant: WorkspaceServices, service: WorkspaceService): boolean {
  return Array.isArray(tenant.enabledServices)
    ? tenant.enabledServices.includes(service)
    : service === "website"
}

export type PlatformPricingPolicy = {
  mode?: "standard" | "exempt" | null
  reason?: string | null
  expiresAt?: string | null
}

export function platformFeesExempt(policy: PlatformPricingPolicy | null | undefined, now = new Date()): boolean {
  if (policy?.mode !== "exempt" || !policy.reason?.trim()) return false
  return !policy.expiresAt || new Date(policy.expiresAt).getTime() > now.getTime()
}

/** Exemptions apply to Siteinabox charges; provider costs remain payable. */
export function applyPlatformPricing(input: {
  platformNetMinor: number
  providerNetMinor: number
  policy?: PlatformPricingPolicy | null
  now?: Date
}) {
  for (const value of [input.platformNetMinor, input.providerNetMinor]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid commercial amount.")
  }
  const exempt = platformFeesExempt(input.policy, input.now)
  const platformNetMinor = exempt ? 0 : input.platformNetMinor
  return { platformNetMinor, providerNetMinor: input.providerNetMinor,
    platformDiscountNetMinor: input.platformNetMinor - platformNetMinor,
    subtotalNetMinor: platformNetMinor + input.providerNetMinor, exempt }
}
