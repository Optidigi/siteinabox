import type { CollectionBeforeValidateHook } from "payload"
import type { Page } from "@/payload-types"
import { approvedCatalogIssues } from "@/lib/sitegen/catalog"

/** Existing unavailable sections remain repairable drafts; new or changed ones fail closed. */
export const enforceApprovedCatalog: CollectionBeforeValidateHook<Page> = ({ data, originalDoc }) => {
  const blocks: unknown = data?.blocks ?? originalDoc?.blocks
  if (blocks === undefined) return data
  const issues = approvedCatalogIssues(blocks)
  if (issues.length === 0) return data
  const previous: unknown = originalDoc?.blocks
  const remainingLegacy = Array.isArray(previous)
    ? previous.map((block: unknown) => JSON.stringify(block))
    : []
  const isDraft = (data?.status ?? originalDoc?.status ?? "draft") === "draft"
  const unchangedLegacy = isDraft && Array.isArray(blocks) && Array.isArray(previous)
    && issues.every((issue) => {
      const index = issue.path[1]
      if (typeof index !== "number") return false
      const matchingIndex = remainingLegacy.indexOf(JSON.stringify(blocks[index]))
      if (matchingIndex < 0) return false
      remainingLegacy.splice(matchingIndex, 1)
      return true
    })
  if (!unchangedLegacy) throw new Error(issues.map((issue) => issue.message).join(" "))
  return data
}
