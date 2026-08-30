import { z } from "zod"

/** Optional consent categories understood by the shared site runtime. */
export const CONSENT_OPTIONAL_CATEGORIES = [
  "preferences",
  "analytics",
  "marketing",
] as const

export const ConsentSelectionSchema = z.object({
  preferences: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
}).strict()

export type ConsentCategory = (typeof CONSENT_OPTIONAL_CATEGORIES)[number]
export type ConsentSelection = z.infer<typeof ConsentSelectionSchema>
/** Partial input keeps the public runtime API compatible with analytics-only callers. */
export type ConsentSelectionInput = Partial<ConsentSelection>

export const ConsentSnapshotSchema = z.object({
  necessary: z.literal(true),
  preferences: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  decided: z.boolean(),
}).strict()

export type ConsentSnapshot = z.infer<typeof ConsentSnapshotSchema>

/**
 * Persisted receipts accept older analytics-only records by defaulting the two
 * newer optional categories to false during parsing.
 */
export const ConsentReceiptSchema = z.object({
  version: z.string().min(1),
  categories: z.object({
    necessary: z.literal(true),
    preferences: z.boolean().default(false),
    analytics: z.boolean().default(false),
    marketing: z.boolean().default(false),
  }).strict(),
}).strict()

export type ConsentReceipt = z.infer<typeof ConsentReceiptSchema>
