import type { CollectionAfterChangeHook } from "payload"
import { hasPayloadSessionCookie } from "@/access/authSignals"
import { DEFER_PAGE_AUTO_PUBLISH_HEADER } from "@/lib/publish/pageEditorSaveContract"

/** Old interactive clients must reload rather than implicitly publish. */
export const publishPageAfterUserSave: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.user && doc.status === "published" && hasPayloadSessionCookie(req) &&
      req.headers.get(DEFER_PAGE_AUTO_PUBLISH_HEADER) !== "1") {
    throw new Error("Reload the editor to save privately or publish explicitly.")
  }
  return doc
}
