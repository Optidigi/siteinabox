import "server-only"
import { getPayload, type Payload } from "payload"
import type { Page as ContractPage, SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"
import config from "@/payload.config"
import type { Page, SiteGenerationRun, Tenant } from "@/payload-types"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { sameRelationshipId } from "@/lib/relationshipId"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { normalizePreviewThemeForSave } from "@/lib/theme/normalizeTheme"
import { themeSchema, type ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { verifyPreviewToken, type PreviewClaims } from "@/lib/preview/sign"
import { loadPreviewGrantContext } from "@/lib/preview/previewAccess"
import { DEFAULT_MANIFEST } from "@/lib/richText/loadManifest"
import { manifestSchema, type RtManifest } from "@/lib/richText/manifest"
import {
  createPendingProviderPaymentState,
  isActivationPaymentSatisfied,
  normalizeGenerationRunPaymentState,
  type GenerationRunPaymentState,
} from "@/lib/payments/generationRunPayment"

export type PreviewPageSummary = {
  id: number | string
  slug: string
  title: string
}

export type PreviewApprovalState = {
  status?: "pending" | "approved"
  approvedAt?: string
}

export type PreviewPaymentState = Partial<GenerationRunPaymentState>

export type PreviewCustomizerData = {
  access: PreviewCustomizerAccess
  token?: string
  tokenExp?: number
  tenant: Pick<Tenant, "id" | "name" | "slug" | "domain">
  pages: PreviewPageSummary[]
  currentPage: ContractPage
  settings: SiteSettings
  manifest: RtManifest
  theme: ThemeTokens | null
  rendererTheme: ThemeTokenSpec | null
  tenantCss: string | null
  approval: PreviewApprovalState | null
  payment: PreviewPaymentState | null
}

export type PreviewCustomizerAccess =
  | { type: "grant"; clientSlug: string }
  | { type: "legacy-token"; token: string; exp: number }

const requireClaims = (token: string): PreviewClaims & { exp: number } =>
  verifyPreviewToken(token, process.env.PREVIEW_HMAC_SECRET)

const isDraftPreviewPageId = (pageId: number | string): boolean =>
  typeof pageId === "string" && pageId.startsWith("draft-")

const tenantAnalyticsContext = (tenant: Pick<Tenant, "id" | "slug" | "domain" | "siteManifest">) => {
  const manifest = tenant.siteManifest as Record<string, any> | null | undefined
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug ?? null,
    siteDomain: tenant.domain ?? null,
    analyticsConsent: manifest?.analyticsConsent ?? null,
  }
}

const findTenantPages = async (payload: Payload, tenantId: string | number): Promise<Page[]> => {
  const result = await payload.find({
    collection: "pages",
    where: { tenant: { equals: tenantId } },
    sort: "slug",
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })
  return result.docs as Page[]
}

const pagePathMatches = (page: Page, requestedPage: string | null | undefined): boolean => {
  if (!requestedPage) return false
  const normalizedPage = requestedPage.replace(/^\/+|\/+$/g, "") || "index"
  return String(page.slug) === normalizedPage || String(page.id) === requestedPage
}

const defaultPage = (pages: Page[], claimedPageId: string | number): Page | undefined =>
  pages.find((page) => sameRelationshipId(page.id, claimedPageId)) ??
  pages.find((page) => page.slug === "index") ??
  pages.find((page) => page.slug === "home") ??
  pages[0]

const defaultPageForGrant = (pages: Page[]): Page | undefined =>
  pages.find((page) => page.slug === "index") ??
  pages.find((page) => page.slug === "home") ??
  pages[0]

const relationshipContainsId = (items: unknown, id: string | number): boolean =>
  Array.isArray(items) && items.some((item) => sameRelationshipId(item, id))

const latestRunForTenant = async (payload: Payload, tenantId: string | number): Promise<SiteGenerationRun | null> => {
  const result = await payload.find({
    collection: "site-generation-runs",
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: "preview_ready" } },
      ],
    },
    sort: "-updatedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as SiteGenerationRun | undefined) ?? null
}

async function loadPreviewContext(token: string): Promise<{
  claims: PreviewClaims & { exp: number }
  payload: Payload
  tenant: Tenant
  pages: Page[]
  claimedPage: Page | null
}> {
  const claims = requireClaims(token)
  const payload = await getPayload({ config })
  let tenant: Tenant | null = null
  try {
    tenant = await payload.findByID({
      collection: "tenants",
      id: claims.tenantId as any,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  } catch {
    tenant = null
  }
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Preview tenant is not available")
  }

  const pages = await findTenantPages(payload, tenant.id)
  const claimedPage = pages.find((page) => sameRelationshipId(page.id, claims.pageId)) ?? null
  if (!isDraftPreviewPageId(claims.pageId) && !claimedPage) {
    throw new Error("Preview page is not available")
  }

  return { claims, payload, tenant, pages, claimedPage }
}

export async function getPreviewCustomizerData(
  token: string,
  requestedPage?: string | null,
): Promise<PreviewCustomizerData> {
  const { claims, payload, tenant, pages: allPages, claimedPage } = await loadPreviewContext(token)

  const [pages, settingsDoc, tenantCss, run] = await Promise.all([
    Promise.resolve(allPages),
    getOrCreateSiteSettings(tenant.id),
    loadTenantCss(tenant.id),
    latestRunForTenant(payload, tenant.id),
  ])
  const requestedSelection = requestedPage ? pages.find((page) => pagePathMatches(page, requestedPage)) : null
  if (requestedPage && !requestedSelection) {
    throw new Error("Preview page is not available")
  }
  const selected = requestedSelection ?? claimedPage ?? defaultPage(pages, claims.pageId)
  if (!selected || !sameRelationshipId(selected.tenant, tenant.id)) {
    throw new Error("Preview page is not available")
  }

  const navPages = pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
  }))
  const analyticsContext = tenantAnalyticsContext(tenant)
  const currentPage = pageToJson(selected, analyticsContext) as ContractPage
  const settings = settingsToJson(settingsDoc, navPages, analyticsContext) as SiteSettings
  const theme = normalizePreviewThemeForSave((tenant.theme as ThemeTokens | null | undefined) ?? null)
  const parsedManifest = manifestSchema.safeParse(tenant.siteManifest)
  const manifest = parsedManifest.success ? parsedManifest.data : DEFAULT_MANIFEST

  return {
    access: { type: "legacy-token", token, exp: claims.exp },
    token,
    tokenExp: claims.exp,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
    },
    pages: navPages,
    currentPage,
    settings,
    manifest,
    theme,
    rendererTheme: normalizeThemeForSave(theme),
    tenantCss,
    approval: (run?.clientApproval as PreviewApprovalState | null | undefined) ?? null,
    payment: (run?.payment as PreviewPaymentState | null | undefined) ?? null,
  }
}

export async function getPreviewCustomizerDataForGrant(input: {
  clientSlug: string
  customerEmail: string
  requestedPage?: string | null
}): Promise<PreviewCustomizerData> {
  const {
    clientSlug,
    payload,
    tenant,
    run,
    pages,
  } = await loadPreviewGrantContext({
    clientSlug: input.clientSlug,
    email: input.customerEmail,
    pageSlug: input.requestedPage,
  })

  const [settingsDoc, tenantCss] = await Promise.all([
    getOrCreateSiteSettings(tenant.id),
    loadTenantCss(tenant.id),
  ])
  const requestedSelection = input.requestedPage ? pages.find((page) => pagePathMatches(page, input.requestedPage)) : null
  const selected = requestedSelection ?? defaultPageForGrant(pages)
  if (!selected || !sameRelationshipId(selected.tenant, tenant.id)) {
    throw new Error("Preview page is not available")
  }

  const navPages = pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
  }))
  const analyticsContext = tenantAnalyticsContext(tenant)
  const currentPage = pageToJson(selected, analyticsContext) as ContractPage
  const settings = settingsToJson(settingsDoc, navPages, analyticsContext) as SiteSettings
  const theme = normalizePreviewThemeForSave((tenant.theme as ThemeTokens | null | undefined) ?? null)
  const parsedManifest = manifestSchema.safeParse(tenant.siteManifest)
  const manifest = parsedManifest.success ? parsedManifest.data : DEFAULT_MANIFEST

  return {
    access: { type: "grant", clientSlug },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
    },
    pages: navPages,
    currentPage,
    settings,
    manifest,
    theme,
    rendererTheme: normalizeThemeForSave(theme),
    tenantCss,
    approval: (run.clientApproval as PreviewApprovalState | null | undefined) ?? null,
    payment: (run.payment as PreviewPaymentState | null | undefined) ?? null,
  }
}

export async function persistPreviewThemeForGrant(input: {
  clientSlug: string
  customerEmail: string
  theme: ThemeTokens
}): Promise<ThemeTokens | null> {
  const { payload, tenant } = await loadPreviewGrantContext({
    clientSlug: input.clientSlug,
    email: input.customerEmail,
  })
  const parsed = themeSchema.safeParse(input.theme)
  if (!parsed.success) {
    throw new Error(`Invalid theme data: ${parsed.error.message}`)
  }
  const normalized = normalizePreviewThemeForSave(parsed.data)
  await payload.update({
    collection: "tenants",
    id: tenant.id as any,
    data: { theme: normalized } as any,
    overrideAccess: true,
    depth: 0,
  })
  return normalized
}

export async function persistPreviewTheme(token: string, theme: ThemeTokens): Promise<ThemeTokens | null> {
  const { payload, tenant } = await loadPreviewContext(token)
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) {
    throw new Error(`Invalid theme data: ${parsed.error.message}`)
  }
  const normalized = normalizePreviewThemeForSave(parsed.data)
  await payload.update({
    collection: "tenants",
    id: tenant.id as any,
    data: { theme: normalized } as any,
    overrideAccess: true,
    depth: 0,
  })
  return normalized
}

export async function approvePreview(token: string): Promise<{
  approval: PreviewApprovalState
  payment: PreviewPaymentState
}> {
  const { claims, payload, tenant } = await loadPreviewContext(token)
  if (isDraftPreviewPageId(claims.pageId)) {
    throw new Error("Preview approval requires a persisted generation page")
  }

  const run = await latestRunForTenant(payload, tenant.id)
  if (!run) {
    throw new Error("No preview-ready generation run found for this tenant")
  }
  if (!relationshipContainsId(run.pages, claims.pageId)) {
    throw new Error("Preview generation run does not include this page")
  }

  const now = new Date().toISOString()
  const approval: PreviewApprovalState = { status: "approved", approvedAt: now }
  const currentPayment = normalizeGenerationRunPaymentState(run.payment)
  const payment: PreviewPaymentState = isActivationPaymentSatisfied(currentPayment)
    ? currentPayment
    : createPendingProviderPaymentState(now)

  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { clientApproval: approval, payment } as any,
    overrideAccess: true,
    depth: 0,
  })

  return { approval, payment }
}

export async function approvePreviewForGrant(input: {
  clientSlug: string
  customerEmail: string
}): Promise<{
  approval: PreviewApprovalState
  payment: PreviewPaymentState
}> {
  const { payload, run } = await loadPreviewGrantContext({
    clientSlug: input.clientSlug,
    email: input.customerEmail,
  })

  const now = new Date().toISOString()
  const approval: PreviewApprovalState = { status: "approved", approvedAt: now }
  const currentPayment = normalizeGenerationRunPaymentState(run.payment)
  const payment: PreviewPaymentState = isActivationPaymentSatisfied(currentPayment)
    ? currentPayment
    : createPendingProviderPaymentState(now)

  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { clientApproval: approval, payment } as any,
    overrideAccess: true,
    depth: 0,
  })

  return { approval, payment }
}
