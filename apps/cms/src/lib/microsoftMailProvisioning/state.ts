import { createHash } from "node:crypto"

export const microsoftMailProvisioningStates = [
  "prepared",
  "tenant_pending",
  "consent_pending",
  "subscription_pending",
  "domain_pending",
  "dns_pending",
  "mailboxes_pending",
  "exchange_pending",
  "setup_mail_pending",
  "ready",
  "manual_review",
  "failed",
  "cancelled",
] as const

export type MicrosoftMailProvisioningState =
  (typeof microsoftMailProvisioningStates)[number]

const transitions: Record<MicrosoftMailProvisioningState, readonly MicrosoftMailProvisioningState[]> = {
  prepared: ["tenant_pending", "manual_review", "failed", "cancelled"],
  tenant_pending: ["consent_pending", "subscription_pending", "manual_review", "failed", "cancelled"],
  consent_pending: ["subscription_pending", "domain_pending", "manual_review", "failed", "cancelled"],
  subscription_pending: ["consent_pending", "domain_pending", "manual_review", "failed", "cancelled"],
  domain_pending: ["dns_pending", "exchange_pending", "manual_review", "failed", "cancelled"],
  dns_pending: ["mailboxes_pending", "exchange_pending", "manual_review", "failed", "cancelled"],
  mailboxes_pending: ["dns_pending", "exchange_pending", "manual_review", "failed", "cancelled"],
  exchange_pending: ["dns_pending", "mailboxes_pending", "setup_mail_pending", "manual_review", "failed", "cancelled"],
  setup_mail_pending: ["ready", "manual_review", "failed", "cancelled"],
  ready: [],
  manual_review: ["tenant_pending", "consent_pending", "subscription_pending", "domain_pending", "dns_pending", "mailboxes_pending", "exchange_pending", "setup_mail_pending", "failed", "cancelled"],
  failed: [],
  cancelled: [],
}

export function assertMicrosoftMailStateTransition(
  current: MicrosoftMailProvisioningState,
  next: MicrosoftMailProvisioningState,
): MicrosoftMailProvisioningState {
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid Microsoft mail provisioning transition: ${current} -> ${next}.`)
  }
  return next
}

export function createMicrosoftMailProvisioningKey(input: {
  tenantId: number | string
  domain: string
  mailboxAddresses: readonly string[]
  product: string
}): string {
  const tenantId = String(input.tenantId).trim()
  const domain = input.domain.trim().toLowerCase()
  const mailboxAddresses = [...input.mailboxAddresses]
    .map((address) => address.trim().toLowerCase())
    .sort()
  const product = input.product.trim()
  if (!tenantId || !domain || !product || mailboxAddresses.length === 0 || mailboxAddresses.some((address) => !address)) {
    throw new Error("A provisioning key requires a tenant, domain, product, and mailbox addresses.")
  }
  const canonical = JSON.stringify({ tenantId, domain, mailboxAddresses, product })
  return `m365-mail:${createHash("sha256").update(canonical).digest("hex")}`
}
