import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { relationshipId, relationshipIdSet } from "@/lib/relationshipId"
import { themeSchema } from "@/lib/theme/schema"
import { navEntryPageId } from "@/lib/nav/membership"
import { publishCurrentTenantState } from "@/lib/publish/currentState"
import { DEFER_PAGE_AUTO_PUBLISH_HEADER } from "@/lib/publish/pageEditorSaveContract"

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const relationshipValue = (value: unknown): string | number | null => {
  if (typeof value === "string" || typeof value === "number") return value
  if (!isRecord(value)) return null
  return typeof value.id === "string" || typeof value.id === "number" ? value.id : null
}

const userCanEditTenant = (user: any, tenantId: string): boolean => {
  if (user?.role === "super-admin") return true
  if (user?.role !== "owner" && user?.role !== "editor") return false
  return relationshipIdSet((user.tenants ?? []).map((entry: any) => entry.tenant)).has(tenantId)
}

const plainNavRow = (row: any) => ({
  type: row?.type,
  page: navEntryPageId(row?.page),
  anchor: row?.anchor ?? null,
  url: row?.url ?? null,
  label: row?.label ?? null,
  external: Boolean(row?.external),
})

const navRowsWithPage = (rows: any[], pageId: string | number, included: boolean) => {
  const id = Number(pageId)
  const withoutPage = rows.map(plainNavRow).filter((row) => !(row.type === "page" && row.page === id))
  return included
    ? [...withoutPage, { type: "page", page: id, anchor: null, url: null, label: null, external: false }]
    : withoutPage
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers }).catch(() => ({ user: null }))
  if (!user) return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const tenantId = isRecord(body) ? relationshipId(body.tenantId) : null
  if (!tenantId || !isRecord(body?.page) || !isRecord(body.page.data)) {
    return NextResponse.json({ message: "tenantId and page.data are required" }, { status: 400 })
  }
  if (!userCanEditTenant(user, tenantId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const theme = body.theme == null ? null : themeSchema.safeParse(body.theme)
  if (theme && !theme.success) {
    return NextResponse.json({ message: `Invalid theme data: ${theme.error.message}` }, { status: 400 })
  }
  const navigation = body.navigation == null ? null : body.navigation
  const chrome = body.chrome == null ? null : body.chrome
  if ((navigation != null && !isRecord(navigation)) || (chrome != null && !isRecord(chrome))) {
    return NextResponse.json({ message: "navigation and chrome must be objects" }, { status: 400 })
  }
  if ((navigation != null || chrome != null) && user.role !== "owner" && user.role !== "super-admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) return NextResponse.json({ message: "Save transaction could not be started" }, { status: 500 })

  const headers = new Headers(request.headers)
  headers.set(DEFER_PAGE_AUTO_PUBLISH_HEADER, "1")
  const req = { transactionID, user, payload, headers, context: { pageEditorSave: true } } as any
  let stage = "page"

  try {
    const pageArgs = {
      collection: "pages" as const,
      data: { ...body.page.data, tenant: tenantId },
      depth: 2,
      user,
      overrideAccess: false,
      req,
    }
    const savedPage = (body.page.id == null
      ? await payload.create(pageArgs as any)
      : await payload.update({ ...pageArgs, id: body.page.id } as any)) as any

    const savedTenantId = relationshipValue((savedPage as any).tenant)
    if (savedTenantId == null || relationshipId(savedTenantId) !== tenantId) throw new Error("Saved page tenant mismatch")

    if (theme?.success) {
      stage = "theme"
      await payload.update({
        collection: "tenants",
        id: tenantId,
        data: { theme: theme.data } as any,
        depth: 0,
        overrideAccess: true,
        req,
      })
    }

    if (navigation != null || chrome != null) {
      stage = "site-settings"
      const found = await payload.find({
        collection: "site-settings",
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        user,
        overrideAccess: false,
        req,
      })
      const settings = found.docs[0] as any
      if (!settings) throw new Error("Site settings are unavailable for this tenant")
      const data: Record<string, unknown> = {}
      if (chrome != null) data.chrome = chrome
      if (isRecord(navigation)) {
        if (typeof navigation.inHeader === "boolean") {
          data.navHeader = navRowsWithPage(settings.navHeader ?? [], savedPage.id, navigation.inHeader)
        }
        if (typeof navigation.inFooter === "boolean") {
          data.navFooter = navRowsWithPage(settings.navFooter ?? [], savedPage.id, navigation.inFooter)
        }
      }
      await payload.update({
        collection: "site-settings",
        id: settings.id,
        data: data as any,
        depth: 0,
        user,
        overrideAccess: false,
        req,
      })
    }

    stage = "publish"
    const published = await publishCurrentTenantState(payload, {
      // Preserve Payload's native relationship ID type. PostgreSQL-backed
      // relationship validation rejects the stringified numeric ID when the
      // snapshot is created inside this request's transaction.
      tenantId: savedTenantId,
      user,
      reason: `page editor save for page ${String(savedPage.id)}`,
      req,
    })

    stage = "commit"
    await payload.db.commitTransaction(transactionID)
    return NextResponse.json({
      ok: true,
      page: { id: savedPage.id, slug: (savedPage as any).slug },
      snapshot: { id: published.snapshot.id, version: published.snapshot.version, status: published.snapshot.status },
      theme: theme?.success ? theme.data : undefined,
    })
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    const message = error instanceof Error ? error.message : "Save failed"
    payload.logger.error({ stage, tenantId, userId: user.id, message }, "[page-editor-save] transaction failed")
    const status = /^Forbidden\b/i.test(message) ? 403 : 422
    return NextResponse.json({ ok: false, stage, message }, { status })
  }
}
