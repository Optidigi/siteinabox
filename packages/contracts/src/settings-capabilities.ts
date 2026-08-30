export type SiteSettingDisposition = {
  path: string
  disposition: "rendered" | "runtime" | "seo" | "publishing" | "consent" | "tenant-only"
  consumer: string
}

/**
 * Canonical audit of persisted/public SiteSettings leaves. A setting may be
 * inactive for a tenant through its settings manifest, but it may never be
 * silently orphaned. Navbar, footer, and consent are the active numbered
 * chrome families; announcement remains reserved until its renderer exists.
 */
export const SITE_SETTING_DISPOSITIONS = [
  { path: "siteName", disposition: "rendered", consumer: "metadata, structured data and the shared navbar renderer" },
  { path: "siteUrl", disposition: "seo", consumer: "canonical URLs and snapshot host" },
  { path: "description", disposition: "seo", consumer: "metadata, footer brand composition and generator context" },
  { path: "language", disposition: "runtime", consumer: "document language and localized runtime" },
  { path: "aliases[].host", disposition: "publishing", consumer: "tenant host routing" },
  { path: "contactEmail", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "branding.logo", disposition: "rendered", consumer: "navbar fallback logo and renderer document metadata" },
  { path: "branding.favicon", disposition: "seo", consumer: "renderer document metadata" },
  { path: "branding.primaryColor", disposition: "runtime", consumer: "existing scoped token bridge" },
  { path: "chrome.navbar", disposition: "rendered", consumer: "shared SitePageShell navbar renderer and theme bridge" },
  { path: "chrome.footer", disposition: "rendered", consumer: "footer-01 brand, copyright and legal presentation" },
  { path: "chrome.announcement", disposition: "tenant-only", consumer: "reserved settings data until a numbered announcement design is added" },
  { path: "consent", disposition: "rendered", consumer: "shared consent rail labels; category enforcement remains runtime-owned" },
  { path: "systemTemplates.notFound", disposition: "tenant-only", consumer: "inline system recovery copy until a numbered system design is added" },
  { path: "maintenance", disposition: "tenant-only", consumer: "inline maintenance copy until a numbered system design is added" },
  { path: "contact.phone", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "contact.address", disposition: "rendered", consumer: "contact footer composition and structured data" },
  { path: "contact.social", disposition: "rendered", consumer: "owned footer social region" },
  { path: "nap", disposition: "seo", consumer: "business footer composition and local-business structured data" },
  { path: "hours", disposition: "seo", consumer: "business details and local-business structured data" },
  { path: "serviceArea", disposition: "seo", consumer: "business footer composition and local-business structured data" },
  { path: "navigation.primary", disposition: "rendered", consumer: "shared numbered navbar links and dropdown disclosures" },
  { path: "navigation.footer", disposition: "rendered", consumer: "footer-01 site-wide footer navigation" },
  { path: "analytics", disposition: "runtime", consumer: "renderer analytics initialization" },
  { path: "analyticsConsent", disposition: "consent", consumer: "renderer analytics consent gate" },
  { path: "privacyDisclosure", disposition: "rendered", consumer: "settings-owned legal document route when enabled" },
  { path: "seoJsonLd", disposition: "seo", consumer: "renderer JSON-LD output" },
  { path: "updatedAt", disposition: "publishing", consumer: "snapshot freshness and cache metadata" },
] as const satisfies readonly SiteSettingDisposition[]
