export type PublicAnalyticsConsentApproval = Readonly<{
  privacyDocumentVersion: string
  consentVersion: string | null
  maxEventRetentionDays: number
}>

export type PublicAnalyticsConsentSettings = {
  enabled?: unknown
  provider?: unknown
  consentStorageKey?: unknown
  consentVersion?: unknown
}

export const publicAnalyticsConsentApproval: PublicAnalyticsConsentApproval

export function matchesApprovedPublicAnalyticsConsent(
  consent: PublicAnalyticsConsentSettings | null | undefined,
  approvedVersion?: string | null,
): boolean
