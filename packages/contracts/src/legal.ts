import { z } from "zod"

export const legalDocumentTypes = ["platform-terms", "platform-privacy"] as const
export const legalChangeCategories = [
  "editorial",
  "non_material_clarification",
  "administrative",
  "service_operational",
  "subprocessor_change",
  "privacy_transparency",
  "privacy_material",
  "contract_material",
  "customer_adverse",
  "consent_scope_change",
] as const
export const legalCustomerActions = [
  "none",
  "publish_notice",
  "direct_notice",
  "notice_and_continued_use",
  "reaccept_on_next_transaction",
  "mandatory_reaccept",
] as const
export const legalConsentActions = [
  "none",
  "renew_analytics",
  "renew_marketing",
  "renew_all_optional",
] as const

export const legalDocumentTypeSchema = z.enum(legalDocumentTypes)
export const legalChangeCategorySchema = z.enum(legalChangeCategories)
export const legalCustomerActionSchema = z.enum(legalCustomerActions)
export const legalConsentActionSchema = z.enum(legalConsentActions)

const policy = {
  editorial: { customer: ["none"], consent: ["none"] },
  non_material_clarification: { customer: ["none", "publish_notice"], consent: ["none"] },
  administrative: { customer: ["none", "publish_notice", "direct_notice"], consent: ["none"] },
  service_operational: { customer: ["publish_notice", "direct_notice"], consent: ["none"] },
  subprocessor_change: { customer: ["direct_notice"], consent: ["none"] },
  privacy_transparency: { customer: ["none", "publish_notice"], consent: ["none"] },
  privacy_material: {
    customer: ["direct_notice"],
    consent: ["none", "renew_analytics", "renew_marketing", "renew_all_optional"],
  },
  contract_material: {
    customer: ["notice_and_continued_use", "reaccept_on_next_transaction", "mandatory_reaccept"],
    consent: ["none"],
  },
  customer_adverse: { customer: ["mandatory_reaccept"], consent: ["none"] },
  consent_scope_change: {
    customer: ["publish_notice", "direct_notice"],
    consent: ["renew_analytics", "renew_marketing", "renew_all_optional"],
  },
} as const satisfies Record<(typeof legalChangeCategories)[number], { customer: readonly string[]; consent: readonly string[] }>

const versionSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/, "Use YYYY-MM-DD.revision")
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/)

export const legalReleaseSchema = z.object({
  documentType: legalDocumentTypeSchema,
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  documentVersion: versionSchema,
  acceptanceVersion: z.string().min(1).nullable(),
  replaces: versionSchema.optional(),
  publishedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
  contentHash: sha256Schema,
  sourceCommit: z.string().regex(/^[a-f0-9]{7,40}$/),
  change: z.object({
    category: legalChangeCategorySchema,
    summary: z.string().min(1),
    rationale: z.string().min(1),
    customerAction: legalCustomerActionSchema,
    consentAction: legalConsentActionSchema.default("none"),
    audience: z.string().min(1).optional(),
    noticeDays: z.number().int().nonnegative().optional(),
  }),
}).superRefine((release, ctx) => {
  const allowed = policy[release.change.category]
  if (!(allowed.customer as readonly string[]).includes(release.change.customerAction)) {
    ctx.addIssue({ code: "custom", path: ["change", "customerAction"], message: `Invalid customer action for ${release.change.category}` })
  }
  if (!(allowed.consent as readonly string[]).includes(release.change.consentAction)) {
    ctx.addIssue({ code: "custom", path: ["change", "consentAction"], message: `Invalid consent action for ${release.change.category}` })
  }
  if (["mandatory_reaccept", "notice_and_continued_use"].includes(release.change.customerAction) && release.change.noticeDays == null) {
    ctx.addIssue({ code: "custom", path: ["change", "noticeDays"], message: "This customer action requires a notice period" })
  }
})

export type LegalRelease = z.infer<typeof legalReleaseSchema>
export type LegalDocumentType = z.infer<typeof legalDocumentTypeSchema>
export type LegalChangeCategory = z.infer<typeof legalChangeCategorySchema>
export type LegalCustomerAction = z.infer<typeof legalCustomerActionSchema>
export type LegalConsentAction = z.infer<typeof legalConsentActionSchema>

export const validateLegalReleaseTransition = (release: LegalRelease, previous?: LegalRelease): string[] => {
  const issues: string[] = []
  if (!previous) return issues
  if (release.replaces !== previous.documentVersion) issues.push("replaces must identify the previous document version")

  const requiresAcceptance = release.change.customerAction === "mandatory_reaccept" ||
    release.change.customerAction === "reaccept_on_next_transaction" ||
    release.change.customerAction === "notice_and_continued_use"
  if (requiresAcceptance && (!release.acceptanceVersion || release.acceptanceVersion === previous.acceptanceVersion)) {
    issues.push("re-acceptance requires a new acceptanceVersion")
  }
  if (release.change.category === "editorial" && release.acceptanceVersion !== previous.acceptanceVersion) {
    issues.push("editorial changes must preserve acceptanceVersion")
  }
  return issues
}
