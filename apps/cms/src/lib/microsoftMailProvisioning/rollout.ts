import { platformFeesExempt, type PlatformPricingPolicy } from "../tenants/services.ts"

const listed = (value: string | undefined, domain: string) => (value ?? "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean).includes(domain.toLowerCase())

/** An empty rollout list closes checkout and fulfillment. */
export function requireMailDomainEnabled(domain: string, env: Readonly<Record<string, string | undefined>> = process.env): void {
  if (!listed(env["MICROSOFT_MAIL_ALLOWED_DOMAINS"], domain)) throw new Error("Email ordering is not enabled for this domain.")
}

/** Sponsorship is separate from the ordinary platform-fee exemption. */
export function mailOrderSponsored(tenant: { emailPaymentMethod?: string | null; platformPricing?: PlatformPricingPolicy | null }, domain: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return listed(env["MICROSOFT_MAIL_ALLOWED_DOMAINS"], domain) && listed(env["MICROSOFT_MAIL_SPONSORED_DOMAINS"], domain) && tenant.emailPaymentMethod === "manual" && platformFeesExempt(tenant.platformPricing)
}
