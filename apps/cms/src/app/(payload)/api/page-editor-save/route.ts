import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { relationshipId, relationshipValue } from "@/lib/relationshipId"
import {
  DEFER_PAGE_AUTO_PUBLISH_HEADER,
  hasPageEditorSiteDesign,
  parsePageEditorSaveRequest,
  resolvePageEditorPublish,
  type PageEditorSaveConflictResponse,
  type PageEditorSaveFailureResponse,
  type PageEditorSaveSuccessResponse,
} from "@/lib/publish/pageEditorSaveContract"
import {
  assertPageRevisionFresh,
  PageSaveConflictError,
  persistPageDocument,
  persistSiteDesign,
  publishTenantSnapshot,
  userCanEditSiteDesign,
  userCanEditTenantPages,
  type PageEditorSaveStage,
  type PageEditorTransactionReq,
} from "@/lib/publish/pageEditorSave"

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers }).catch(() => ({ user: null }))
  if (!user) return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = parsePageEditorSaveRequest(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const { tenantId: rawTenantId, page, siteDesign, publish } = parsed.data
  const tenantId = relationshipId(rawTenantId)
  if (!tenantId) {
    return NextResponse.json({ message: "tenantId is required" }, { status: 400 })
  }
  if (!userCanEditTenantPages(user, tenantId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const siteDesignRequested = hasPageEditorSiteDesign(siteDesign)
  if (
    siteDesign != null &&
    (siteDesign.navigation != null || siteDesign.chrome != null) &&
    !userCanEditSiteDesign(user)
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    await assertPageRevisionFresh(payload, page, tenantId, user)
  } catch (error) {
    if (error instanceof PageSaveConflictError) {
      const conflict: PageEditorSaveConflictResponse = {
        ok: false,
        error: "conflict",
        code: error.code,
        message: error.message,
        expectedUpdatedAt: error.expectedUpdatedAt,
        actualUpdatedAt: error.actualUpdatedAt,
      }
      return NextResponse.json(conflict, { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Save failed"
    const status = /^Forbidden\b/i.test(message) ? 403 : 422
    return NextResponse.json({ ok: false, stage: "page", message }, { status })
  }

  const shouldPublish = resolvePageEditorPublish(publish)
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) {
    return NextResponse.json({ message: "Save transaction could not be started" }, { status: 500 })
  }

  const headers = new Headers(request.headers)
  headers.set(DEFER_PAGE_AUTO_PUBLISH_HEADER, "1")
  const req: PageEditorTransactionReq = {
    transactionID,
    user,
    payload,
    headers,
    context: { pageEditorSave: true },
  }
  let stage: PageEditorSaveStage = "page"

  try {
    const savedPage = await persistPageDocument(payload, { tenantId, page, user, req })
    const savedTenantId = relationshipValue(savedPage.tenant)
    if (savedTenantId == null || relationshipId(savedTenantId) !== tenantId) {
      throw new Error("Saved page tenant mismatch")
    }

    let savedTheme = siteDesign?.theme
    if (siteDesignRequested && siteDesign) {
      if (siteDesign.theme != null) stage = "theme"
      if (siteDesign.navigation != null || siteDesign.chrome != null) stage = "site-settings"
      const siteDesignResult = await persistSiteDesign(payload, {
        tenantId,
        siteDesign,
        savedPageId: savedPage.id,
        user,
        req,
      })
      savedTheme = siteDesignResult.theme ?? savedTheme
    }

    let snapshot: PageEditorSaveSuccessResponse["snapshot"]
    if (shouldPublish) {
      stage = "publish"
      const published = await publishTenantSnapshot(payload, {
        tenantId: savedTenantId,
        pageId: savedPage.id,
        user,
        req,
      })
      snapshot = {
        id: published.snapshot.id,
        version: published.snapshot.version,
        status: published.snapshot.status,
      }
    }

    stage = "commit"
    await payload.db.commitTransaction(transactionID)

    const response: PageEditorSaveSuccessResponse = {
      ok: true,
      page: { id: savedPage.id, slug: savedPage.slug },
      ...(snapshot ? { snapshot } : {}),
      ...(savedTheme ? { theme: savedTheme } : {}),
    }
    return NextResponse.json(response)
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    const message = error instanceof Error ? error.message : "Save failed"
    payload.logger.error({ stage, tenantId, userId: user.id, message }, "[page-editor-save] transaction failed")
    const failure: PageEditorSaveFailureResponse = { ok: false, stage, message }
    const status = /^Forbidden\b/i.test(message) ? 403 : 422
    return NextResponse.json(failure, { status })
  }
}
