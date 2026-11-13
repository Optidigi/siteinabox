/** Microsoft Entra built-in role template IDs; never infer grants from partner status. */
export { mailGdapRoleIds } from "@siteinabox/contracts/microsoft-mail-authority"
import { mailGdapRoleIds } from "@siteinabox/contracts/microsoft-mail-authority"

/** Select existing delegation only. A selection is not proof of effective workload access. */
export function selectMailGdapRoles(grantedRoleIds: readonly string[]) {
  const granted = new Set(grantedRoleIds.map(id => id.toLowerCase()))
  const roles = mailGdapRoleIds
  if (!granted.has(roles.userAdministrator) || !granted.has(roles.licenseAdministrator)) return null
  const consentRole = (["cloudApplicationAdministrator", "applicationAdministrator", "privilegedRoleAdministrator"] as const).find(key => granted.has(roles[key]))
  if (!consentRole) return null
  const domainAdministration = granted.has(roles.domainNameAdministrator)
  const exchangeAdministration = granted.has(roles.exchangeAdministrator)
  return {
    consentRole, domainAdministration, exchangeAdministration, securityAdministration: granted.has(roles.securityAdministrator), exchangeReadAccess: exchangeAdministration || granted.has(roles.globalReader),
    roleDefinitionIds: [roles.userAdministrator, roles.licenseAdministrator, roles[consentRole],
      ...(domainAdministration ? [roles.domainNameAdministrator] : []),
      ...(exchangeAdministration ? [roles.exchangeAdministrator] : granted.has(roles.globalReader) ? [roles.globalReader] : []),
      // Selected when present; authority evaluation reports it missing otherwise (bootstrap then adds it).
      ...(granted.has(roles.securityAdministrator) ? [roles.securityAdministrator] : []),
    ],
  }
}
