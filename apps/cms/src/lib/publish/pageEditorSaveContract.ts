import { z } from "zod"
import { themeSchema } from "@/lib/theme/schema"

export const DEFER_PAGE_AUTO_PUBLISH_HEADER = "x-siab-defer-page-auto-publish"

/**
 * When omitted, page editor saves still publish after a successful save
 * (operator-compatible default).
 */
export const DEFAULT_PAGE_EDITOR_PUBLISH = true

export const PAGE_EDITOR_SAVE_CONFLICT_CODE = "PAGE_STALE" as const

const tenantIdSchema = z.union([z.string().min(1), z.number()])

const pageSectionSchema = z.object({
  id: z.union([z.string().min(1), z.number()]).optional(),
  data: z.record(z.string(), z.unknown()),
  expectedUpdatedAt: z.string().min(1).optional(),
})

const navigationMembershipSchema = z.object({
  inHeader: z.boolean(),
  inFooter: z.boolean(),
})

const siteDesignSectionSchema = z
  .object({
    theme: themeSchema.optional(),
    navigation: navigationMembershipSchema.optional(),
    chrome: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export const pageEditorSaveRequestSchema = z
  .object({
    tenantId: tenantIdSchema,
    page: pageSectionSchema,
    siteDesign: siteDesignSectionSchema.optional(),
    publish: z.boolean().optional(),
  })
  .strict()

export type PageEditorSaveRequest = z.infer<typeof pageEditorSaveRequestSchema>
export type PageEditorPageSection = z.infer<typeof pageSectionSchema>
export type PageEditorSiteDesignSection = z.infer<typeof siteDesignSectionSchema>

export type PageEditorSaveSuccessResponse = {
  ok: true
  page: { id: string | number; slug?: string | null; updatedAt?: string }
  snapshot?: { id: string | number; version: number; status: string }
  theme?: z.infer<typeof themeSchema>
}

export type PageEditorSaveFailureResponse = {
  ok: false
  stage: string
  message: string
}

export type PageEditorSaveConflictResponse = {
  ok: false
  error: "conflict"
  code: typeof PAGE_EDITOR_SAVE_CONFLICT_CODE
  message: string
  expectedUpdatedAt: string
  actualUpdatedAt: string
}

export const resolvePageEditorPublish = (publish: boolean | undefined): boolean =>
  publish !== false

export const hasPageEditorSiteDesign = (
  siteDesign: PageEditorSiteDesignSection | undefined,
): boolean =>
  siteDesign?.theme != null ||
  siteDesign?.navigation != null ||
  siteDesign?.chrome != null

export const parsePageEditorSaveRequest = (
  body: unknown,
):
  | { success: true; data: PageEditorSaveRequest }
  | { success: false; message: string } => {
  const parsed = pageEditorSaveRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid save request" }
  }
  return { success: true, data: parsed.data }
}
