import assert from "node:assert/strict"
import test from "node:test"
import { evaluateMailAuthority, requiredMailRoleIds } from "../../src/lib/microsoftMailProvisioning/mailAuthority.ts"
import { mailGdapRoleIds as roles } from "../../src/lib/microsoftMailProvisioning/gdapCapabilities.ts"
const tenantId = "00000000-0000-4000-8000-000000000002"
const base = { tenantId, relationshipTenantId: tenantId, relationshipId: "relationship", relationshipStatus: "active", assignmentId: "assignment", assignmentStatus: "active", groupId: "group", assignedGroupId: "group", approvedRoleIds: requiredMailRoleIds, assignedRoleIds: requiredMailRoleIds, now: new Date("2026-11-04T12:00:00Z") }
test("default PRA delegation supports bootstrap but never mail administration", () => {
 const partial = [roles.userAdministrator, roles.licenseAdministrator, roles.privilegedRoleAdministrator, roles.globalReader]
 const result = evaluateMailAuthority({ ...base, approvedRoleIds: partial, assignedRoleIds: partial })
 assert.equal(result.status, "not_ready")
 assert.equal(result.nextAction, "bootstrap_customer_admin")
 assert.deepEqual(result.missingRoles, [roles.domainNameAdministrator, roles.exchangeAdministrator, roles.cloudApplicationAdministrator, roles.securityAdministrator])
})
test("full matching delegation is ready only for consent verification", () => {
 const result = evaluateMailAuthority(base)
 assert.equal(result.status, "delegation_ready")
 assert.equal(result.nextAction, "verify_resource_access")
 assert.equal(evaluateMailAuthority({ ...base, resourcesVerified: true }).status, "ready")
})
test("wrong tenant/group, missing assignment, expired relationship and missing roles fail closed", () => {
 for (const patch of [{ relationshipTenantId: "other" }, { assignedGroupId: "other" }, { assignmentStatus: "pending" }, { relationshipStatus: "expired" }, { endDateTime: "2026-11-03T00:00:00Z" }, { endDateTime: "invalid" }, { assignedRoleIds: [] }]) {
  assert.equal(evaluateMailAuthority({ ...base, resourcesVerified: true, ...patch }).status, "not_ready")
 }
})
test("Application Administrator is accepted in place of Cloud Application Administrator", () => {
 const ids = requiredMailRoleIds.map(id => id === roles.cloudApplicationAdministrator ? roles.applicationAdministrator : id)
 assert.equal(evaluateMailAuthority({ ...base, approvedRoleIds: ids, assignedRoleIds: ids }).status, "delegation_ready")
})
