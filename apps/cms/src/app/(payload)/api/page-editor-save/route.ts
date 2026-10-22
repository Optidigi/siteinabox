import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { CustomerProjectionTask } from "@/lib/projection/customerTransaction"
import { relationshipId, relationshipValue } from "@/lib/relationshipId"
import { hasManualWorkspaceAccess, canRepublishWorkspace } from "@/lib/workspace/manualAccess"
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
  lockPageEditorWorkspace,
  PageSaveConflictError,
  SiteDesignSaveConflictError,
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
  if (user.role !== "super-admin" && !await hasManualWorkspaceAccess(payload, tenantId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }
  if (resolvePageEditorPublish(publish) && user.role !== "super-admin" && !await canRepublishWorkspace(payload, tenantId)) {
    return NextResponse.json({ message: "Forbidden: first activation requires its own authority" }, { status: 403 })
  }

  const siteDesignRequested = hasPageEditorSiteDesign(siteDesign)
  if (
    siteDesign != null &&
    siteDesign.navigation != null &&
    !userCanEditSiteDesign(user)
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    await assertPageRevisionFresh(payload, page, tenantId, user)
  } catch (error) {
    if (error instanceof PageSaveConflictError || error instanceof SiteDesignSaveConflictError) {
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
  const projections: CustomerProjectionTask[] = []
  const req: PageEditorTransactionReq = {
    transactionID,
    user,
    payload,
    headers,
    context: { pageEditorSave: true, customerProjectionQueue: task => { projections.push(task) } },
  }
  let stage: PageEditorSaveStage = "page"

  try {
    await lockPageEditorWorkspace(payload, tenantId, req)
    await assertPageRevisionFresh(payload, page, tenantId, user, req)
    const savedPage = await persistPageDocument(payload, { tenantId, page, user, req })
    const savedTenantId = relationshipValue(savedPage.tenant)
    if (savedTenantId == null || relationshipId(savedTenantId) !== tenantId) {
      throw new Error("Saved page tenant mismatch")
    }

    let savedTheme = siteDesign?.theme
    if (siteDesignRequested && siteDesign) {
      if (siteDesign.theme != null) stage = "theme"
      if (siteDesign.navigation != null) stage = "site-settings"
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
      page: {
        id: savedPage.id,
        slug: savedPage.slug,
        ...(savedPage.updatedAt ? { updatedAt: savedPage.updatedAt } : {}),
      },
      ...(snapshot ? { snapshot } : {}),
      ...(savedTheme ? { theme: savedTheme } : {}),
    }
    // Database work is committed. Projection cannot be rolled back with it;
    // attempt every queued refresh and report a recoverable committed outcome.
    let projectionPending = false
    for (const task of projections) {
      try { await task.run() }
      catch {
        projectionPending = true
        payload.logger.error({ code: "E_CUSTOMER_PROJECTION_PENDING", committed: true,
          tenantId, collection: task.collection, documentId: task.documentId }, "[page-editor-save] saved content needs projection refresh")
      }
    }
    return NextResponse.json({ ...response, ...(projectionPending ? { warning: "E_CUSTOMER_PROJECTION_PENDING" } : {}) })
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    if (error instanceof PageSaveConflictError || error instanceof SiteDesignSaveConflictError) {
      const conflict: PageEditorSaveConflictResponse = { ok: false, error: "conflict", code: error.code,
        message: error.message, expectedUpdatedAt: error.expectedUpdatedAt, actualUpdatedAt: error.actualUpdatedAt }
      return NextResponse.json(conflict, { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Save failed"
    payload.logger.error({ stage, tenantId, userId: user.id, message }, "[page-editor-save] transaction failed")
    const failure: PageEditorSaveFailureResponse = { ok: false, stage, message }
    const status = /^Forbidden\b/i.test(message) ? 403 : 422
    return NextResponse.json(failure, { status })
  }
}
