/**
 * Password-only sign-in (product decision): Siteinabox switches the customer tenant's
 * security defaults off so mailbox users are not forced to register Microsoft
 * Authenticator at first sign-in. Customers can ask for two-step sign-in later, which
 * switches security defaults back on for every account in their tenant.
 *
 * Siteinabox only changes the tenant setting when it has a reason to: the first
 * observation, or a request made after the last observation. A change made outside
 * Siteinabox afterwards (by Microsoft or an administrator) is recorded as an issue and
 * never silently reverted.
 */
export type SignInMode = "password_only" | "two_step"

export type SignInPolicy = {
  version: 1
  desired: SignInMode
  desiredBy: "siteinabox" | "customer" | "operator"
  desiredAt: string
  /** Last observed tenant security defaults. */
  securityDefaults: "on" | "off" | "unknown"
  observedAt: string | null
  issueCode: string | null
}

export const SIGN_IN_POLICY_CHANGED_EXTERNALLY = "SIGN_IN_POLICY_CHANGED_OUTSIDE_SITEINABOX"
export const SIGN_IN_POLICY_WRITE_UNVERIFIED = "SIGN_IN_POLICY_WRITE_UNVERIFIED"

const isoOrNull = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null

/** Absent or malformed stored values mean the product default: password-only, requested at service creation. */
export function readSignInPolicy(value: unknown, fallbackDesiredAt = new Date(0).toISOString()): SignInPolicy {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    version: 1,
    desired: raw.desired === "two_step" ? "two_step" : "password_only",
    desiredBy: raw.desiredBy === "customer" || raw.desiredBy === "operator" ? raw.desiredBy : "siteinabox",
    desiredAt: isoOrNull(raw.desiredAt) ?? fallbackDesiredAt,
    securityDefaults: raw.securityDefaults === "on" || raw.securityDefaults === "off" ? raw.securityDefaults : "unknown",
    observedAt: isoOrNull(raw.observedAt),
    issueCode: typeof raw.issueCode === "string" && /^[A-Z0-9_]{1,80}$/.test(raw.issueCode) ? raw.issueCode : null,
  }
}

export function requestSignInMode(policy: SignInPolicy, mode: SignInMode, by: SignInPolicy["desiredBy"], now: Date): SignInPolicy {
  // A strictly later timestamp than the last observation authorizes exactly one change.
  const at = new Date(Math.max(now.getTime(), policy.observedAt ? Date.parse(policy.observedAt) + 1 : 0)).toISOString()
  return { ...policy, desired: mode, desiredBy: by, desiredAt: at }
}

export type SignInPolicyPorts = {
  readSecurityDefaultsEnabled(): Promise<boolean>
  setSecurityDefaultsEnabled(enabled: boolean): Promise<void>
}

/**
 * One reconciliation pass. Writes are idempotent (`isEnabled` is set, not toggled), so
 * an interrupted write is safely repeated by the next pass and confirmed by readback.
 */
export async function reconcileSignInPolicy(policy: SignInPolicy, ports: SignInPolicyPorts, now: Date): Promise<{ policy: SignInPolicy; changed: boolean }> {
  const wantEnabled = policy.desired === "two_step"
  const current = await ports.readSecurityDefaultsEnabled()
  const observed = (enabled: boolean, issueCode: string | null): SignInPolicy =>
    ({ ...policy, securityDefaults: enabled ? "on" : "off", observedAt: now.toISOString(), issueCode })
  if (current === wantEnabled) return { policy: observed(current, null), changed: false }
  const authorized = !policy.observedAt || Date.parse(policy.desiredAt) > Date.parse(policy.observedAt)
  if (!authorized) return { policy: observed(current, SIGN_IN_POLICY_CHANGED_EXTERNALLY), changed: false }
  await ports.setSecurityDefaultsEnabled(wantEnabled)
  const after = await ports.readSecurityDefaultsEnabled()
  if (after === wantEnabled) return { policy: observed(after, null), changed: true }
  // Not visible yet: keep the request authorized (no new observation) so the next pass retries.
  return { policy: { ...policy, issueCode: SIGN_IN_POLICY_WRITE_UNVERIFIED }, changed: false }
}
