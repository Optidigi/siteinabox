import "server-only"

import type { Payload, PayloadRequest } from "payload"
import type { Page, SiteSetting, User } from "@/payload-types"
import { relationshipId, relationshipIdSet, relationshipValue } from "@/lib/relationshipId"
import { navEntryPageId } from "@/lib/nav/membership"
import { publishCurrentTenantState } from "@/lib/publish/currentState"
import type { ThemeTokens } from "@/lib/theme/schema"
import {
  PAGE_EDITOR_SAVE_CONFLICT_CODE,
  type PageEditorPageSection,
  type PageEditorSiteDesignSection,
} from "@/lib/publish/pageEditorSaveContract"

export type PageEditorSaveStage = "page" | "theme" | "site-settings" | "publish" | "commit"

export type PageEditorTransactionReq = {
  transactionID: string | number
  user: User
  payload: Payload
  headers: Headers
  context: { pageEditorSave: true }
}

type NavRow = {
  type?: string | null
  page?: unknown
  anchor?: string | null
  url?: string | null
  label?: string | null
  external?: boolean | null
}

export class PageSaveConflictError extends Error {
  readonly code = PAGE_EDITOR_SAVE_CONFLICT_CODE

  constructor(
    message: string,
    readonly expectedUpdatedAt: string,
    readonly actualUpdatedAt: string,
  ) {
    super(message)
    this.name = "PageSaveConflictError"
  }
}

const payloadReq = (req: PageEditorTransactionReq): PayloadRequest => req as unknown as PayloadRequest

export const userCanEditTenantPages = (user: User, tenantId: string): boolean => {
  if (user.role === "super-admin") return true
  if (user.role !== "owner" && user.role !== "editor") return false
  return relationshipIdSet((user.tenants ?? []).map((entry) => entry.tenant)).has(tenantId)
}

export const userCanEditSiteDesign = (user: User): boolean =>
  user.role === "owner" || user.role === "super-admin"

const plainNavRow = (row: NavRow): NavRow => ({
  type: row.type,
  page: navEntryPageId(row.page),
  anchor: row.anchor ?? null,
  url: row.url ?? null,
  label: row.label ?? null,
  external: Boolean(row.external),
})

const navRowsWithPage = (
  rows: NavRow[],
  pageId: string | number,
  included: boolean,
): NavRow[] => {
  const id = Number(pageId)
  const withoutPage = rows.map(plainNavRow).filter((row) => !(row.type === "page" && row.page === id))
  return included
    ? [...withoutPage, { type: "page", page: id, anchor: null, url: null, label: null, external: false }]
    : withoutPage
}

export async function assertPageRevisionFresh(
  payload: Payload,
  page: Pick<PageEditorPageSection, "id" | "expectedUpdatedAt">,
  tenantId: string,
  user: User,
): Promise<void> {
  if (page.id == null || page.expectedUpdatedAt == null) return

  const existing = await payload.findByID({
    collection: "pages",
    id: page.id,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const existingTenantId = relationshipId(existing.tenant)
  if (existingTenantId == null || existingTenantId !== tenantId) {
    throw new Error("Forbidden: page tenant mismatch")
  }
  if (existing.updatedAt !== page.expectedUpdatedAt) {
    throw new PageSaveConflictError(
      "Page was updated elsewhere; reload and try again.",
      page.expectedUpdatedAt,
      existing.updatedAt,
    )
  }
}

export async function persistPageDocument(
  payload: Payload,
  options: {
    tenantId: string
    page: PageEditorPageSection
    user: User
    req: PageEditorTransactionReq
  },
): Promise<Page> {
  const pageArgs = {
    collection: "pages" as const,
    data: { ...options.page.data, tenant: Number(options.tenantId) } as Page,
    depth: 2 as const,
    user: options.user,
    overrideAccess: false as const,
    req: payloadReq(options.req),
  }

  if (options.page.id == null) {
    return payload.create(pageArgs)
  }
  await payload.update({ ...pageArgs, id: options.page.id })
  const savedPage = await payload.findByID({
    collection: "pages",
    id: options.page.id,
    depth: 2,
    user: options.user,
    overrideAccess: false,
    req: payloadReq(options.req),
  })
  const savedTenantId = relationshipValue(savedPage.tenant)
  if (savedTenantId == null || relationshipId(savedTenantId) !== options.tenantId) {
    throw new Error("Saved page tenant mismatch")
  }
  return savedPage
}

export async function persistSiteDesign(
  payload: Payload,
  options: {
    tenantId: string
    siteDesign: PageEditorSiteDesignSection
    savedPageId: string | number
    user: User
    req: PageEditorTransactionReq
  },
): Promise<{ theme?: ThemeTokens }> {
  const { siteDesign, tenantId, savedPageId, user, req } = options
  let savedTheme: ThemeTokens | undefined

  if (siteDesign.theme != null) {
    await payload.update({
      collection: "tenants",
      id: tenantId,
      data: { theme: siteDesign.theme },
      depth: 0,
      overrideAccess: true,
      req: payloadReq(req),
    })
    savedTheme = siteDesign.theme
  }

  if (siteDesign.navigation != null || siteDesign.chrome != null) {
    const found = await payload.find({
      collection: "site-settings",
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
      req: payloadReq(req),
    })
    const settings = found.docs[0] as SiteSetting | undefined
    if (!settings) throw new Error("Site settings are unavailable for this tenant")

    const data: Record<string, unknown> = {}
    if (siteDesign.chrome != null) data.chrome = siteDesign.chrome
    if (siteDesign.navigation != null) {
      const headerRows = (settings.navHeader ?? []) as NavRow[]
      const footerRows = (settings.navFooter ?? []) as NavRow[]
      data.navHeader = navRowsWithPage(headerRows, savedPageId, siteDesign.navigation.inHeader)
      data.navFooter = navRowsWithPage(footerRows, savedPageId, siteDesign.navigation.inFooter)
    }

    await payload.update({
      collection: "site-settings",
      id: settings.id,
      data,
      depth: 0,
      user,
      overrideAccess: false,
      req: payloadReq(req),
    })
  }

  return { theme: savedTheme }
}

export async function publishTenantSnapshot(
  payload: Payload,
  options: {
    tenantId: string | number
    pageId: string | number
    user: User
    req: PageEditorTransactionReq
  },
) {
  return publishCurrentTenantState(payload, {
    tenantId: options.tenantId,
    user: options.user,
    reason: `page editor save for page ${String(options.pageId)}`,
    req: payloadReq(options.req),
  })
}
