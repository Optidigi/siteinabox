import "server-only"

import { z } from "zod"
import type { Payload, Where } from "payload"

import {
  migrationSourceMechanismSchema,
  type MigrationSourceMechanism,
} from "@siteinabox/contracts/domain-migration"
import { contractingPartyTypeSchema } from "@siteinabox/contracts/commerce"

import type { PreviewGrantContext } from "@/lib/preview/previewAccess"
import { normalizeDomain } from "@/lib/domains/normalize"
import { relationshipId, type RelationshipIdRef } from "@/lib/relationshipId"

export const CHECKOUT_PROGRESS_MAX_LIFETIME_MS = 14 * 24 * 60 * 60_000

const selectedDomainSchema = z.string().trim().max(253).nullable().optional()
  .transform((value, ctx) => {
    if (value == null || !value) return null
    const normalized = normalizeDomain(value)
    if (!normalized.ok) {
      ctx.addIssue({ code: "custom", message: "Selected domain intent is invalid." })
      return z.NEVER
    }
    return normalized.domain
  })

const partialText = (max = 200) => z.string().trim().max(max).optional()

/**
 * Resumable engagement data only. This deliberately differs from
 * checkoutProfileDraftSchema: it permits incomplete fields and must never be
 * used to create a checkout profile, order, payment, or legal evidence.
 */
export const checkoutProfileProgressDraftSchema = z.object({
  partyType: contractingPartyTypeSchema.optional(),
  firstName: partialText(),
  lastName: partialText(),
  registeredBusinessName: partialText(),
  kvkNumber: z.string().trim().max(8).regex(/^\d*$/, "KVK-nummer bevat alleen cijfers.").optional(),
  intendedCompanyName: partialText(),
  street: partialText(),
  number: partialText(20),
  suffix: partialText(20),
  zipcode: partialText(20),
  city: partialText(),
  country: z.string().trim().toUpperCase()
    .regex(/^[A-Z]{2}$/, "Gebruik een tweecijferige landcode.")
    .or(z.literal(""))
    .optional(),
  phoneCountryCode: z.string().trim()
    .regex(/^\+\d{1,3}$/, "Gebruik een landcode zoals +31.")
    .or(z.literal(""))
    .optional(),
  phoneAreaCode: z.string().trim().regex(/^\d{0,6}$/, "Vul alleen cijfers in voor het netnummer.").optional(),
  phoneSubscriberNumber: z.string().trim().regex(/^\d{0,12}$/, "Vul alleen cijfers in voor het telefoonnummer.").optional(),
  euEligibilityBasis: z.enum(["establishment", "residence", "citizenship", ""]).optional(),
  euEligibilityCountry: z.string().trim().toUpperCase()
    .regex(/^[A-Z]{2}$/, "Gebruik een tweecijferige landcode.")
    .or(z.literal(""))
    .optional(),
}).strict()

export type CheckoutProfileProgressDraft = z.output<typeof checkoutProfileProgressDraftSchema>

export const checkoutProgressDraftSchema = z.object({
  domainMode: z.enum(["new_registration", "existing_domain"]).default("new_registration"),
  domainQuery: z.string().trim().max(253).default(""),
  selectedDomain: selectedDomainSchema,
  decision: z.enum(["domain", "review"]).default("domain"),
  billingPeriod: z.enum(["monthly", "annual"]).default("annual"),
  migrationSourceMechanism: migrationSourceMechanismSchema.nullish().transform(
    (value): MigrationSourceMechanism | null => value ?? null,
  ),
  profileDraft: checkoutProfileProgressDraftSchema.nullish().transform(
    (value): CheckoutProfileProgressDraft | null => value ?? null,
  ),
}).strict().superRefine((value, ctx) => {
  if (value.domainMode === "new_registration" && value.migrationSourceMechanism) {
    ctx.addIssue({
      code: "custom",
      path: ["migrationSourceMechanism"],
      message: "A new domain registration cannot retain a migration source.",
    })
  }
})

export type CheckoutProgressDraft = z.output<typeof checkoutProgressDraftSchema>

type CheckoutProgressDraftRecord = CheckoutProgressDraft & {
  id: string | number
  previewAccessGrant: RelationshipIdRef
  tenant: RelationshipIdRef
  generationRun: RelationshipIdRef
  expiresAt: string
  updatedAt?: string
}

export type LoadedCheckoutProgressDraft = CheckoutProgressDraft & {
  expiresAt: string
  updatedAt?: string
}

type CheckoutProgressPayload = Pick<Payload, "create" | "delete" | "find" | "update">

const scopeWhere = (context: PreviewGrantContext): Where => ({
  and: [
    { previewAccessGrant: { equals: context.grant.id } },
    { tenant: { equals: context.tenant.id } },
    { generationRun: { equals: context.run.id } },
  ],
})

const assertAuthority = (
  record: CheckoutProgressDraftRecord,
  context: PreviewGrantContext,
) => {
  if (
    relationshipId(record.previewAccessGrant) !== String(context.grant.id) ||
    relationshipId(record.tenant) !== String(context.tenant.id) ||
    relationshipId(record.generationRun) !== String(context.run.id)
  ) {
    throw new Error("Checkout progress draft belongs to another preview authority.")
  }
}

const findDraft = async (
  payload: CheckoutProgressPayload,
  context: PreviewGrantContext,
): Promise<CheckoutProgressDraftRecord | null> => {
  const result = await payload.find({
    collection: "checkout-progress-drafts",
    where: scopeWhere(context),
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    throw new Error("Duplicate checkout progress draft authority.")
  }
  return (result.docs[0] as CheckoutProgressDraftRecord | undefined) ?? null
}

const expiryFor = (context: PreviewGrantContext, now: Date): string => {
  const grantExpiry = new Date(context.grant.expiresAt).getTime()
  if (!Number.isFinite(grantExpiry) || grantExpiry <= now.getTime()) {
    throw new Error("Preview access is no longer available.")
  }
  return new Date(Math.min(grantExpiry, now.getTime() + CHECKOUT_PROGRESS_MAX_LIFETIME_MS))
    .toISOString()
}

const isExpired = (record: CheckoutProgressDraftRecord, now: Date): boolean => {
  const expiresAt = new Date(record.expiresAt).getTime()
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime()
}

const toLoadedDraft = (record: CheckoutProgressDraftRecord): LoadedCheckoutProgressDraft => ({
  ...checkoutProgressDraftSchema.parse({
    domainMode: record.domainMode,
    domainQuery: record.domainQuery,
    selectedDomain: record.selectedDomain,
    decision: record.decision,
    billingPeriod: record.billingPeriod,
    migrationSourceMechanism: record.migrationSourceMechanism,
    profileDraft: record.profileDraft,
  }),
  expiresAt: record.expiresAt,
  ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
})

/**
 * Loads only the unexpired resumable customer intent associated with the
 * already-authorized preview grant. Expired drafts are deleted on read.
 */
export async function loadCheckoutProgressDraft(input: {
  context: PreviewGrantContext
  now?: Date
}): Promise<LoadedCheckoutProgressDraft | null> {
  const now = input.now ?? new Date()
  const record = await findDraft(input.context.payload, input.context)
  if (!record) return null
  assertAuthority(record, input.context)
  if (isExpired(record, now)) {
    await input.context.payload.delete({
      collection: "checkout-progress-drafts",
      id: record.id,
      overrideAccess: true,
    })
    return null
  }
  return toLoadedDraft(record)
}

/**
 * Persists non-authoritative checkout intent. Quotes, legal declarations,
 * payment/provider results, and source credentials are intentionally absent
 * from this contract and rejected by the strict schema. An optional partial
 * profile draft is PII, retained only until this draft's grant-capped expiry.
 */
export async function saveCheckoutProgressDraft(input: {
  context: PreviewGrantContext
  draft: unknown
  now?: Date
}): Promise<LoadedCheckoutProgressDraft> {
  const draft = checkoutProgressDraftSchema.parse(input.draft)
  const now = input.now ?? new Date()
  const expiresAt = expiryFor(input.context, now)
  const existing = await findDraft(input.context.payload, input.context)
  const data = {
    ...draft,
    selectedDomain: draft.selectedDomain ?? null,
    migrationSourceMechanism: draft.migrationSourceMechanism ?? null,
    profileDraft: draft.profileDraft ?? null,
    expiresAt,
  }
  const lifecycleContext = { checkoutProgressDraftLifecycle: true }
  const record = existing
    ? await input.context.payload.update({
        collection: "checkout-progress-drafts",
        id: existing.id,
        data,
        depth: 0,
        overrideAccess: true,
        context: lifecycleContext,
      })
    : await input.context.payload.create({
        collection: "checkout-progress-drafts",
        data: {
          previewAccessGrant: input.context.grant.id,
          tenant: input.context.tenant.id,
          generationRun: input.context.run.id,
          ...data,
        },
        depth: 0,
        overrideAccess: true,
        context: lifecycleContext,
      })
  const saved = record as CheckoutProgressDraftRecord
  assertAuthority(saved, input.context)
  return toLoadedDraft(saved)
}

export type CheckoutProgressPurgeResult = {
  deleted: number
  cutoffISO: string
}

/** Removes expired intent records without touching live preview grants. */
export async function purgeExpiredCheckoutProgressDrafts(input: {
  payload: CheckoutProgressPayload
  now?: Date
}): Promise<CheckoutProgressPurgeResult> {
  const now = input.now ?? new Date()
  const cutoffISO = now.toISOString()
  const result = await input.payload.delete({
    collection: "checkout-progress-drafts",
    where: { expiresAt: { less_than_equal: cutoffISO } },
    overrideAccess: true,
  })
  return {
    deleted: Array.isArray(result.docs) ? result.docs.length : 0,
    cutoffISO,
  }
}
