/**
 * Legal/product approval gate for optional analytics on generated public sites.
 * A non-null consentVersion may only be added with the matching approved shared
 * consent chrome and a reviewed platform privacy release.
 */
export const publicAnalyticsConsentApproval = Object.freeze({
  privacyDocumentVersion: '2026-07-07.1',
  consentVersion: '2026-07-07.1',
  maxEventRetentionDays: 396,
})

export function matchesApprovedPublicAnalyticsConsent(consent, approvedVersion = publicAnalyticsConsentApproval.consentVersion) {
  if (typeof approvedVersion !== 'string' || !approvedVersion.trim()) return false
  if (!consent || typeof consent !== 'object' || Array.isArray(consent)) return false
  if (consent.enabled !== true || consent.provider !== 'posthog') return false
  if (typeof consent.consentStorageKey !== 'string' || !consent.consentStorageKey.trim()) return false
  return consent.consentVersion === approvedVersion
}
