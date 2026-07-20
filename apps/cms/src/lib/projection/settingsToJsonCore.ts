import { resolveNav, type NavPage } from "@/lib/projection/resolveNav"
import { normalizeFooterColumns } from "@/lib/footerComposition"
import { isSafeHref } from "@/lib/security/safeHref"
import { mediaToJson } from "@/lib/projection/media"
import {
  DEFAULT_CLIENT_SETTINGS_CONTRACT,
  type SettingsContract,
} from "@/lib/settingsContract"
import type { SiteSetting } from "@/payload-types"
import { asRecord } from "@/lib/record"

export type SettingsProjectionContext = {
  settingsContract?: SettingsContract | null
}

const when = <T>(enabled: boolean, value: T): T | undefined => enabled ? value : undefined

const linkRefToJson = (link: unknown) => {
  const record = asRecord(link)
  if (!record || !isSafeHref(record.href)) return undefined
  return {
    label: record.label,
    href: record.href,
    external: !!record.external,
  }
}

const isNonEmptyString = (value: unknown) => typeof value === "string" && value.trim() !== ""

const bannerToJson = (banner: unknown) => {
  const record = asRecord(banner)
  if (!record?.visible) return undefined
  const link = linkRefToJson(record.link)
  if (!isNonEmptyString(record.title) && !isNonEmptyString(record.message) && !link) return undefined
  return {
    variant: record.variant,
    visible: true,
    title: record.title,
    message: record.message,
    link,
    dismissible: record.dismissible,
  }
}

/**
 * Client-safe SiteSettings projection core. It deliberately excludes analytics
 * env resolution so browser callers do not pull server/runtime config into the
 * canvas bundle.
 */
export function settingsToJsonWithoutAnalytics(
  doc: SiteSetting,
  publishedPages: NavPage[] = [],
  projectionContext: SettingsProjectionContext = {},
) {
  const contract = projectionContext.settingsContract ?? DEFAULT_CLIENT_SETTINGS_CONTRACT
  const contact = doc.contact
  const nap = doc.nap

  return {
    siteName: doc.siteName,
    siteUrl: doc.siteUrl,
    description: when(contract.general.description, doc.description),
    language: when(contract.general.language, doc.language),
    aliases: (doc.aliases ?? []).map((a) => ({ host: a.host })),
    contactEmail: when(contract.general.contactEmail, doc.contactEmail),
    branding: doc.branding ? {
      logo: when(contract.identity.branding.logo, mediaToJson(doc.branding.logo)),
      favicon: when(contract.identity.branding.favicon, mediaToJson(doc.branding.favicon)),
      primaryColor: doc.branding.primaryColor
    } : undefined,
    chrome: doc.chrome ? {
      header: doc.chrome.header ? {
        variant: doc.chrome.header.variant,
        logo: mediaToJson(doc.chrome.header.logo),
        behavior: doc.chrome.header.behavior,
        activeMode: doc.chrome.header.activeMode,
        mobileMenu: doc.chrome.header.mobileMenu,
        cta: linkRefToJson(doc.chrome.header.cta),
        secondaryAction: linkRefToJson(doc.chrome.header.secondaryAction),
        search: doc.chrome.header.search ? {
          enabled: !!doc.chrome.header.search.enabled,
          action: doc.chrome.header.search.action,
          placeholder: doc.chrome.header.search.placeholder,
        } : undefined,
      } : undefined,
      footer: doc.chrome.footer ? {
        variant: doc.chrome.footer.variant,
        logo: mediaToJson(doc.chrome.footer.logo),
        tagline: doc.chrome.footer.tagline,
        copyright: doc.chrome.footer.copyright,
        legalLinks: (doc.chrome.footer.legalLinks ?? []).map(linkRefToJson).filter(Boolean),
        columns: normalizeFooterColumns(doc.chrome.footer.columns),
        newsletter: doc.chrome.footer.newsletter ? {
          title: doc.chrome.footer.newsletter.title,
          placeholder: doc.chrome.footer.newsletter.placeholder,
          submitLabel: doc.chrome.footer.newsletter.submitLabel,
          action: doc.chrome.footer.newsletter.action,
          method: doc.chrome.footer.newsletter.method,
        } : undefined,
      } : undefined,
      banner: bannerToJson(doc.chrome.banner)
    } : undefined,
    systemTemplates: doc.systemTemplates?.notFound?.variant ? {
      notFound: { variant: doc.systemTemplates.notFound.variant },
    } : undefined,
    maintenance: contract.operations.maintenance && doc.maintenance ? {
      enabled: !!doc.maintenance.enabled,
      message: doc.maintenance.message,
      variant: doc.maintenance.variant,
    } : undefined,
    contact: contact && (
      contract.details.contact.phone ||
      contract.details.contact.address ||
      contract.details.contact.social
    ) ? {
      phone: when(contract.details.contact.phone, contact.phone),
      address: when(contract.details.contact.address, contact.address),
      social: contract.details.contact.social
        ? (contact.social ?? [])
        .filter((s) => isSafeHref(s.url))
        .map((s) => ({ platform: s.platform, url: s.url.trim() }))
        : undefined
    } : undefined,
    nap: nap && Object.values(contract.details.business).some(Boolean) ? {
      legalName: when(contract.details.business.legalName, nap.legalName),
      kvkNumber: when(contract.details.business.kvkNumber, nap.kvkNumber),
      establishmentNumber: when(contract.details.business.establishmentNumber, nap.establishmentNumber),
      streetAddress: when(contract.details.business.streetAddress, nap.streetAddress),
      city: when(contract.details.business.city, nap.city),
      region: when(contract.details.business.region, nap.region),
      postalCode: when(contract.details.business.postalCode, nap.postalCode),
      country: when(contract.details.business.country, nap.country)
    } : undefined,
    hours: contract.details.hours ? (doc.hours ?? []).map((h) => ({
      day: h.day,
      open: h.open,
      close: h.close,
      closed: !!h.closed
    })) : [],
    serviceArea: contract.details.serviceArea
      ? (doc.serviceArea ?? []).map((s) => ({ name: s.name }))
      : [],
    navHeader: resolveNav(doc.navHeader, publishedPages),
    navFooter: resolveNav(doc.navFooter, publishedPages),
  }
}
