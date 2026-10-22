export const accountLinkNamespaces = ["preview", "cms", "payload"] as const
export const accountLinkPurposes = ["free_verification", "preview_login", "cms_login", "invitation", "site_handoff", "password_reset", "legacy_login"] as const
export const accountLinkLanes = ["acquisition", "returning", "protected"] as const
export const accountLinkStates = ["admitted", "queued", "issuing", "dispatching", "sent", "indeterminate", "failed", "consumed", "cancelled", "legacy"] as const

export type AccountLinkNamespace = (typeof accountLinkNamespaces)[number]
export type AccountLinkPurpose = (typeof accountLinkPurposes)[number]
export type AccountLinkLane = (typeof accountLinkLanes)[number]
export type AccountLinkState = (typeof accountLinkStates)[number]

export type AccountLinkTarget = {
  namespace: AccountLinkNamespace
  purpose: AccountLinkPurpose
  lane: AccountLinkLane
  recipient: string
  origin: string
  callbackPath: string
  errorCallbackPath: string
  payloadUserId?: string
  previewUserId?: string
  tenantId?: string
  role?: string
  actorUserId?: string
  metadata?: Record<string, unknown>
}

export class AccountLinkError extends Error {
  constructor(readonly code: string) { super(code); this.name = "AccountLinkError" }
}
