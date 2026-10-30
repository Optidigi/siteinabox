/** Microsoft Entra built-in role template IDs; never infer grants from partner status. */
export const mailGdapRoleIds = {
  userAdministrator: "fe930be7-5e62-47db-91af-98c3a49a38b1",
  licenseAdministrator: "4d6ac14f-3453-41d0-bef9-a3e0c569773a",
  privilegedRoleAdministrator: "e8611ab8-c189-46e8-94e1-60213ab1f814",
  cloudApplicationAdministrator: "158c047a-c907-4556-b7ef-446551a6b5f7",
  applicationAdministrator: "9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3",
  domainNameAdministrator: "8329153b-31d0-4727-b945-745eb3bc5f31",
  exchangeAdministrator: "29232cdf-9323-42fd-ade2-1d097af3e4de",
  globalReader: "f2ef992c-3afb-46b9-b7cf-a126ee74c451",
} as const

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
    consentRole, domainAdministration, exchangeAdministration, exchangeReadAccess: exchangeAdministration || granted.has(roles.globalReader),
    roleDefinitionIds: [roles.userAdministrator, roles.licenseAdministrator, roles[consentRole],
      ...(domainAdministration ? [roles.domainNameAdministrator] : []),
      ...(exchangeAdministration ? [roles.exchangeAdministrator] : granted.has(roles.globalReader) ? [roles.globalReader] : []),
    ],
  }
}
