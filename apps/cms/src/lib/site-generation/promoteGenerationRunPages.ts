import "server-only"
import type { Payload } from "payload"
import type { Page, SiteGenerationRun } from "@/payload-types"
import { relationshipId, relationshipIdSet } from "@/lib/relationshipId"

const PROMOTION_CONTEXT = {
  skipProjection: true,
  source: "site-generation-promotion",
} as const

export type GenerationRunPagePromotionResult = {
  runId: string | number
  tenantId: string
  promotedAt: string
  promotedBy?: string | number | null
  promotedPageIds: Array<string | number>
  alreadyPublishedPageIds: Array<string | number>
  missingPageIds: string[]
}

const approvalStatus = (run: SiteGenerationRun): unknown =>
  (run.clientApproval as { status?: unknown } | null | undefined)?.status

const runPromotionMetadata = (
  applyResult: unknown,
  promotion: GenerationRunPagePromotionResult,
): Record<string, unknown> => {
  const base = applyResult && typeof applyResult === "object" && !Array.isArray(applyResult)
    ? { ...(applyResult as Record<string, unknown>) }
    : {}
  return {
    ...base,
    promotion: {
      status: "promoted",
      promotedAt: promotion.promotedAt,
      promotedBy: promotion.promotedBy ?? null,
      promotedPageIds: promotion.promotedPageIds.map(String),
      alreadyPublishedPageIds: promotion.alreadyPublishedPageIds.map(String),
      missingPageIds: promotion.missingPageIds,
    },
  }
}

export async function promoteGenerationRunPages(
  payload: Payload,
  generationRunId: string | number,
  options: { promotedBy?: string | number | null } = {},
): Promise<GenerationRunPagePromotionResult> {
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: generationRunId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun

  if (approvalStatus(run) !== "approved") {
    throw new Error("Generation run pages can only be promoted after client approval.")
  }

  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")

  const runPageIds = relationshipIdSet(Array.isArray(run.pages) ? run.pages : [])
  if (runPageIds.size === 0) {
    throw new Error("Generation run has no linked pages to promote.")
  }

  const pageResult = await payload.find({
    collection: "pages",
    where: { tenant: { equals: tenantId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const pages = (pageResult.docs as Page[]).filter((page) => runPageIds.has(String(page.id)))
  if (pages.length === 0) {
    throw new Error("Generation run linked pages were not found for this tenant.")
  }

  const foundIds = new Set(pages.map((page) => String(page.id)))
  const missingPageIds = [...runPageIds].filter((id) => !foundIds.has(id))
  if (missingPageIds.length > 0) {
    throw new Error(`Generation run is missing linked pages: ${missingPageIds.join(", ")}`)
  }
  const alreadyPublishedPageIds = pages
    .filter((page) => page.status === "published")
    .map((page) => page.id)
  const draftPages = pages.filter((page) => page.status !== "published")

  await Promise.all(draftPages.map((page) => payload.update({
    collection: "pages",
    id: page.id,
    data: { status: "published" },
    depth: 0,
    overrideAccess: true,
    context: PROMOTION_CONTEXT,
  })))

  const promotedAt = new Date().toISOString()
  const result: GenerationRunPagePromotionResult = {
    runId: run.id,
    tenantId,
    promotedAt,
    promotedBy: options.promotedBy ?? null,
    promotedPageIds: draftPages.map((page) => page.id),
    alreadyPublishedPageIds,
    missingPageIds,
  }

  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: {
      applyResult: runPromotionMetadata(run.applyResult, result),
    },
    depth: 0,
    overrideAccess: true,
  })

  return result
}
