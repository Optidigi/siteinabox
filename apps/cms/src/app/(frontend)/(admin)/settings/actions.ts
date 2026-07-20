"use server"

import crypto from "node:crypto"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getSiabContext } from "@/lib/context"
import { relationshipId } from "@/lib/relationshipId"
import { acceptCustomerLegalRequirement, objectToNoticeAndContinuedUse } from "@/lib/legal/customerRequirements"
import { legalStatements } from "@/lib/legal/statements"
import {
  findCommunicationPreference,
  mutateCommunicationPreference,
  mutateCommunicationPreferenceSet,
  upsertTenantNotificationSubscription,
  type TenantNotificationCategories,
} from "@/lib/legal/communicationPreferences"

const checked = (formData: FormData, name: string) => formData.get(name) === "on"
const eventKey = (scope: string, actorId: string | number) =>
  `tenant-settings:${scope}:${actorId}:${crypto.randomUUID()}`

const evidenceFrom = (requestHeaders: Headers, key: string, text: string) => ({
  eventKey: key,
  statementVersion: "tenant-email-preferences-v1",
  statementText: text,
  source: "tenant-settings" as const,
  requestId: requestHeaders.get("x-request-id") ?? undefined,
  ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
  userAgent: requestHeaders.get("user-agent") ?? undefined,
})

async function authenticatedTenantRequest() {
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const ctx = await getSiabContext()
  if (!user || ctx.mode !== "tenant") redirect("/login")
  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (!tenantId || tenantId !== String(ctx.tenant.id)) redirect("/?error=forbidden")
  return { requestHeaders, payload, user, tenantId }
}

export async function updateMyCommunicationPreferencesAction(formData: FormData) {
  const { requestHeaders, payload, user, tenantId } = await authenticatedTenantRequest()
  const locale: "nl" | "en" = formData.get("locale") === "en" ? "en" : "nl"
  const mutations = [
    {
      type: "marketing" as const,
      enabled: checked(formData, "marketing"),
      statement: legalStatements.marketingOptIn.text,
      statementVersion: legalStatements.marketingOptIn.version,
    },
    { type: "product_notification" as const, enabled: checked(formData, "productNotifications"), statement: "I choose whether to receive optional Site in a Box product notifications." },
    { type: "locale" as const, locale, statement: "I choose the language used for my Site in a Box email." },
  ]
  try {
    const preferenceMutations = mutations.map((item) => {
      const statementVersion = "statementVersion" in item ? item.statementVersion : undefined
      const { statement, ...mutationWithOptionalVersion } = item
      const { statementVersion: _ignored, ...mutation } = mutationWithOptionalVersion as typeof mutationWithOptionalVersion & { statementVersion?: string }
      return {
        mutation,
        evidence: {
          ...evidenceFrom(requestHeaders, eventKey(mutation.type, user.id), statement),
          ...(statementVersion ? { statementVersion } : {}),
        },
      }
    })
    await mutateCommunicationPreferenceSet({
      payload,
      email: user.email,
      userId: user.id,
      tenantId,
      mutations: preferenceMutations,
    })
  } catch (error) {
    console.error("Personal email preference update failed", error)
    redirect("/settings?emailPreferences=failed#email-preferences")
  }
  revalidatePath("/settings")
  redirect("/settings?emailPreferences=personal-saved#email-preferences")
}

export async function updateTenantNotificationSubscriptionAction(formData: FormData) {
  const { requestHeaders, payload, user, tenantId } = await authenticatedTenantRequest()
  if (user.role !== "owner") redirect("/?error=forbidden")
  const targetUserId = String(formData.get("userId") ?? "").trim()
  if (!targetUserId) redirect("/settings?emailPreferences=failed#tenant-notifications")
  const target = await payload.findByID({ collection: "users", id: targetUserId, depth: 0, user })
  const targetTenantId = relationshipId(target.tenants?.[0]?.tenant)
  if (target.role === "super-admin" || !targetTenantId || targetTenantId !== tenantId) redirect("/?error=forbidden")

  const categories: TenantNotificationCategories = {
    formSubmissions: checked(formData, "formSubmissions"),
    publishingAndSiteStatus: checked(formData, "publishingAndSiteStatus"),
    domainAndDns: checked(formData, "domainAndDns"),
    billingAndPayments: checked(formData, "billingAndPayments"),
    teamAndAccess: checked(formData, "teamAndAccess"),
    operationalDigest: false,
  }
  const currentSubscription = await payload.find({
      collection: "tenant-notification-subscriptions",
      where: { and: [{ tenant: { equals: tenantId } }, { user: { equals: target.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  const currentId = currentSubscription.docs[0]?.id
  const criticalCategories = ["publishingAndSiteStatus", "domainAndDns", "billingAndPayments", "teamAndAccess"] as const
  for (const category of criticalCategories) {
    if (categories[category]) continue
    const alternatives = await payload.find({
        collection: "tenant-notification-subscriptions",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { [category]: { equals: true } },
            ...(currentId != null ? [{ id: { not_equals: currentId } }] : []),
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    if (alternatives.totalDocs === 0) {
      redirect("/settings?emailPreferences=critical-recipient-required#tenant-notifications")
    }
  }
  try {
    if (!await findCommunicationPreference(payload, target.email)) {
      await mutateCommunicationPreference({
        payload, email: target.email, userId: target.id, tenantId,
        mutation: { type: "locale", locale: target.language === "en" ? "en" : "nl" },
        evidence: evidenceFrom(requestHeaders, eventKey("preference-link", user.id), "A communication preference record was linked to this tenant member without changing personal consent."),
      })
    }
    await upsertTenantNotificationSubscription({
      payload, tenantId, userId: target.id, email: target.email, categories,
      evidence: evidenceFrom(requestHeaders, eventKey(`tenant-notifications:${target.id}`, user.id), "The tenant owner configured operational email routing for this tenant member."),
    })
  } catch (error) {
    console.error("Tenant notification subscription update failed", error)
    redirect("/settings?emailPreferences=failed#tenant-notifications")
  }
  revalidatePath("/settings")
  redirect("/settings?emailPreferences=notifications-saved#tenant-notifications")
}

export async function acceptLegalRequirementAction(formData: FormData) {
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const ctx = await getSiabContext()
  if (!user || user.role !== "owner" || ctx.mode !== "tenant") redirect("/login")

  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (!tenantId || tenantId !== String(ctx.tenant.id)) redirect("/?error=forbidden")
  const requirementId = String(formData.get("requirementId") ?? "").trim()
  if (!requirementId || formData.get("acceptance") !== "accepted") {
    redirect("/settings?legal=acceptance-required")
  }

  try {
    await acceptCustomerLegalRequirement({
      payload,
      requirementId,
      tenantId,
      actorUserId: user.id,
      actorEmail: user.email,
      requestId: requestHeaders.get("x-request-id"),
      ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: requestHeaders.get("user-agent"),
    })
  } catch (error) {
    console.error("Legal requirement acceptance failed", error)
    redirect("/settings?legal=failed")
  }

  revalidatePath("/", "layout")
  redirect("/settings?legal=accepted")
}

export async function objectLegalRequirementAction(formData: FormData) {
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const ctx = await getSiabContext()
  if (!user || user.role !== "owner" || ctx.mode !== "tenant") redirect("/login")

  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (!tenantId || tenantId !== String(ctx.tenant.id)) redirect("/?error=forbidden")
  const requirementId = String(formData.get("requirementId") ?? "").trim()
  if (!requirementId || formData.get("objection") !== "confirmed") redirect("/settings?legal=failed")

  try {
    await objectToNoticeAndContinuedUse({
      payload,
      requirementId,
      tenantId,
      actorUserId: user.id,
      actorEmail: user.email,
      requestId: requestHeaders.get("x-request-id"),
    })
  } catch (error) {
    console.error("Legal requirement objection failed", error)
    redirect("/settings?legal=failed")
  }

  revalidatePath("/", "layout")
  redirect("/settings?legal=objected")
}
