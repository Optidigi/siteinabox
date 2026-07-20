import type { SiteSetting } from "@/payload-types"
import type { FooterCompositionColumn, FooterCompositionContract } from "@/lib/footerComposition"
import {
  comparableFooterColumns,
  defaultFooterColumns,
  normalizeFooterColumns,
} from "@/lib/footerComposition"
import { settingsToJsonWithoutAnalytics } from "@/lib/projection/settingsToJsonCore"
import type { NavPage } from "@/lib/projection/resolveNav"
import type { SettingsContract } from "@/lib/settingsContract"
import { normalizeUploadId } from "@/lib/uploadValues"

export type SiteChromeDraft = {
  header: {
    variant?: unknown
    logo: unknown
    behavior?: unknown
    activeMode?: unknown
    mobileMenu?: unknown
    cta?: unknown
    secondaryAction?: unknown
    search?: unknown
  }
  footer: {
    variant?: unknown
    logo: unknown
    tagline: string | null
    copyright: string | null
    legalLinks?: unknown
    columns: FooterCompositionColumn[]
    newsletter?: unknown
  }
  banner?: unknown
}

export const chromeDraftFromSettings = (
  settings: SiteSetting | null | undefined,
  footerContract: FooterCompositionContract | null,
): SiteChromeDraft => ({
  header: {
    variant: settings?.chrome?.header?.variant ?? null,
    logo: settings?.chrome?.header?.logo ?? null,
    behavior: settings?.chrome?.header?.behavior ?? null,
    activeMode: settings?.chrome?.header?.activeMode ?? null,
    mobileMenu: settings?.chrome?.header?.mobileMenu ?? null,
    cta: settings?.chrome?.header?.cta ?? undefined,
    secondaryAction: settings?.chrome?.header?.secondaryAction ?? undefined,
    search: settings?.chrome?.header?.search ?? undefined,
  },
  footer: {
    variant: settings?.chrome?.footer?.variant ?? null,
    logo: settings?.chrome?.footer?.logo ?? null,
    tagline: settings?.chrome?.footer?.tagline ?? null,
    copyright: settings?.chrome?.footer?.copyright ?? null,
    legalLinks: settings?.chrome?.footer?.legalLinks ?? undefined,
    columns: defaultFooterColumns(settings, footerContract),
    newsletter: settings?.chrome?.footer?.newsletter ?? undefined,
  },
  banner: settings?.chrome?.banner ?? undefined,
})

export const chromeComparable = (
  draft: SiteChromeDraft,
  footerContract: FooterCompositionContract | null,
) => ({
  header: {
    variant: draft.header.variant ?? null,
    logo: normalizeUploadId(draft.header.logo) ?? null,
    behavior: draft.header.behavior ?? null,
    activeMode: draft.header.activeMode ?? null,
    mobileMenu: draft.header.mobileMenu ?? null,
    cta: draft.header.cta ?? null,
    secondaryAction: draft.header.secondaryAction ?? null,
    search: draft.header.search ?? null,
  },
  footer: {
    variant: draft.footer.variant ?? null,
    logo: normalizeUploadId(draft.footer.logo) ?? null,
    tagline: draft.footer.tagline ?? null,
    copyright: draft.footer.copyright ?? null,
    legalLinks: draft.footer.legalLinks ?? [],
    columns: comparableFooterColumns(draft.footer.columns, footerContract),
    newsletter: draft.footer.newsletter ?? null,
  },
  banner: draft.banner ?? null,
})

export const chromePatchFromDraft = (
  draft: SiteChromeDraft,
  footerContract: FooterCompositionContract | null,
) => ({
  header: {
    variant: draft.header.variant ?? null,
    logo: normalizeUploadId(draft.header.logo),
    behavior: draft.header.behavior ?? null,
    activeMode: draft.header.activeMode ?? null,
    mobileMenu: draft.header.mobileMenu ?? null,
    cta: draft.header.cta ?? undefined,
    secondaryAction: draft.header.secondaryAction ?? undefined,
    search: draft.header.search ?? undefined,
  },
  footer: {
    variant: draft.footer.variant ?? null,
    logo: normalizeUploadId(draft.footer.logo),
    tagline: draft.footer.tagline ?? null,
    copyright: draft.footer.copyright ?? null,
    legalLinks: draft.footer.legalLinks ?? undefined,
    columns: normalizeFooterColumns(draft.footer.columns, footerContract),
    newsletter: draft.footer.newsletter ?? undefined,
  },
  banner: draft.banner ?? undefined,
})

export const mergeChromeSettings = (settings: SiteSetting | null | undefined, draft: SiteChromeDraft) => ({
  ...(settings ?? {}),
  chrome: {
    ...(settings?.chrome ?? {}),
    header: {
      ...(settings?.chrome?.header ?? {}),
      variant: draft.header.variant,
      logo: draft.header.logo,
      behavior: draft.header.behavior,
      activeMode: draft.header.activeMode,
      mobileMenu: draft.header.mobileMenu,
      cta: draft.header.cta,
      secondaryAction: draft.header.secondaryAction,
      search: draft.header.search,
    },
    footer: {
      ...(settings?.chrome?.footer ?? {}),
      variant: draft.footer.variant,
      logo: draft.footer.logo,
      tagline: draft.footer.tagline,
      copyright: draft.footer.copyright,
      legalLinks: draft.footer.legalLinks,
      columns: draft.footer.columns,
      newsletter: draft.footer.newsletter,
    },
    banner: draft.banner,
  },
})

export const rendererSettingsFromChromeDraft = (
  settings: SiteSetting | null | undefined,
  draft: SiteChromeDraft,
  options: {
    publishedPages?: NavPage[]
    settingsContract?: SettingsContract | null
  } = {},
) => settings
  ? settingsToJsonWithoutAnalytics(
      mergeChromeSettings(settings, draft) as SiteSetting,
      options.publishedPages ?? [],
      { settingsContract: options.settingsContract ?? null },
    )
  : null
