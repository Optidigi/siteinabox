import "server-only"
import type { Page as ContractPage, SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"
import type { Tenant } from "@/payload-types"
import { asRecord } from "@/lib/record"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { sameRelationshipId } from "@/lib/relationshipId"
import { normalizePreviewThemeForSave } from "@/lib/theme/normalizeTheme"
import { themeSchema, type ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
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
  tenant: Pick<Tenant, "id" | "name" | "slug" | "domain">
  pages: PreviewPageSummary[]
  currentPage: ContractPage
  settings: SiteSettings
  manifest: RtManifest
  theme: ThemeTokens | null
  rendererTheme: ThemeTokenSpec | null
  approval: PreviewApprovalState | null
  payment: PreviewPaymentState | null
}

export type PreviewCustomizerAccess = { type: "grant"; clientSlug: string }

const tenantAnalyticsContext = (tenant: Pick<Tenant, "id" | "slug" | "domain" | "siteManifest">) => {
  const manifest = asRecord(tenant.siteManifest)
  const manifestVersion = manifest?.version
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug ?? null,
    siteDomain: tenant.domain ?? null,
    themeId: typeof manifest?.themeId === "string" ? manifest.themeId : null,
    siteBuildId: process.env.SIAB_SITE_BUILD_ID ?? null,
    manifestVersion:
      typeof manifestVersion === "string" || typeof manifestVersion === "number" ? manifestVersion : null,
    analyticsConsent: asRecord(manifest?.analyticsConsent),
  }
}

const pagePathMatches = (page: { id: string | number; slug?: string | null }, requestedPage: string | null | undefined): boolean => {
  if (!requestedPage) return false
  const normalizedPage = requestedPage.replace(/^\/+|\/+$/g, "") || "index"
  return String(page.slug) === normalizedPage || String(page.id) === requestedPage
}

const defaultPageForGrant = <T extends { slug?: string | null }>(pages: T[]): T | undefined =>
  pages.find((page) => page.slug === "index") ??
  pages.find((page) => page.slug === "home") ??
  pages[0]

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

  const settingsDoc = await getOrCreateSiteSettings(tenant.id)
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
    id: tenant.id,
    data: { theme: normalized },
    overrideAccess: true,
    depth: 0,
  })
  return normalized
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
    data: { clientApproval: approval, payment },
    overrideAccess: true,
    depth: 0,
  })

  return { approval, payment }
}
