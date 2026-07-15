export type SiteSettingDisposition = {
  path: string
  disposition: "rendered" | "runtime" | "seo" | "publishing" | "consent" | "tenant-only"
  consumer: string
}

/**
 * Canonical audit of persisted/public SiteSettings leaves. A setting may be
 * inactive for a tenant through its settings manifest, but it may never be
 * silently orphaned. Tests keep paths unique and verify the critical chrome
 * contract against the provider capability inventory.
 */
export const SITE_SETTING_DISPOSITIONS = [
  { path: "siteName", disposition: "rendered", consumer: "provider chrome, metadata and structured data" },
  { path: "siteUrl", disposition: "seo", consumer: "canonical URLs and snapshot host" },
  { path: "description", disposition: "seo", consumer: "metadata, footer brand composition and generator context" },
  { path: "language", disposition: "runtime", consumer: "document language and localized runtime" },
  { path: "aliases[].host", disposition: "publishing", consumer: "tenant host routing" },
  { path: "contactEmail", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "branding.logo", disposition: "rendered", consumer: "provider header/footer media adapter" },
  { path: "branding.favicon", disposition: "seo", consumer: "renderer document metadata" },
  { path: "branding.primaryColor", disposition: "runtime", consumer: "existing scoped token bridge" },
  { path: "chrome.header.variant", disposition: "runtime", consumer: "fail-closed provider chrome registry" },
  { path: "chrome.header.logo", disposition: "rendered", consumer: "provider navbar logo slot" },
  { path: "chrome.header.behavior", disposition: "runtime", consumer: "static/sticky provider header wrapper" },
  { path: "chrome.header.activeMode", disposition: "runtime", consumer: "path/anchor/none navigation matching" },
  { path: "chrome.header.mobileMenu", disposition: "runtime", consumer: "provider mobile navigation interaction and layout" },
  { path: "chrome.header.cta", disposition: "rendered", consumer: "provider primary action slot" },
  { path: "chrome.header.secondaryAction", disposition: "rendered", consumer: "capability-gated provider secondary action slot" },
  { path: "chrome.header.search", disposition: "rendered", consumer: "capability-gated GET search form" },
  { path: "chrome.footer.variant", disposition: "runtime", consumer: "fail-closed provider chrome registry" },
  { path: "chrome.footer.logo", disposition: "rendered", consumer: "provider footer logo slot" },
  { path: "chrome.footer.tagline", disposition: "rendered", consumer: "provider footer brand copy" },
  { path: "chrome.footer.copyright", disposition: "rendered", consumer: "provider footer copyright slot" },
  { path: "chrome.footer.legalLinks", disposition: "rendered", consumer: "provider footer utility links" },
  { path: "chrome.footer.columns", disposition: "rendered", consumer: "provider footer structured column composition" },
  { path: "chrome.footer.newsletter", disposition: "rendered", consumer: "capability-gated provider newsletter form" },
  { path: "chrome.banner", disposition: "rendered", consumer: "approved announcement/cookie banner adapter" },
  { path: "maintenance", disposition: "runtime", consumer: "maintenance status banner" },
  { path: "contact.phone", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "contact.address", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "contact.social", disposition: "rendered", consumer: "provider footer social region" },
  { path: "nap", disposition: "seo", consumer: "business footer composition and local-business structured data" },
  { path: "hours", disposition: "seo", consumer: "business details and local-business structured data" },
  { path: "serviceArea", disposition: "seo", consumer: "business footer composition and local-business structured data" },
  { path: "navHeader", disposition: "rendered", consumer: "capability-gated provider navbar navigation" },
  { path: "navFooter", disposition: "rendered", consumer: "provider footer navigation and utility regions" },
  { path: "analytics", disposition: "runtime", consumer: "renderer analytics initialization" },
  { path: "analyticsConsent", disposition: "consent", consumer: "renderer analytics consent gate" },
  { path: "privacyDisclosure", disposition: "consent", consumer: "generated tenant privacy page" },
  { path: "seoJsonLd", disposition: "seo", consumer: "renderer JSON-LD output" },
  { path: "updatedAt", disposition: "publishing", consumer: "snapshot freshness and cache metadata" },
] as const satisfies readonly SiteSettingDisposition[]
