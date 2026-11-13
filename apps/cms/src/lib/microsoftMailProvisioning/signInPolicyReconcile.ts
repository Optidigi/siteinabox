import "server-only"
import type { Payload } from "payload"
import { withCommerceOrderLock } from "../commerce/orderLock"
import { relationshipId } from "../relationshipId"
import { recordCommerceAdminException } from "../commerce/alerts"
import { createMicrosoftMailLiveClients, signInGrantAuthority } from "./livePorts"
import { MicrosoftApiError } from "./microsoft"
import { requireMailDomainEnabled } from "./rollout"
import { readSignInPolicy, reconcileSignInPolicy, SIGN_IN_POLICY_CHANGED_EXTERNALLY, type SignInPolicy } from "./signInPolicy"
import { requireLiveMailWritesAllowed } from "./writeGate"

const mailServiceContext = { microsoftMailServiceMutation: true }

/**
 * Applies customer/operator sign-in requests and detects outside changes for active
 * services. It never upgrades grants or delegation: services without the reviewed
 * sign-in grant are flagged and upgraded by their next provisioning run.
 */
export async function reconcileMicrosoftMailSignInPolicies(payload: Payload, now = new Date(), options: { serviceId?: number | string } = {}) {
  if (process.env.MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED !== "true") return { examined: 0, changed: 0 }
  try { requireLiveMailWritesAllowed() } catch { return { examined: 0, changed: 0 } }
  const { microsoft, tokenProvider } = createMicrosoftMailLiveClients({ payload })
  let examined = 0, changed = 0, cursor = 0
  while (true) {
    const services = await payload.find({ collection: "microsoft-mail-services", where: { and: [
      { id: options.serviceId === undefined ? { greater_than: cursor } : { equals: options.serviceId } },
      { status: { in: ["active", "attention"] } }, { microsoftTenantId: { exists: true } },
    ] }, limit: 50, sort: "id", depth: 0, overrideAccess: true })
    if (!services.docs.length) break
    for (const selected of services.docs) {
      try { requireMailDomainEnabled(selected.domain) } catch { continue }
      const tenantId = Number(relationshipId(selected.tenant))
      // One failing or locked service never stops the rest of the pass.
      try { await withCommerceOrderLock(payload, `mail-service:${tenantId}`, async () => {
        const service = await payload.findByID({ collection: "microsoft-mail-services", id: selected.id, depth: 0, overrideAccess: true })
        const customerTenantId = service.microsoftTenantId
        if (!customerTenantId) return
        examined++
        const policy = readSignInPolicy(service.signInPolicy, service.createdAt)
        const save = (next: SignInPolicy) => payload.update({ collection: "microsoft-mail-services", id: service.id, data: { signInPolicy: next }, overrideAccess: true, context: mailServiceContext })
        const authority = await signInGrantAuthority(microsoft, tokenProvider, customerTenantId)
        if (authority.status !== "ready") {
          if (policy.issueCode !== authority.code && authority.status === "blocked") await save({ ...policy, issueCode: authority.code })
          return
        }
        let result
        try {
          result = await reconcileSignInPolicy(policy, {
            readSecurityDefaultsEnabled: () => microsoft.getSecurityDefaultsEnabled(customerTenantId),
            setSecurityDefaultsEnabled: enabled => microsoft.setSecurityDefaultsEnabled(customerTenantId, enabled),
          }, now)
        } catch (error) {
          if (error instanceof MicrosoftApiError && error.status > 0 && error.status < 500 && ![408, 429].includes(error.status)) await save({ ...policy, issueCode: "SIGN_IN_POLICY_REJECTED" })
          return
        }
        await save(result.policy)
        if (result.changed) changed++
        if (result.policy.issueCode === SIGN_IN_POLICY_CHANGED_EXTERNALLY && policy.issueCode !== SIGN_IN_POLICY_CHANGED_EXTERNALLY) {
          await recordCommerceAdminException({ payload, source: "payments", code: "email_sign_in_policy_changed_externally",
            message: "Microsoft security defaults changed outside Siteinabox for an email customer. Review the tenant before re-applying the sign-in setting.",
            tenant: tenantId, subjectId: service.id, now: now.toISOString() })
        }
      }) } catch (error) {
        payload.logger.warn({ event: "microsoft_mail_sign_in_reconcile_failed", serviceId: selected.id, error: error instanceof Error ? error.name : "unknown" })
      }
    }
    if (options.serviceId !== undefined) break
    cursor = Number(services.docs.at(-1)!.id)
    if (services.docs.length < 50) break
  }
  return { examined, changed }
}
