import crypto from "node:crypto"
import type { Payload } from "payload"
import type { IntakeLegalMetadata } from "@siteinabox/contracts/generation"
import { legalStatements } from "@/lib/legal/statements"

type RecordDoc = Record<string, any>
type ID = string | number

export type SuppressionReason = "user_unsubscribe" | "admin_suppression" | "provider_bounce" | "provider_complaint"
export type PreferenceSource = "public-intake" | "tenant-settings" | "email-unsubscribe" | "list-unsubscribe" | "provider-webhook" | "operator"
export type CommunicationPreferenceMutation =
  | { type: "marketing" | "product_notification"; enabled: boolean }
  | { type: "suppression"; suppressed: boolean; reason?: SuppressionReason }
  | { type: "locale"; locale: "nl" | "en" }

export type PreferenceEvidence = {
  eventKey: string
  statementVersion: string
  statementText: string
  source: PreferenceSource
  assertedAt?: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export type TenantNotificationCategories = {
  formSubmissions: boolean
  publishingAndSiteStatus: boolean
  domainAndDns: boolean
  billingAndPayments: boolean
  teamAndAccess: boolean
  operationalDigest: boolean
}

export type TenantMemberRole = "owner" | "editor" | "viewer"

export function defaultTenantNotificationCategories(role: TenantMemberRole): TenantNotificationCategories {
  if (role === "owner") return {
    formSubmissions: true,
    publishingAndSiteStatus: true,
    domainAndDns: true,
    billingAndPayments: true,
    teamAndAccess: true,
    operationalDigest: false,
  }
  if (role === "editor") return {
    formSubmissions: true,
    publishingAndSiteStatus: true,
    domainAndDns: false,
    billingAndPayments: false,
    teamAndAccess: false,
    operationalDigest: false,
  }
  return {
    formSubmissions: false,
    publishingAndSiteStatus: false,
    domainAndDns: false,
    billingAndPayments: false,
    teamAndAccess: false,
    operationalDigest: false,
  }
}

export async function provisionDefaultTenantEmailPreferences(input: {
  payload: Payload
  tenantId: ID
  userId: ID
  email: string
  role: TenantMemberRole
  locale?: "nl" | "en"
  now?: Date
}) {
  const baseKey = `tenant-provision:${input.tenantId}:${input.userId}`
  await mutateCommunicationPreference({
    payload: input.payload,
    email: input.email,
    userId: input.userId,
    tenantId: input.tenantId,
    mutation: { type: "locale", locale: input.locale ?? "nl" },
    evidence: {
      eventKey: `${baseKey}:preference`,
      statementVersion: "tenant-email-provisioning-v1",
      statementText: "A tenant communication record was created without changing optional consent.",
      source: "operator",
    },
    now: input.now,
  })
  return upsertTenantNotificationSubscription({
    payload: input.payload,
    tenantId: input.tenantId,
    userId: input.userId,
    email: input.email,
    categories: defaultTenantNotificationCategories(input.role),
    evidence: {
      eventKey: `${baseKey}:notifications`,
      statementVersion: "tenant-notification-defaults-v1",
      statementText: `Default operational notification routing was applied for role ${input.role}.`,
      source: "operator",
    },
    now: input.now,
  })
}

const findOne = async (payload: Payload, collection: string, where: Record<string, unknown>, req?: any) => {
  const result = await payload.find({ collection: collection as any, where: where as any, limit: 1, depth: 0, overrideAccess: true, req } as any)
  return (result.docs[0] as RecordDoc | undefined) ?? null
}

export const normalizeCommunicationEmail = (email: string) => email.trim().toLowerCase()

export const communicationSubjectKey = (email: string) =>
  `email:${crypto.createHash("sha256").update(normalizeCommunicationEmail(email)).digest("hex")}`

export const findCommunicationPreferenceBySubjectKey = (payload: Payload, subjectKey: string) =>
  findOne(payload, "communication-preferences", { subjectKey: { equals: subjectKey } })

export const findCommunicationPreference = (payload: Payload, email: string) =>
  findCommunicationPreferenceBySubjectKey(payload, communicationSubjectKey(email))

export async function mutateCommunicationPreference(input: {
  payload: Payload
  email: string
  mutation: CommunicationPreferenceMutation
  evidence: PreferenceEvidence
  userId?: ID
  tenantId?: ID
  now?: Date
  transactionID?: number | string
}) {
  const email = normalizeCommunicationEmail(input.email)
  const subjectKey = communicationSubjectKey(email)
  const ownsTransaction = input.transactionID == null
  const transactionID = input.transactionID ?? await input.payload.db.beginTransaction()
  if (!transactionID) throw new Error("De communicatievoorkeurtransactie kon niet worden gestart.")
  const req = { transactionID } as any
  try {
    const duplicate = await findOne(input.payload, "communication-preference-events", { eventKey: { equals: input.evidence.eventKey } }, req)
    if (duplicate) {
      const existing = await findOne(input.payload, "communication-preferences", { subjectKey: { equals: subjectKey } }, req)
      if (ownsTransaction) await input.payload.db.commitTransaction(transactionID)
      if (!existing) throw new Error("Voorkeurgebeurtenis bestaat zonder bijbehorende voorkeur.")
      return existing
    }

    const occurredAt = (input.now ?? new Date()).toISOString()
    let preference = await findOne(input.payload, "communication-preferences", { subjectKey: { equals: subjectKey } }, req)
    let staleMarketingDecision = false
    if (preference && input.mutation.type === "marketing" && input.evidence.assertedAt) {
      const newer = await input.payload.find({
        collection: "communication-preference-events" as any,
        where: {
          and: [
            { preference: { equals: preference.id } },
            { preferenceType: { equals: "marketing" } },
            { assertedAt: { greater_than: input.evidence.assertedAt } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      } as any)
      staleMarketingDecision = newer.totalDocs > 0
    }
    const data: RecordDoc = {
      email,
      statementVersion: input.evidence.statementVersion,
      updatedAt: occurredAt,
      ...(input.userId !== undefined ? { user: input.userId } : {}),
      ...(input.tenantId !== undefined ? { tenant: input.tenantId } : {}),
    }
    if (input.mutation.type === "marketing") {
      data.marketing = input.mutation.enabled
      data.marketingConsentVersion = input.mutation.enabled ? input.evidence.statementVersion : null
      data.marketingConsentAt = input.mutation.enabled ? occurredAt : null
      data.marketingConsentSource = input.mutation.enabled ? input.evidence.source : null
    } else if (input.mutation.type === "product_notification") {
      data.productNotifications = input.mutation.enabled
    } else if (input.mutation.type === "locale") {
      data.locale = input.mutation.locale
    } else if (input.mutation.type === "suppression") {
      data.suppressed = input.mutation.suppressed
      data.suppressionReason = input.mutation.suppressed ? input.mutation.reason : null
    }

    if (!preference) {
      preference = await input.payload.create({
        collection: "communication-preferences" as any,
        data: { subjectKey, marketing: false, productNotifications: false, directory: false, suppressed: false, locale: "nl", ...data },
        depth: 0, overrideAccess: true, req,
      } as any) as RecordDoc
    } else if (!staleMarketingDecision) {
      // Marketing opt-in never clears a provider complaint/bounce or an operator suppression.
      const result = await input.payload.update({
        collection: "communication-preferences" as any,
        where: { and: [{ id: { equals: preference.id } }, { updatedAt: { equals: preference.updatedAt } }] },
        data, depth: 0, overrideAccess: true, req,
      } as any) as any
      const updated = Array.isArray(result?.docs) ? result.docs[0] : null
      if (!updated) throw new Error("De communicatievoorkeur is ondertussen gewijzigd. Probeer opnieuw.")
      preference = updated
    }

    if (!preference) throw new Error("De communicatievoorkeur kon niet worden opgeslagen.")
    const eventMutation = input.mutation
    const preferenceType = eventMutation.type
    const action = eventMutation.type === "suppression"
      ? (eventMutation.suppressed ? "suppress" : "unsuppress")
      : eventMutation.type === "locale"
        ? "update"
        : (eventMutation.enabled ? "opt_in" : "opt_out")
    await input.payload.create({
      collection: "communication-preference-events" as any,
      data: {
        eventKey: input.evidence.eventKey, preference: preference.id,
        ...(input.tenantId !== undefined ? { tenant: input.tenantId } : {}),
        ...(input.userId !== undefined ? { user: input.userId } : {}),
        preferenceType, action, channel: "email",
        statementVersion: input.evidence.statementVersion, statementText: input.evidence.statementText,
        source: input.evidence.source, occurredAt, assertedAt: input.evidence.assertedAt,
        requestId: input.evidence.requestId, ipAddress: input.evidence.ipAddress,
        userAgent: input.evidence.userAgent, metadata: input.evidence.metadata,
      },
      depth: 0, overrideAccess: true, req,
    } as any)
    if (ownsTransaction) await input.payload.db.commitTransaction(transactionID)
    return preference
  } catch (error) {
    if (ownsTransaction) await input.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

export async function mutateCommunicationPreferenceSet(input: {
  payload: Payload
  email: string
  mutations: Array<{ mutation: CommunicationPreferenceMutation; evidence: PreferenceEvidence }>
  userId?: ID
  tenantId?: ID
  now?: Date
}) {
  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new Error("De communicatievoorkeurtransactie kon niet worden gestart.")
  try {
    let preference: RecordDoc | null = null
    for (const item of input.mutations) {
      preference = await mutateCommunicationPreference({
        payload: input.payload,
        email: input.email,
        mutation: item.mutation,
        evidence: item.evidence,
        userId: input.userId,
        tenantId: input.tenantId,
        now: input.now,
        transactionID,
      })
    }
    await input.payload.db.commitTransaction(transactionID)
    return preference
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

export async function recordIntakeMarketingPreference(input: {
  payload: Payload
  intakeId: ID
  email: string
  legal: IntakeLegalMetadata
  now?: Date
}) {
  const consent = input.legal.marketingConsent
  return mutateCommunicationPreference({
    payload: input.payload, email: input.email, mutation: { type: "marketing", enabled: consent.granted }, now: input.now,
    evidence: {
      eventKey: `intake:${input.intakeId}:marketing`, statementVersion: consent.statementVersion,
      statementText: legalStatements.marketingOptIn.text, source: "public-intake", assertedAt: consent.recordedAt,
      metadata: { intakeId: String(input.intakeId) },
    },
  })
}

export const tenantNotificationSubscriptionKey = (tenantId: ID, userId: ID) => `tenant:${tenantId}:user:${userId}`

export const findTenantNotificationSubscription = (payload: Payload, tenantId: ID, userId: ID) =>
  findOne(payload, "tenant-notification-subscriptions", { subscriptionKey: { equals: tenantNotificationSubscriptionKey(tenantId, userId) } })

export async function upsertTenantNotificationSubscription(input: {
  payload: Payload
  tenantId: ID
  userId: ID
  email: string
  categories: TenantNotificationCategories
  evidence: PreferenceEvidence
  now?: Date
}) {
  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new Error("De tenantmeldingentransactie kon niet worden gestart.")
  const req = { transactionID } as any
  try {
    const duplicate = await findOne(input.payload, "communication-preference-events", { eventKey: { equals: input.evidence.eventKey } }, req)
    const key = tenantNotificationSubscriptionKey(input.tenantId, input.userId)
    if (duplicate) {
      const existing = await findOne(input.payload, "tenant-notification-subscriptions", { subscriptionKey: { equals: key } }, req)
      await input.payload.db.commitTransaction(transactionID)
      if (!existing) throw new Error("Meldingsgebeurtenis bestaat zonder abonnement.")
      return existing
    }
    const occurredAt = (input.now ?? new Date()).toISOString()
    const existing = await findOne(input.payload, "tenant-notification-subscriptions", { subscriptionKey: { equals: key } }, req)
    const data = { tenant: input.tenantId, user: input.userId, email: normalizeCommunicationEmail(input.email), ...input.categories, updatedAt: occurredAt }
    let subscription: RecordDoc
    if (existing) {
      const result = await input.payload.update({
        collection: "tenant-notification-subscriptions" as any,
        where: { and: [{ id: { equals: existing.id } }, { updatedAt: { equals: existing.updatedAt } }] },
        data, depth: 0, overrideAccess: true, req,
      } as any) as any
      subscription = Array.isArray(result?.docs) ? result.docs[0] : null
      if (!subscription) throw new Error("Het meldingsabonnement is ondertussen gewijzigd. Probeer opnieuw.")
    } else {
      subscription = await input.payload.create({ collection: "tenant-notification-subscriptions" as any, data: { subscriptionKey: key, ...data }, depth: 0, overrideAccess: true, req } as any) as RecordDoc
    }
    const preference = await findOne(input.payload, "communication-preferences", { subjectKey: { equals: communicationSubjectKey(input.email) } }, req)
    if (!preference) throw new Error("Maak eerst een persoonlijke communicatievoorkeur aan.")
    await input.payload.create({ collection: "communication-preference-events" as any, data: {
      eventKey: input.evidence.eventKey, preference: preference.id, tenant: input.tenantId, user: input.userId,
      preferenceType: "tenant_notification", action: Object.values(input.categories).some(Boolean) ? "subscribe" : "unsubscribe",
      channel: "email", statementVersion: input.evidence.statementVersion, statementText: input.evidence.statementText,
      source: input.evidence.source, occurredAt, assertedAt: input.evidence.assertedAt, requestId: input.evidence.requestId,
      ipAddress: input.evidence.ipAddress, userAgent: input.evidence.userAgent,
      metadata: { ...input.evidence.metadata, categories: input.categories },
    }, depth: 0, overrideAccess: true, req } as any)
    await input.payload.db.commitTransaction(transactionID)
    return subscription as RecordDoc
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
