import { z } from "zod"
import { PageSchema, SiteSettingsSchema, ThemeTokenSpecSchema } from "@siteinabox/contracts"
import { BuilderFactsSchema } from "./facts"
import { BuilderChatMessageSchema, BuilderThreadSchema, BuilderChoiceSchema } from "./thread"

export const quotaCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1)
const id = z.number().int().positive().safe()
const date = z.string().datetime({ offset: true })
export const quotaAccountSchema = z.object({ id, customerEmail: z.email(), visibleUsed: quotaCount,
  visibleReserved: quotaCount.max(1), activeOperationKey: z.string().nullable().optional(), ingressToken: z.uuid().nullable().optional(),
  chargedCostUnits: quotaCount, attempts: quotaCount, revision: quotaCount, ingressRequests: quotaCount, ingressDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lastActivityAt: date })
export const quotaGlobalSchema = z.object({ id, key: z.literal("builder"), activeOperations: quotaCount,
  chargedCostUnits: quotaCount, attempts: quotaCount, revision: quotaCount, ingressRequests: quotaCount, ingressDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
export const builderTerminalResultSchema = z.object({
  ok: z.boolean(), text: z.string().max(64 * 1024), facts: BuilderFactsSchema.nullable().optional(),
  clientSlug: z.string().nullable().optional(), messages: z.array(BuilderChatMessageSchema).max(200),
  status: z.string().optional(), error: z.string().optional(), choices: z.array(BuilderChoiceSchema).optional(),
  applied: z.boolean().optional(), previewSnapshot: z.object({ pageId: z.string(), page: PageSchema, settings: SiteSettingsSchema, theme: ThemeTokenSpecSchema.nullable() }).nullable().optional(),
}).refine((result) => Buffer.byteLength(JSON.stringify(result), "utf8") <= 512 * 1024, "Builder terminal result exceeds its durable byte envelope")
export const quotaOperationSchema = z.object({
  id, operationKey: z.string().min(1), operationId: z.uuid(), customerEmail: z.email(), messageHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["reserved", "running", "succeeded", "failed", "interrupted"]), reservationToken: z.uuid(),
  revision: quotaCount, reservedCostUnits: quotaCount, settledCostUnits: quotaCount,
  dispatchedCostUnits: quotaCount, knownCostUnits: quotaCount, modelCalls: quotaCount,
  weightedSteps: quotaCount, unknownCalls: quotaCount, outstandingCalls: quotaCount, costKnown: z.boolean(), slotHeld: z.boolean(),
  startedAt: date, deadlineAt: date, settledAt: date.nullable().optional(),
  errorCode: z.string().nullable().optional(), result: builderTerminalResultSchema.nullable().optional(),
  intakeSubmissionId: id.nullable().optional(), generationRunId: id.nullable().optional(),
  configurationRevision: z.string().min(1),
})
export const builderOperationInputSchema = z.object({ operationId: z.uuid().transform((value) => value.toLowerCase()), message: z.string().trim().min(2).max(4000), locale: z.enum(["nl", "en"]).optional() }).strict()
export const builderSettlementSchema = z.object({ thread: BuilderThreadSchema, result: builderTerminalResultSchema })
export type QuotaAccount = z.infer<typeof quotaAccountSchema>
export type QuotaGlobal = z.infer<typeof quotaGlobalSchema>
export type QuotaOperation = z.infer<typeof quotaOperationSchema>
export type BuilderTerminalResult = z.infer<typeof builderTerminalResultSchema>
export type BuilderOperationInput = z.infer<typeof builderOperationInputSchema>
