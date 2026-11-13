import { createHash } from "node:crypto"

export const mailGdapRoleIds = {
  userAdministrator: "fe930be7-5e62-47db-91af-98c3a49a38b1",
  licenseAdministrator: "4d6ac14f-3453-41d0-bef9-a3e0c569773a",
  privilegedRoleAdministrator: "e8611ab8-c189-46e8-94e1-60213ab1f814",
  cloudApplicationAdministrator: "158c047a-c907-4556-b7ef-446551a6b5f7",
  applicationAdministrator: "9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3",
  domainNameAdministrator: "8329153b-31d0-4727-b945-745eb3bc5f31",
  exchangeAdministrator: "29232cdf-9323-42fd-ade2-1d097af3e4de",
  globalReader: "f2ef992c-3afb-46b9-b7cf-a126ee74c451",
  /** Required to switch the tenant security-defaults policy (password-only sign-in product decision). */
  securityAdministrator: "194ae4cb-b126-40b2-bd5b-6091b380977d",
} as const
export const requiredMailRoleIds: readonly string[] = [mailGdapRoleIds.userAdministrator, mailGdapRoleIds.licenseAdministrator, mailGdapRoleIds.domainNameAdministrator, mailGdapRoleIds.exchangeAdministrator, mailGdapRoleIds.cloudApplicationAdministrator, mailGdapRoleIds.securityAdministrator]

export const mailApplicationResources = [
  { resource: "graph", resourceApplicationId: "00000003-0000-0000-c000-000000000000", scopePrefix: "https://graph.microsoft.com", scopes: ["Directory.Read.All", "Organization.Read.All", "Domain.ReadWrite.All", "User.ReadWrite.All", "LicenseAssignment.ReadWrite.All"] },
  { resource: "exchange", resourceApplicationId: "00000002-0000-0ff1-ce00-000000000000", scopePrefix: "https://outlook.office365.com", scopes: ["Exchange.Manage"] },
] as const

/**
 * Versioned extension grant for the sign-in policy (read and switch tenant security
 * defaults). It is kept outside `mailApplicationResources` so the reviewed v2 bootstrap
 * grant catalogue and its readback stay unchanged; the CMS upgrades each tenant's
 * grant explicitly in the `sign_in_policy` provisioning step.
 */
export const MAIL_SIGN_IN_GRANT_VERSION = "microsoft-mail-sign-in-grants-v1"
export const mailSignInGraphScopes: readonly string[] = ["Policy.Read.All", "Policy.ReadWrite.SecurityDefaults"]

export const MAIL_BOOTSTRAP_PROTOCOL = "siab-managed-mail-authority-v1"
export type MailBootstrapInput = { runId: string; orderId: string; tenantId: string; initialDomain: string; domain: string; applicationId: string; partnerTenantId: string; groupId: string; sourceRelationshipId: string; targetRelationshipId: string }
export type MailBootstrapJob = MailBootstrapInput & { id: string; binding: string; protocol: typeof MAIL_BOOTSTRAP_PROTOCOL; requiredRoleIds: readonly string[] }
export type MailBootstrapReceipt = { phase: "pending" | "blocked" | "uncertain" } | { phase: "complete"; relationshipId: string }

/** No credentials, bearer tokens, arbitrary URLs or customer-visible approval links cross this boundary. */
export function createMailBootstrapJob(input: MailBootstrapInput): MailBootstrapJob {
  for (const id of [input.tenantId, input.applicationId, input.partnerTenantId, input.groupId]) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error("MAIL_BOOTSTRAP_BINDING_INVALID")
  }
  if (input.tenantId.toLowerCase() === input.partnerTenantId.toLowerCase() || !/^[a-z0-9][a-z0-9-]{0,61}\.onmicrosoft\.com$/.test(input.initialDomain) ||
    !/^[a-z0-9.-]+\.[a-z]{2,63}$/.test(input.domain) || !/^[0-9]+$/.test(input.runId) || !/^[0-9]+$/.test(input.orderId) ||
    !/^[a-z0-9-]{1,160}$/i.test(input.sourceRelationshipId) || !/^[a-z0-9-]{1,160}$/i.test(input.targetRelationshipId) || input.targetRelationshipId.toLowerCase() === input.sourceRelationshipId.toLowerCase()) throw new Error("MAIL_BOOTSTRAP_BINDING_INVALID")
  const binding = createHash("sha256").update(JSON.stringify([MAIL_BOOTSTRAP_PROTOCOL, input.runId, input.orderId, input.tenantId.toLowerCase(), input.initialDomain, input.domain,
    input.applicationId.toLowerCase(), input.partnerTenantId.toLowerCase(), input.groupId.toLowerCase(), input.sourceRelationshipId, input.targetRelationshipId, requiredMailRoleIds, mailApplicationResources])).digest("hex")
  return { runId: input.runId, orderId: input.orderId, tenantId: input.tenantId, initialDomain: input.initialDomain, domain: input.domain,
    applicationId: input.applicationId, partnerTenantId: input.partnerTenantId, groupId: input.groupId,
    sourceRelationshipId: input.sourceRelationshipId, targetRelationshipId: input.targetRelationshipId,
    protocol: MAIL_BOOTSTRAP_PROTOCOL, id: binding, binding, requiredRoleIds: requiredMailRoleIds }
}

/** Validate untrusted private-worker requests without accepting extra secret fields. */
export function parseMailBootstrapJob(value: unknown): MailBootstrapJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MAIL_BOOTSTRAP_BINDING_INVALID")
  const raw = value as Record<string, unknown>
  const fields = ["runId", "orderId", "tenantId", "initialDomain", "domain", "applicationId", "partnerTenantId", "groupId", "sourceRelationshipId", "targetRelationshipId"] as const
  if (Object.keys(raw).some(key => ![...fields, "id", "binding", "protocol", "requiredRoleIds"].includes(key)) || fields.some(key => typeof raw[key] !== "string")) throw new Error("MAIL_BOOTSTRAP_BINDING_INVALID")
  const input = Object.fromEntries(fields.map(key => [key, raw[key]])) as MailBootstrapInput
  const job = createMailBootstrapJob(input)
  if (raw.id !== job.id || raw.binding !== job.binding || raw.protocol !== job.protocol || JSON.stringify(raw.requiredRoleIds) !== JSON.stringify(job.requiredRoleIds)) throw new Error("MAIL_BOOTSTRAP_BINDING_INVALID")
  return job
}
