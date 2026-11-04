import { mailGdapRoleIds as roles } from "./gdapCapabilities.ts"

/** Customer admin bootstrap and workload delegation are separate authorities. */
export { requiredMailRoleIds } from "@siteinabox/contracts/microsoft-mail-authority"
import { requiredMailRoleIds } from "@siteinabox/contracts/microsoft-mail-authority"
export type MailAuthority = {
  version: 1
  route: "managed_customer_admin"
  status: "not_ready" | "delegation_ready" | "ready"
  tenantId: string
  grantedRoles: string[]
  missingRoles: string[]
  nextAction: "bootstrap_customer_admin" | "verify_delegation" | "verify_resource_access" | "none"
  evidence: { relationshipId: string; assignmentId: string; observedAt: string; expiresAt: string | null; bindingVerified: boolean }
}

export function evaluateMailAuthority(input: {
  tenantId: string; relationshipTenantId?: string; relationshipId: string; relationshipStatus: string;
  assignmentId: string; assignmentStatus: string; groupId: string; assignedGroupId?: string;
  approvedRoleIds: readonly string[]; assignedRoleIds: readonly string[]; endDateTime?: string;
  resourcesVerified?: boolean; now?: Date
}): MailAuthority {
  const now = input.now ?? new Date()
  const approved = new Set(input.approvedRoleIds.map(id => id.toLowerCase()))
  const grantedRoles = [...new Set(input.assignedRoleIds.map(id => id.toLowerCase()))].filter(id => approved.has(id)).sort()
  const missingRoles = requiredMailRoleIds.filter(id => id === roles.cloudApplicationAdministrator
    ? !grantedRoles.includes(id) && !grantedRoles.includes(roles.applicationAdministrator)
    : !grantedRoles.includes(id))
  const bindingVerified = !!input.tenantId && input.relationshipTenantId?.toLowerCase() === input.tenantId.toLowerCase() &&
    !!input.groupId && input.assignedGroupId?.toLowerCase() === input.groupId.toLowerCase() && !!input.relationshipId && !!input.assignmentId
  const active = bindingVerified && input.relationshipStatus.toLowerCase() === "active" && input.assignmentStatus.toLowerCase() === "active" &&
    (!input.endDateTime || Date.parse(input.endDateTime) > now.getTime())
  const bootstrapAvailable = active && grantedRoles.includes(roles.userAdministrator) && grantedRoles.includes(roles.privilegedRoleAdministrator)
  const status = active && !missingRoles.length ? input.resourcesVerified === true ? "ready" : "delegation_ready" : "not_ready"
  return { version: 1, route: "managed_customer_admin", status, tenantId: input.tenantId, grantedRoles, missingRoles,
    nextAction: status === "ready" ? "none" : status === "delegation_ready" ? "verify_resource_access" : bootstrapAvailable ? "bootstrap_customer_admin" : "verify_delegation",
    evidence: { relationshipId: input.relationshipId, assignmentId: input.assignmentId, observedAt: now.toISOString(), expiresAt: input.endDateTime ?? null, bindingVerified } }
}

/** Evidence is short lived and tenant bound; stored completed steps never confer authority. */
export function mailDelegationCurrent(value: unknown, tenantId: string, now = Date.now()): value is MailAuthority {
  if (!value || typeof value !== "object") return false
  const authority = value as Partial<MailAuthority>
  const evidence = authority.evidence
  return authority.version === 1 && authority.route === "managed_customer_admin" && (authority.status === "ready" || authority.status === "delegation_ready") && authority.tenantId === tenantId &&
    Array.isArray(authority.missingRoles) && authority.missingRoles.length === 0 && evidence?.bindingVerified === true &&
    Number.isFinite(Date.parse(evidence.observedAt)) && Date.parse(evidence.observedAt) <= now && now - Date.parse(evidence.observedAt) < 300_000 &&
    (!evidence.expiresAt || Date.parse(evidence.expiresAt) > now)
}

export function mailAuthorityCurrent(value: unknown, tenantId: string, now = Date.now()): value is MailAuthority {
  return mailDelegationCurrent(value, tenantId, now) && value.status === "ready"
}
