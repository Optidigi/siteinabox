import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { quotaAccountSchema } from "@/lib/builder/quotaSchemas"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import { readVerifiedPreviewSession } from "@/lib/auth/verifiedPreviewSession"
import { sameRelationshipId } from "@/lib/relationshipId"
import { grantIsActive, normalizePreviewClientSlug, previewClientSlugFromDomain } from "./previewAccess"

// Entry points pass the original signed request, never a caller-supplied email.
// Fresh session/grant authority and activity mutate under the same global fence
// as inactivity expiry. No transaction spans rendering, model or mail work.
export async function recordVerifiedPreviewActivity(headers: Headers, clientSlug: string): Promise<void> {
  const payload = await getPayload({ config })
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const slug = normalizePreviewClientSlug(clientSlug)
  if (!slug) throw new Error("Preview activity authority unavailable")
  const receipt = await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    const guard = () => assertLiveBuilderTransaction(payload, req)
    guard()
    const session = await readVerifiedPreviewSession(headers, req)
    guard()
    if (!session) throw new Error("Preview activity authority unavailable")
    const customerEmail = session.user.email.trim().toLowerCase()
    const grants = await payload.find({ collection: "preview-access-grants", where: { and: [{ customerEmail: { equals: customerEmail } }, { clientSlug: { equals: slug } }] }, sort: "-updatedAt", limit: 25, depth: 0, overrideAccess: true, req })
    guard()
    const grant = grants.docs.find((candidate) => grantIsActive(candidate, new Date()))
    if (!grant) throw new Error("Preview activity authority unavailable")
    const tenant = await payload.findByID({ collection: "tenants", id: typeof grant.tenant === "object" ? grant.tenant.id : grant.tenant, depth: 0, overrideAccess: true, req })
    guard()
    if (tenant.status === "archived" || tenant.status === "suspended" || previewClientSlugFromDomain(tenant.domain, tenant.slug) !== slug) throw new Error("Preview activity authority unavailable")
    const run = await payload.findByID({ collection: "site-generation-runs", id: typeof grant.generationRun === "object" ? grant.generationRun.id : grant.generationRun, depth: 0, overrideAccess: true, req })
    guard()
    if (run.status !== "preview_ready" || !sameRelationshipId(run.tenant, tenant.id)) throw new Error("Preview activity authority unavailable")
    const owner = await service.account(customerEmail, req)
    guard()
    const priorTime = Date.parse(owner?.lastActivityAt ?? "")
    const lastActivityAt = new Date(Math.max(Date.now(), Number.isFinite(priorTime) ? priorTime + 1 : 0)).toISOString()
    if (owner) await service.cas("builder-quota-accounts", owner, { lastActivityAt }, quotaAccountSchema, req)
    else await payload.create({ collection: "builder-quota-accounts", req, overrideAccess: true, data: { customerEmail, lastActivityAt, visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 0, attempts: 0, revision: 0, ingressRequests: 0, ingressDay: "1970-01-01" } })
    guard()
    return { customerEmail, lastActivityAt }
  }))
  const committed = await service.account(receipt.customerEmail)
  if (!committed?.lastActivityAt || Date.parse(committed.lastActivityAt) < Date.parse(receipt.lastActivityAt)) throw new Error("Preview activity commit receipt unavailable")
}
