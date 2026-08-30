import { resolveNav, type NavPage } from "@/lib/projection/resolveNav"
import { normalizeFooterColumns } from "@/lib/footerComposition"
import { isSafeHref } from "@/lib/security/safeHref"
import { mediaToJson } from "@/lib/projection/media"
import { materializeTenantPrivacyDisclosureValue } from "@/lib/legal/tenantPrivacyPage"
import {
  DEFAULT_CLIENT_SETTINGS_CONTRACT,
  type SettingsContract,
} from "@/lib/settingsContract"
import {
  DEFAULT_FOOTER_VARIANT,
  DEFAULT_CONSENT_VARIANT,
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
  TenantPrivacyDisclosureSchema,
} from "@siteinabox/contracts"
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

const announcementToJson = (announcement: unknown) => {
  const record = asRecord(announcement)
  if (!record?.visible) return undefined
  const link = linkRefToJson(record.link)
  if (!isNonEmptyString(record.title) && !isNonEmptyString(record.message) && !link) return undefined
  return {
    visible: true,
    title: record.title,
    message: record.message,
    link,
    dismissible: record.dismissible,
  }
}

const privacyDisclosureToJson = (value: unknown) => {
  const record = asRecord(value)
  if (!record || record.enabled !== true) return undefined
  const controller = asRecord(record.controller)
  if (!controller) return undefined
  const parsed = TenantPrivacyDisclosureSchema.safeParse({
    enabled: true,
    mode: record.mode === "custom" ? "custom" : "template",
    title: isNonEmptyString(record.title) ? record.title : "Privacy- en cookieverklaring",
    body: record.body ?? undefined,
    version: isNonEmptyString(record.version) ? record.version : "tenant-privacy-owned-2026-08-13.1",
    effectiveAt: isNonEmptyString(record.effectiveAt) ? record.effectiveAt : "2026-07-10T00:00:00.000Z",
    controller: {
      legalName: controller.legalName,
      tradeName: controller.tradeName,
      email: controller.email,
      privacyEmail: controller.privacyEmail,
      kvkNumber: controller.kvkNumber,
      address: controller.address,
    },
    contactMethods: record.contactMethods,
    marketingTechnologies: record.marketingTechnologies,
    additionalProcessors: record.additionalProcessors,
  })
  if (!parsed.success) return undefined
  return materializeTenantPrivacyDisclosureValue(parsed.data)
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
      navbar: doc.chrome.navbar ? {
        variant: doc.chrome.navbar.variant ?? DEFAULT_NAVBAR_VARIANT,
        placement: doc.chrome.navbar.placement ?? DEFAULT_NAVBAR_PLACEMENT,
        logo: mediaToJson(doc.chrome.navbar.logo),
        activeMode: doc.chrome.navbar.activeMode,
        mobileMenu: doc.chrome.navbar.mobileMenu,
        showThemeToggle: doc.chrome.navbar.showThemeToggle,
        cta: linkRefToJson(doc.chrome.navbar.cta),
      } : undefined,
      footer: doc.chrome.footer ? {
        variant: doc.chrome.footer.variant ?? DEFAULT_FOOTER_VARIANT,
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
      announcement: announcementToJson(doc.chrome.announcement)
    } : undefined,
    consent: doc.consent ? {
      variant: doc.consent.variant ?? DEFAULT_CONSENT_VARIANT,
      visible: !!doc.consent.visible,
      title: doc.consent.title,
      message: doc.consent.message,
      acceptLabel: doc.consent.acceptLabel,
      allowSelectionLabel: doc.consent.allowSelectionLabel,
      rejectLabel: doc.consent.rejectLabel,
      necessaryLabel: doc.consent.necessaryLabel,
      preferencesLabel: doc.consent.preferencesLabel,
      statisticsLabel: doc.consent.statisticsLabel,
      marketingLabel: doc.consent.marketingLabel,
      privacyLink: linkRefToJson(doc.consent.privacyLink),
    } : undefined,
    systemTemplates: doc.systemTemplates?.notFound ? {
      notFound: {
        heading: doc.systemTemplates.notFound.heading,
        body: doc.systemTemplates.notFound.body,
        primaryAction: linkRefToJson(doc.systemTemplates.notFound.primaryAction),
      },
    } : undefined,
    maintenance: contract.operations.maintenance && doc.maintenance ? {
      enabled: !!doc.maintenance.enabled,
      message: doc.maintenance.message,
    } : undefined,
    privacyDisclosure: privacyDisclosureToJson(doc.privacyDisclosure),
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
    navigation: {
      primary: resolveNav(doc.navigation?.primary, publishedPages),
      footer: resolveNav(doc.navigation?.footer, publishedPages),
    },
  }
}
