import type { CollectionAfterChangeHook } from "payload"
import { hasPayloadSessionCookie } from "@/access/authSignals"
import { relationshipId } from "@/lib/relationshipId"
import { DEFER_PAGE_AUTO_PUBLISH_HEADER } from "@/lib/publish/pageEditorSaveContract"

/**
 * Compatibility fallback for an editor tab that predates the current
 * save-and-publish client flow. Current tabs defer this hook until their
 * related theme/navigation/chrome writes finish, then publish explicitly.
 */
export const publishPageAfterUserSave: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!req.user || doc.status !== "published") return doc
  // This fallback is only for an interactive editor session. Local API and
  // API-key clients own their publication lifecycle explicitly.
  if (!hasPayloadSessionCookie(req)) return doc
  if (req.headers.get(DEFER_PAGE_AUTO_PUBLISH_HEADER) === "1") return doc

  const tenantId = relationshipId(doc.tenant)
  if (!tenantId) throw new Error("Published page is missing its tenant relationship.")

  const { publishCurrentTenantState } = await import("@/lib/publish/currentState")
  await publishCurrentTenantState(req.payload, {
    tenantId,
    user: req.user,
    reason: `auto-publish current CMS state after page ${String(doc.id)} save`,
  })
  return doc
}
