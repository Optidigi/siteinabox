import assert from "node:assert/strict"
import test from "node:test"
import { selectMailGdapRoles, mailGdapRoleIds as roles } from "../../src/lib/microsoftMailProvisioning/gdapCapabilities.ts"

test("selects only granted workload and consent roles, including default PRA bootstrap",()=>{
 const selected=selectMailGdapRoles([roles.userAdministrator,roles.licenseAdministrator,roles.privilegedRoleAdministrator])
 assert.deepEqual(selected?.roleDefinitionIds,[roles.userAdministrator,roles.licenseAdministrator,roles.privilegedRoleAdministrator])
 assert.equal(selected?.consentRole,"privilegedRoleAdministrator")
 assert.equal(selected?.domainAdministration,false)
 assert.equal(selected?.exchangeAdministration,false)
})
test("prefers a narrower application consent role and retains granted workload roles",()=>{
 const selected=selectMailGdapRoles(Object.values(roles))
 assert.equal(selected?.consentRole,"cloudApplicationAdministrator")
 assert.equal(selected?.domainAdministration,true)
 assert.equal(selected?.exchangeAdministration,true)
 assert.equal(selected?.roleDefinitionIds.includes(roles.privilegedRoleAdministrator),false)
})
test("does not invent a missing directory or application-consent grant",()=>{
 assert.equal(selectMailGdapRoles([roles.userAdministrator,roles.licenseAdministrator]),null)
 assert.equal(selectMailGdapRoles([roles.cloudApplicationAdministrator]),null)
 assert.equal(selectMailGdapRoles([]),null)
})


test("retains granted read-only Exchange diagnostics without mistaking it for write access",()=>{
 const selected=selectMailGdapRoles([roles.userAdministrator,roles.licenseAdministrator,roles.privilegedRoleAdministrator,roles.globalReader])
 assert.equal(selected?.exchangeReadAccess,true)
 assert.equal(selected?.exchangeAdministration,false)
 assert.ok(selected?.roleDefinitionIds.includes(roles.globalReader))
})
