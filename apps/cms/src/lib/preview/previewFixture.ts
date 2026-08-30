import type { HeroBlock, MediaRef, NavbarVariant, NavLink, Page, SiteSettings } from "@siteinabox/contracts"
import {
  v1FixturePage,
  v1FixtureSettings,
  v1FixtureTheme,
} from "@siteinabox/site-renderer"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import type { PreviewCustomizerData } from "@/lib/preview/customizer"
import { DEFAULT_MANIFEST } from "@/lib/richText/loadManifest"

export const PREVIEW_FIXTURE_CLIENT_SLUG = "sitegen-review"
export const AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG = "amicare-review"

export function isPreviewFixtureMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SIAB_PREVIEW_FIXTURE_MODE === "1"
}

export function isPreviewFixtureRoute(clientSlug: string): boolean {
  const normalizedClientSlug = clientSlug.trim().toLowerCase()
  return isPreviewFixtureMode() && (
    normalizedClientSlug === PREVIEW_FIXTURE_CLIENT_SLUG
    || normalizedClientSlug === AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG
  )
}

const fixtureBlocks: Page["blocks"] = v1FixturePage.blocks.map((block) => {
  const anchor = block.blockType

  if (block.blockType === "hero") {
    return { ...block, anchor }
  }

  if (block.blockType === "work") {
    return {
      ...block,
      projects: block.projects.map((project, index) => ({
        ...project,
        media: [`/fixture-media/${index === 0 ? "project-kitchen" : "project-office"}.webp`],
      })),
      anchor,
    }
  }

  return { ...block, anchor }
})

const fixtureSettings: SiteSettings = {
  ...v1FixtureSettings,
  chrome: {
    ...v1FixtureSettings.chrome,
    navbar: v1FixtureSettings.chrome?.navbar
      ? { ...v1FixtureSettings.chrome.navbar, placement: "sticky" }
      : null,
  },
  siteUrl: "http://localhost:3000/sitegen-review",
  navigation: {
    primary: [
      { label: "Hero 01", href: "/hero-01" },
      { label: "Hero 02", href: "/hero-02" },
      { label: "Hero 03", href: "/hero-03" },
      {
        label: "Meer",
        description: "Vergelijk ook de twee aanvullende hero-composities.",
        children: [
          { label: "Hero 04", href: "/hero-04" },
          { label: "Hero 05", href: "/hero-05" },
        ],
      },
    ] satisfies NavLink[],
    footer: [
      { label: "Hero 01", href: "/hero-01" },
      { label: "Hero 02", href: "/hero-02" },
      { label: "Hero 03", href: "/hero-03" },
      { label: "Hero 04", href: "/hero-04" },
      { label: "Hero 05", href: "/hero-05" },
    ] satisfies NavLink[],
  },
}

const fixtureHeroPages = [
  { variant: "hero-01", title: "Hero 01 — Lead", navbar: "navbar-01" },
  { variant: "hero-02", title: "Hero 02 — Service panel", navbar: "navbar-02" },
  { variant: "hero-03", title: "Hero 03 — Angled", navbar: "navbar-03" },
  { variant: "hero-04", title: "Hero 04 — Framed", navbar: null },
  { variant: "hero-05", title: "Hero 05 — Pattern split", navbar: null },
] as const

type FixtureHeroVariant = (typeof fixtureHeroPages)[number]["variant"]

const fixtureServices = fixtureBlocks.find((candidate) => candidate.blockType === "services")
if (!fixtureServices) throw new Error("The sitegen review fixture requires a services block for the Hero 01 review page.")
const fixtureCta = fixtureBlocks.find((candidate) => candidate.blockType === "cta")
if (!fixtureCta) throw new Error("The sitegen review fixture requires a CTA block for the Hero 01 review page.")
const fixtureCta02 = {
  ...fixtureCta,
  variant: "cta-02" as const,
  heading: "Een volgende stap begint met duidelijkheid",
  body: "Vertel kort waar je hulp bij zoekt en ontdek wat een passende aanpak kan zijn.",
  secondaryAction: { label: "Bekijk de diensten", href: "#services" },
  anchor: "cta-02",
}
const fixtureServices02 = {
  ...fixtureServices,
  variant: "services-02" as const,
  anchor: "services-02",
}

const fixturePageFor = (variant: FixtureHeroVariant): Page => {
  const block = fixtureBlocks.find(
    (candidate) => candidate.blockType === "hero" && candidate.variant === variant,
  )
  if (!block) throw new Error(`Missing ${variant} block in the sitegen review fixture.`)

  const pageConfig = fixtureHeroPages.find((candidate) => candidate.variant === variant)
  if (!pageConfig) throw new Error(`Missing page configuration for ${variant}.`)

  return {
    ...v1FixturePage,
    id: `sitegen-review-${variant}`,
    slug: variant,
    title: pageConfig.title,
    blocks: variant === "hero-01" ? [block, fixtureServices, fixtureCta02, fixtureCta, fixtureServices02] : [block],
  }
}

const fixturePages = fixtureHeroPages.map(({ variant }) => fixturePageFor(variant))
const fixtureNavbarCandidate = fixtureSettings.chrome?.navbar
if (!fixtureNavbarCandidate) throw new Error("The sitegen review fixture requires a base navbar.")
const fixtureNavbar: NonNullable<NonNullable<SiteSettings["chrome"]>["navbar"]> = fixtureNavbarCandidate

function settingsForFixturePage(navbarVariant: NavbarVariant | null): SiteSettings {
  if (!navbarVariant) {
    return {
      ...fixtureSettings,
      chrome: { ...fixtureSettings.chrome, navbar: null },
      navigation: null,
    }
  }

  return {
    ...fixtureSettings,
    chrome: {
      ...fixtureSettings.chrome,
      navbar: { ...fixtureNavbar, variant: navbarVariant, activeMode: "path" },
    },
  }
}

type PreviewBlockMedia = Exclude<HeroBlock["image"], null | undefined>

const amicarePreviewMedia = (media: MediaRef | undefined): PreviewBlockMedia | null => {
  if (!media) return null
  if (typeof media === "string" || typeof media === "number") return media
  const filename = media.filename?.trim()
  const url = filename === "toys.jpg"
      ? "/fixture-media/amicare-toys.jpg"
    : filename === "bedroom.jpg"
      ? "/fixture-media/amicare-bedroom.jpg"
      : filename === "amicare-logo.svg"
        ? "/fixture-media/amicare-logo.svg"
      : filename === "amicare-favicon.svg"
        ? "/fixture-media/amicare-favicon.svg"
        : null
  return {
    id: media.id,
    url: url ?? media.url ?? undefined,
    // The renderer's production media resolver intentionally maps filenames
    // through the tenant-media boundary. Fixture assets are public static
    // files instead, so omitting the legacy filename keeps this explicit
    // local URL intact without weakening production media isolation.
    ...(url ? {} : { filename: media.filename ?? undefined }),
    alt: media.alt ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

const amicarePreviewPages: Page[] = amicarePublishedSiteSnapshot.pages.map((page) => ({
  ...page,
  updatedAt: page.updatedAt ?? "2026-08-13T00:00:00.000Z",
  blocks: page.blocks.map((block) => {
    if (block.blockType === "hero" || block.blockType === "cta") {
      return { ...block, image: amicarePreviewMedia(block.image ?? null) }
    }
    return block
  }),
}))

const amicarePreviewSettings: SiteSettings = {
  ...amicarePublishedSiteSnapshot.settings,
  siteUrl: "http://localhost:3000/amicare-review",
  branding: {
    ...amicarePublishedSiteSnapshot.settings.branding,
    logo: amicarePreviewMedia(amicarePublishedSiteSnapshot.settings.branding?.logo),
    favicon: amicarePreviewMedia(amicarePublishedSiteSnapshot.settings.branding?.favicon),
  },
}

function getAmicarePreviewFixtureData(requestedPage?: string | null): PreviewCustomizerData | null {
  const normalizedPage = requestedPage?.replace(/^\/+|\/+$/g, "") || "index"
  if (normalizedPage !== "index" && normalizedPage !== "home") return null
  const currentPage = amicarePreviewPages[0]
  if (!currentPage) return null

  return {
    access: { type: "grant", clientSlug: AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG },
    tenant: {
      id: 999998,
      name: amicarePreviewSettings.siteName,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: "localhost:3000",
    },
    pages: amicarePreviewPages.map((page) => ({ id: page.id ?? page.slug, slug: page.slug, title: page.title })),
    currentPage,
    settings: amicarePreviewSettings,
    manifest: DEFAULT_MANIFEST,
    theme: amicarePublishedSiteSnapshot.theme ?? null,
    rendererTheme: amicarePublishedSiteSnapshot.theme ?? null,
    consentAvailable: amicarePreviewSettings.consent?.visible !== false,
    approval: null,
    payment: null,
  }
}

export function getPreviewFixtureData(
  requestedPage?: string | null,
  clientSlug: string = PREVIEW_FIXTURE_CLIENT_SLUG,
): PreviewCustomizerData | null {
  if (clientSlug.trim().toLowerCase() === AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG) {
    return getAmicarePreviewFixtureData(requestedPage)
  }

  const normalizedPage = requestedPage?.replace(/^\/+|\/+$/g, "") || "index"
  const currentPage = normalizedPage === "index" || normalizedPage === "home"
    ? fixturePages[0]
    : fixturePages.find((page) => page.slug === normalizedPage || page.id === normalizedPage)
  if (!currentPage) return null

  const currentVariant = currentPage.blocks.find((block) => block.blockType === "hero")?.variant
  const pageConfig = fixtureHeroPages.find((candidate) => candidate.variant === currentVariant)
  if (!pageConfig) return null

  return {
    access: { type: "grant", clientSlug: PREVIEW_FIXTURE_CLIENT_SLUG },
    tenant: {
      id: 999999,
      name: fixtureSettings.siteName,
      slug: "fixture-tenant",
      domain: "localhost:3000",
    },
    pages: fixturePages.map((page) => ({ id: page.id ?? page.slug, slug: page.slug, title: page.title })),
    currentPage,
    settings: settingsForFixturePage(pageConfig.navbar),
    manifest: DEFAULT_MANIFEST,
    theme: v1FixtureTheme,
    rendererTheme: v1FixtureTheme,
    // Customer preview intentionally exposes the shared consent rail even
    // when this fixture has no public analytics configuration. The public
    // renderer remains gated by approved analytics; this is review-only UI.
    consentAvailable: true,
    approval: null,
    payment: null,
  }
}
