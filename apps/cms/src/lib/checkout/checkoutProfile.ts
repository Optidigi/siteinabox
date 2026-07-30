import "server-only"

import { z } from "zod"
import type { Payload } from "payload"
import type { CheckoutProfile } from "@/payload-types"
import {
  contractingPartyTypeSchema,
  type ContractingPartyType,
} from "@siteinabox/contracts/commerce"

import {
  normalizeDomainRegistrantDetails,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is verplicht.`).max(max)

const optionalText = (max = 200) =>
  z.string().trim().max(max).default("")

export const checkoutProfileDraftSchema = z.object({
  partyType: contractingPartyTypeSchema,
  firstName: requiredText("Voornaam"),
  lastName: requiredText("Achternaam"),
  registeredBusinessName: optionalText(),
  kvkNumber: optionalText(8),
  intendedCompanyName: optionalText(),
  street: requiredText("Straat"),
  number: requiredText("Huisnummer", 20),
  suffix: optionalText(20),
  zipcode: requiredText("Postcode", 20),
  city: requiredText("Plaats"),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Gebruik een tweecijferige landcode."),
  phoneCountryCode: z.string().trim().regex(/^\+\d{1,3}$/, "Gebruik een landcode zoals +31."),
  phoneAreaCode: z.string().trim().regex(/^\d{1,6}$/, "Vul alleen cijfers in voor het netnummer."),
  phoneSubscriberNumber: z.string().trim().regex(/^\d{4,12}$/, "Vul alleen cijfers in voor het telefoonnummer."),
  euEligibilityBasis: z.enum([
    "establishment",
    "residence",
    "citizenship",
  ]).or(z.literal("")).optional(),
  euEligibilityCountry: z.string().trim().toUpperCase()
    .regex(/^[A-Z]{2}$/, "Gebruik een tweecijferige landcode.")
    .or(z.literal(""))
    .optional(),
}).strict().superRefine((draft, ctx) => {
  if (draft.partyType === "registered_business") {
    if (!draft.registeredBusinessName) {
      ctx.addIssue({
        code: "custom",
        path: ["registeredBusinessName"],
        message: "Bedrijfsnaam is verplicht.",
      })
    }
    if (!/^\d{8}$/.test(draft.kvkNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["kvkNumber"],
        message: "Een KVK-nummer bestaat uit 8 cijfers.",
      })
    }
  } else if (draft.kvkNumber) {
    ctx.addIssue({
      code: "custom",
      path: ["kvkNumber"],
      message: "Een onderneming in oprichting heeft geen KVK-nummer.",
    })
  }
})

export type CheckoutProfileDraft = z.infer<typeof checkoutProfileDraftSchema>

export type CheckoutProfileView = CheckoutProfileDraft & {
  profileKey: string
  profileVersion: number
  customerEmail: string
  contractingPartyName: string
  supersedesProfileKey: string | null
  revisionReason: "initial_capture" | "customer_correction" | null
  actorEmail: string | null
  sourceRequestId: string | null
  createdAt: string
}

type BillingAddress = {
  schemaVersion: 1
  street: string
  number: string
  suffix: string | null
  zipcode: string
  city: string
  country: string
  phoneCountryCode: string
  phoneAreaCode: string
  phoneSubscriberNumber: string
  euEligibilityBasis?: "establishment" | "residence" | "citizenship" | ""
  euEligibilityCountry?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)

const nullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

const billingAddressFromDraft = (draft: CheckoutProfileDraft): BillingAddress => ({
  schemaVersion: 1,
  street: draft.street,
  number: draft.number,
  suffix: draft.suffix || null,
  zipcode: draft.zipcode,
  city: draft.city,
  country: draft.country,
  phoneCountryCode: draft.phoneCountryCode,
  phoneAreaCode: draft.phoneAreaCode,
  phoneSubscriberNumber: draft.phoneSubscriberNumber,
  euEligibilityBasis: draft.euEligibilityBasis,
  euEligibilityCountry: draft.euEligibilityCountry,
})

const draftFromProfile = (profile: {
  customerName?: unknown
  firstName?: unknown
  lastName?: unknown
  partyType?: unknown
  contractingPartyName?: unknown
  kvkNumber?: unknown
  intendedCompanyName?: unknown
  billingAddress?: unknown
}): CheckoutProfileDraft => {
  const explicitFirstName = nullableText(profile.firstName)
  const explicitLastName = nullableText(profile.lastName)
  const nameParts = String(profile.customerName ?? "").trim().split(/\s+/).filter(Boolean)
  const address = isRecord(profile.billingAddress) ? profile.billingAddress : {}
  const partyType: ContractingPartyType =
    profile.partyType === "registered_business" ? "registered_business" : "business_in_formation"
  return {
    partyType,
    firstName: explicitFirstName ??
      (nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] ?? ""),
    lastName: explicitLastName ??
      (nameParts.length > 1 ? nameParts.at(-1) ?? "" : ""),
    registeredBusinessName: partyType === "registered_business"
      ? String(profile.contractingPartyName ?? "")
      : "",
    kvkNumber: partyType === "registered_business" ? String(profile.kvkNumber ?? "") : "",
    intendedCompanyName: partyType === "business_in_formation"
      ? String(profile.intendedCompanyName ?? "")
      : "",
    street: String(address.street ?? ""),
    number: String(address.number ?? ""),
    suffix: String(address.suffix ?? ""),
    zipcode: String(address.zipcode ?? ""),
    city: String(address.city ?? ""),
    country: String(address.country ?? "NL"),
    phoneCountryCode: String(address.phoneCountryCode ?? "+31"),
    phoneAreaCode: String(address.phoneAreaCode ?? ""),
    phoneSubscriberNumber: String(address.phoneSubscriberNumber ?? ""),
    euEligibilityBasis:
      address.euEligibilityBasis === "establishment" ||
      address.euEligibilityBasis === "residence" ||
      address.euEligibilityBasis === "citizenship"
        ? address.euEligibilityBasis
        : "",
    euEligibilityCountry: String(address.euEligibilityCountry ?? ""),
  }
}

export const checkoutProfileView = (profile: CheckoutProfile): CheckoutProfileView => ({
  ...draftFromProfile(profile),
  profileKey: profile.profileKey,
  profileVersion: profile.profileVersion,
  customerEmail: profile.customerEmail,
  contractingPartyName: profile.contractingPartyName,
  supersedesProfileKey: nullableText(profile.supersedesProfileKey),
  revisionReason:
    profile.revisionReason === "initial_capture" || profile.revisionReason === "customer_correction"
      ? profile.revisionReason
      : null,
  actorEmail: nullableText(profile.actorEmail),
  sourceRequestId: nullableText(profile.sourceRequestId),
  createdAt: profile.createdAt,
})

export async function loadLatestCheckoutProfile(
  payload: Payload,
  generationRunId: string | number,
): Promise<CheckoutProfile | null> {
  const result = await payload.find({
    collection: "checkout-profiles",
    where: { generationRun: { equals: generationRunId } },
    sort: "-profileVersion",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as CheckoutProfile | undefined) ?? null
}

const sameDraft = (left: CheckoutProfileDraft, right: CheckoutProfileDraft): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

export type SaveCheckoutProfileResult =
  | { status: "saved"; profile: CheckoutProfileView; created: boolean }
  | { status: "conflict"; currentProfile: CheckoutProfileView }

export async function saveCheckoutProfileVersion(input: {
  payload: Payload
  generationRunId: number
  tenantId?: number | null
  actorEmail: string
  expectedProfileVersion: number
  draft: CheckoutProfileDraft
  requestId: string
  ipAddress?: string | null
  userAgent?: string | null
  now?: Date
}): Promise<SaveCheckoutProfileResult> {
  if (!Number.isSafeInteger(input.expectedProfileVersion) || input.expectedProfileVersion < 0) {
    throw new Error("Expected checkout profile version must be a non-negative integer.")
  }
  const draft = checkoutProfileDraftSchema.parse(input.draft)
  const current = await loadLatestCheckoutProfile(input.payload, input.generationRunId)
  const currentVersion = current?.profileVersion ?? 0
  if (currentVersion !== input.expectedProfileVersion) {
    if (!current) throw new Error("Checkout profile version conflict could not be resolved.")
    return { status: "conflict", currentProfile: checkoutProfileView(current) }
  }
  if (
    current &&
    nullableText(current.firstName) &&
    nullableText(current.lastName) &&
    sameDraft(draftFromProfile(current), draft)
  ) {
    return { status: "saved", profile: checkoutProfileView(current), created: false }
  }

  const profileVersion = currentVersion + 1
  const profileKey = `run:${input.generationRunId}:checkout-profile:${profileVersion}`
  const actorEmail = input.actorEmail.trim().toLowerCase()
  const customerName = `${draft.firstName} ${draft.lastName}`.trim()
  const registered = draft.partyType === "registered_business"
  try {
    const created = await input.payload.create({
      collection: "checkout-profiles",
      data: {
        profileKey,
        profileVersion,
        generationRun: input.generationRunId,
        tenant: input.tenantId ?? undefined,
        customerName,
        firstName: draft.firstName,
        lastName: draft.lastName,
        customerEmail: actorEmail,
        customerPhone: `${draft.phoneCountryCode} ${draft.phoneAreaCode} ${draft.phoneSubscriberNumber}`,
        partyType: draft.partyType,
        contractingPartyName: registered ? draft.registeredBusinessName : customerName,
        kvkNumber: registered ? draft.kvkNumber : null,
        contractingPartyKind: registered ? undefined : "natural_person",
        domainRegistrantSource: "contracting_party",
        intendedCompanyName: registered ? undefined : draft.intendedCompanyName || undefined,
        billingAddress: billingAddressFromDraft(draft),
        supersedesProfileKey: current?.profileKey ?? undefined,
        revisionReason: current ? "customer_correction" : "initial_capture",
        actorEmail,
        sourceRequestId: input.requestId,
        sourceIpAddress: input.ipAddress ?? undefined,
        sourceUserAgent: input.userAgent ?? undefined,
        createdAt: (input.now ?? new Date()).toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    }) as CheckoutProfile
    return { status: "saved", profile: checkoutProfileView(created), created: true }
  } catch (error) {
    const winner = await loadLatestCheckoutProfile(input.payload, input.generationRunId)
    if (winner && winner.profileVersion > input.expectedProfileVersion) {
      return { status: "conflict", currentProfile: checkoutProfileView(winner) }
    }
    throw error
  }
}

export const checkoutProfileDraftFromFormData = (formData: FormData) =>
  checkoutProfileDraftSchema.safeParse({
    partyType: String(formData.get("partyType") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    registeredBusinessName: String(formData.get("registeredBusinessName") ?? ""),
    kvkNumber: String(formData.get("kvkNumber") ?? "").replace(/\D/g, ""),
    intendedCompanyName: String(formData.get("intendedCompanyName") ?? ""),
    street: String(formData.get("street") ?? ""),
    number: String(formData.get("number") ?? ""),
    suffix: String(formData.get("suffix") ?? ""),
    zipcode: String(formData.get("zipcode") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? "NL"),
    phoneCountryCode: String(formData.get("phoneCountryCode") ?? "+31"),
    phoneAreaCode: String(formData.get("phoneAreaCode") ?? "").replace(/\D/g, ""),
    phoneSubscriberNumber: String(formData.get("phoneSubscriberNumber") ?? "").replace(/\D/g, ""),
    euEligibilityBasis: String(formData.get("euEligibilityBasis") ?? ""),
    euEligibilityCountry: String(formData.get("euEligibilityCountry") ?? "")
      .toUpperCase(),
  })

export type CheckoutProfileIdentity = Pick<
  CheckoutProfile,
  | "profileKey"
  | "profileVersion"
  | "customerName"
  | "firstName"
  | "lastName"
  | "customerEmail"
  | "partyType"
  | "contractingPartyName"
  | "kvkNumber"
  | "intendedCompanyName"
  | "billingAddress"
>

export function domainRegistrantFromCheckoutProfile(
  profile: CheckoutProfileIdentity,
): DomainRegistrantDetails {
  if (!nullableText(profile.firstName) || !nullableText(profile.lastName)) {
    throw new Error(
      "Authoritative checkout profile requires confirmed structured first and last names.",
    )
  }
  const draft = checkoutProfileDraftSchema.parse(draftFromProfile(profile))
  const registrant = normalizeDomainRegistrantDetails({
    companyName: profile.partyType === "registered_business"
      ? profile.contractingPartyName
      : null,
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: profile.customerEmail,
    street: draft.street,
    number: draft.number,
    suffix: draft.suffix,
    zipcode: draft.zipcode,
    city: draft.city,
    country: draft.country,
    state: null,
    phoneCountryCode: draft.phoneCountryCode,
    phoneAreaCode: draft.phoneAreaCode,
    phoneSubscriberNumber: draft.phoneSubscriberNumber,
    locale: "nl_NL",
    euEligibilityBasis: draft.euEligibilityBasis || undefined,
    euEligibilityCountry: draft.euEligibilityCountry || undefined,
  })
  if (!registrant) throw new Error("Authoritative checkout profile is incomplete for domain registration.")
  return registrant
}
