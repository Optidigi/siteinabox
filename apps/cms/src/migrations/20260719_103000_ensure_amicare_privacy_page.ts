import { createHash } from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import type { Page, PublishedSiteSnapshot, SiteSetting, Tenant } from "@/payload-types"
import { asRecord, isRecord } from "@/lib/record"

const SLUG = "privacy-en-cookieverklaring"
const TITLE = "Privacy- en cookieverklaring"
const TEMPLATE_VERSION = "tenant-privacy-shadcnui-blocks-2026-07-18.1"

type LegalLink = { label?: string | null; href?: string | null }
type SnapshotPage = { slug?: string | null; id?: string | number | null; title?: string | null; status?: string | null; updatedAt?: string | null; seo?: unknown; blocks?: unknown }

const text = (value: string, marks?: string[]) => ({ t: "text", v: value, ...(marks ? { marks } : {}) })
const paragraph = (...children: unknown[]) => ({ t: "paragraph", children })
const heading = (value: string) => ({ t: "heading", level: 2, children: [text(value)] })
const list = (items: string[]) => ({
  t: "list",
  ordered: false,
  items: items.map((value) => ({ t: "listItem", children: [paragraph(text(value))] })),
})
const root = (children: unknown[]) => ({ t: "root", variant: "block", children })
const inline = (value: string) => ({ t: "root", variant: "inline", children: [text(value)] })

const privacyBlocks = () => [
  {
    blockType: "hero",
    designVariant: "shadcnui-blocks.hero-01",
    metadata: { source: "system", systemRole: "tenant-privacy", templateVersion: TEMPLATE_VERSION },
    eyebrow: inline("Privacy en cookies"),
    headline: inline(TITLE),
    subheadline: root([paragraph(text("Informatie over de verwerking van persoonsgegevens via Amicare-Zorg."))]),
  },
  {
    blockType: "contentSection",
    designVariant: "shadcnui-blocks.legal-content-01",
    metadata: { source: "system", systemRole: "tenant-privacy", templateVersion: TEMPLATE_VERSION },
    body: root([
      heading("1. Wie is verantwoordelijk?"),
      paragraph(text("Amicare-Zorg is verantwoordelijk voor de verwerking van persoonsgegevens via deze website.")),
      list([
        "Juridische naam: AMICARE ZORG",
        "Handelsnaam: Amicare-Zorg",
        "KvK-nummer: 99968347",
        "E-mail: info@ami-care.nl",
      ]),
      heading("2. Contact"),
      paragraph(text("Wanneer u per e-mail contact opneemt, verwerkt Amicare-Zorg de gegevens die u zelf verstrekt om uw vraag, aanvraag of afspraak af te handelen en misbruik te voorkomen.")),
      heading("3. Cookies en analytics"),
      paragraph(text("Noodzakelijke technieken kunnen worden gebruikt voor beveiliging en de werking van de website. Alleen met uw toestemming worden aanvullende interacties, sessie-informatie en conversies gemeten. U kunt die keuze via de cookiebanner maken of intrekken. Marketingtechnieken worden niet door de standaard Site in a Box-runtime geactiveerd.")),
      heading("4. Technische dienstverlening"),
      paragraph(text("Site in a Box levert de technische websiteomgeving. Optidigi, handelend onder de naam Site in a Box, verwerkt daarbij voor zover van toepassing persoonsgegevens in opdracht van Amicare-Zorg als verwerker.")),
      heading("5. Bewaring en beveiliging"),
      paragraph(text("Persoonsgegevens worden niet langer bewaard dan nodig voor het doel waarvoor ze zijn verzameld, tenzij een wettelijke bewaarplicht of gerechtvaardigd belang langere bewaring vereist. Er worden passende technische en organisatorische beveiligingsmaatregelen toegepast.")),
      heading("6. Uw rechten"),
      paragraph(
        text("U kunt binnen de wettelijke grenzen vragen om inzage, correctie, verwijdering, beperking of overdracht van uw persoonsgegevens, bezwaar maken of toestemming intrekken. Neem contact op via "),
        { t: "link", href: "mailto:info@ami-care.nl", rel: "external", children: [text("info@ami-care.nl")] },
        text(". U kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens."),
      ),
      heading("7. Versie en wijzigingen"),
      paragraph(text(`Versie ${TEMPLATE_VERSION}, geldig vanaf 2026-07-18. Deze verklaring kan worden aangepast wanneer de website, gebruikte diensten of wettelijke verplichtingen wijzigen.`)),
    ]),
  },
]

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const legalLinksFromFooter = (footer: unknown): LegalLink[] => {
  const record = asRecord(footer)
  const links = record?.legalLinks
  return Array.isArray(links) ? links.filter(isRecord).map((link) => link as LegalLink) : []
}

const withPrivacyLink = (footer: unknown) => {
  const legalLinks = legalLinksFromFooter(footer)
  const href = `/${SLUG}`
  return {
    ...(asRecord(footer) ?? {}),
    legalLinks: legalLinks.some((link) => link.href === href)
      ? legalLinks
      : [...legalLinks, { label: "Privacy en cookies", href }],
  }
}

const snapshotPagesFrom = (snapshot: PublishedSiteSnapshot["snapshot"]): SnapshotPage[] => {
  const record = asRecord(snapshot)
  const pages = record?.pages
  return Array.isArray(pages) ? pages.filter(isRecord).map((page) => page as SnapshotPage) : []
}

export async function ensureAmicarePrivacyPage(payload: MigrateUpArgs["payload"]): Promise<void> {
  const tenants = await payload.find({
    collection: "tenants",
    where: { or: [{ slug: { in: ["ami-care", "amicare", "amicare-zorg", "tenant-amicare"] } }, { domain: { equals: "ami-care.nl" } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  if (tenants.docs.length === 0) return
  if (tenants.docs.length !== 1) throw new Error(`Ami Care privacy migration requires exactly one matching tenant; found ${tenants.docs.length}.`)
  const tenant = tenants.docs[0] as Tenant

  const [pagesResult, settingsResult, snapshotsResult] = await Promise.all([
    payload.find({ collection: "pages", where: { tenant: { equals: tenant.id } }, limit: 100, depth: 0, overrideAccess: true }),
    payload.find({ collection: "site-settings", where: { tenant: { equals: tenant.id } }, limit: 2, depth: 0, overrideAccess: true }),
    payload.find({ collection: "published-site-snapshots", where: { tenant: { equals: tenant.id } }, limit: 100, sort: "-version", depth: 0, overrideAccess: true }),
  ])
  if (settingsResult.docs.length !== 1) throw new Error(`Ami Care privacy migration requires exactly one site-settings row; found ${settingsResult.docs.length}.`)
  const activeSnapshot = snapshotsResult.docs.find((snapshot) => snapshot.status === "active") as PublishedSiteSnapshot | undefined
  if (!activeSnapshot?.snapshot) throw new Error("Ami Care privacy migration requires an active snapshot.")
  const activePages = snapshotPagesFrom(activeSnapshot.snapshot)
  const existingPage = pagesResult.docs.find((page) => page.slug === SLUG) as Page | undefined
  const existingSnapshotPage = activePages.find((page) => page.slug === SLUG)
  const existingSettings = settingsResult.docs[0] as SiteSetting
  const currentFooter = existingSettings.chrome?.footer
  const currentLegalLinks = legalLinksFromFooter(currentFooter)
  if (existingPage && existingSnapshotPage && currentLegalLinks.some((link) => link.href === `/${SLUG}`)) return

  const manifest = asRecord(tenant.siteManifest) ?? {}
  const blockTypes = asRecord(manifest.blockTypes) ?? {}
  await payload.update({
    collection: "tenants",
    id: tenant.id,
    data: {
      siteManifest: {
        ...manifest,
        blockTypes: { ...blockTypes, bulletList: true },
      },
    },
    depth: 0,
    overrideAccess: true,
    context: { skipProjection: true, source: "amicare-privacy-page-migration" },
  })

  const pageData = {
    tenant: tenant.id,
    title: TITLE,
    slug: SLUG,
    status: "published" as const,
    blocks: privacyBlocks() as Page["blocks"],
    seo: {
      title: `${TITLE} | Amicare-Zorg`,
      description: "Lees hoe Amicare-Zorg persoonsgegevens en websitegegevens verwerkt.",
    },
  }
  let page: Page
  if (existingPage) {
    await payload.update({
      collection: "pages",
      id: existingPage.id,
      data: pageData,
      depth: 0,
      overrideAccess: true,
      context: { skipProjection: true, source: "amicare-privacy-page-migration" },
    })
    page = await payload.findByID({ collection: "pages", id: existingPage.id, depth: 0, overrideAccess: true })
  } else {
    page = await payload.create({
      collection: "pages",
      data: pageData,
      depth: 0,
      overrideAccess: true,
      context: { skipProjection: true, source: "amicare-privacy-page-migration" },
    })
  }

  const footer = withPrivacyLink(currentFooter)
  await payload.update({
    collection: "site-settings",
    id: existingSettings.id,
    data: { chrome: { ...(existingSettings.chrome ?? {}), footer } },
    depth: 0,
    overrideAccess: true,
    context: { skipProjection: true, source: "amicare-privacy-page-migration" },
  })

  const now = new Date().toISOString()
  const snapshotVersion = Math.max(0, ...snapshotsResult.docs.map((snapshot) => Number(snapshot.version) || 0)) + 1
  const privacyPage: SnapshotPage = {
    id: String(page.id),
    slug: SLUG,
    title: TITLE,
    status: "published",
    updatedAt: now,
    seo: pageData.seo,
    blocks: privacyBlocks(),
  }
  const snapshotPages = existingSnapshotPage
    ? activePages.map((candidate) => candidate.slug === SLUG ? privacyPage : candidate)
    : [...activePages, privacyPage]
  const snapshotSource = asRecord(activeSnapshot.snapshot) ?? {}
  const snapshotManifest = asRecord(snapshotSource.manifest) ?? {}
  const manifestEntries = Array.isArray(snapshotManifest.entries) ? snapshotManifest.entries : []
  const snapshotSettings = asRecord(snapshotSource.settings) ?? {}
  const snapshotChrome = asRecord(snapshotSettings.chrome) ?? {}
  const snapshot = {
    ...snapshotSource,
    manifest: {
      ...snapshotManifest,
      version: snapshotVersion,
      updatedAt: now,
      entries: [
        ...manifestEntries.filter((entry) => {
          const record = asRecord(entry)
          return !(record?.type === "page" && record?.key === SLUG)
        }),
        { type: "page", key: SLUG, updatedAt: now },
      ],
    },
    settings: {
      ...snapshotSettings,
      chrome: {
        ...snapshotChrome,
        footer: withPrivacyLink(snapshotChrome.footer),
      },
    },
    pages: snapshotPages,
    publishedAt: now,
  }
  const snapshotHash = createHash("sha256").update(stableStringify(snapshot)).digest("hex")
  const created = await payload.create({
    collection: "published-site-snapshots",
    data: {
      tenant: tenant.id,
      sourceGenerationRun: null,
      snapshotKey: `${tenant.slug}-v${snapshotVersion}-${snapshotHash.slice(0, 12)}`,
      version: snapshotVersion,
      status: "drafted",
      domain: tenant.domain,
      snapshotHash,
      snapshot,
      publishedAt: now,
      activationReason: "Materialize canonical Ami Care privacy page after provider cutover",
    },
    depth: 0,
    overrideAccess: true,
  })
  const lifecycleContext = { publishSnapshotLifecycleMutation: true }
  await payload.update({ collection: "published-site-snapshots", id: activeSnapshot.id, data: { status: "superseded" }, depth: 0, overrideAccess: true, context: lifecycleContext })
  await payload.update({ collection: "published-site-snapshots", id: created.id, data: { status: "active", activatedAt: now }, depth: 0, overrideAccess: true, context: lifecycleContext })
  await payload.update({ collection: "tenants", id: tenant.id, data: { activeSnapshot: created.id }, depth: 0, overrideAccess: true, context: lifecycleContext })
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await ensureAmicarePrivacyPage(payload)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260719_103000_ensure_amicare_privacy_page is intentionally irreversible after snapshot activation.")
}
