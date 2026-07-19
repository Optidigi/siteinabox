import { createHash } from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

const REQUIRED_MEDIA = ["toys.jpg", "bedroom.jpg", "og-default.png", "favicon.svg", "favicon.ico", "apple-touch-icon.png"] as const
const THEME = {
  version: 3,
  appearance: { mode: "light" },
  colors: { schemeId: "terracotta-warm" },
  fonts: { schemeId: "classic-editorial" },
  shape: { schemeId: "soft" },
}
const BLOCK_MANIFEST = [
  { slug: "hero", label: "Hero", defaultAnchor: "top" },
  { slug: "featureList", label: "Werkwijze", defaultAnchor: "werkwijze" },
  { slug: "cta", label: "CTA" },
  { slug: "contactDetails", label: "Contact", defaultAnchor: "contact" },
  { slug: "contentSection", label: "Inhoud" },
]

const inlineParts = (parts: Array<{ text: string; marks?: string[] }>) => ({
  t: "root",
  variant: "inline",
  children: parts.map((part) => ({ t: "text", v: part.text, ...(part.marks ? { marks: part.marks } : {}) })),
})
const inlineText = (text: string) => inlineParts([{ text }])
const blockText = (text: string) => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})
const paragraphs = (values: string[]) => ({
  t: "root",
  variant: "block",
  children: values.map((value) => ({ t: "paragraph", children: [{ t: "text", v: value }] })),
})

type MediaBinding = (filename: typeof REQUIRED_MEDIA[number], alt: string) => unknown

const pageBlocks = (media: MediaBinding) => [
  {
    blockType: "hero",
    designVariant: "shadcnui-blocks.hero-02",
    anchor: "top",
    eyebrow: inlineText("Voor jongeren en gezinnen"),
    headline: inlineParts([{ text: "Jeugdzorg met " }, { text: "hart", marks: ["italic"] }, { text: " en toewijding." }]),
    subheadline: blockText("Al jarenlang werk ik met toewijding in de jeugdzorg. Dit is het vak dat ik ken — waar mijn hart ligt, en waar ik mij dagelijks voor inzet."),
    cta: { label: "Contact", href: "#contact" },
    image: media("toys.jpg", "Speelgoed"),
  },
  {
    blockType: "featureList",
    designVariant: "shadcnui-blocks.features-01",
    anchor: "werkwijze",
    title: inlineParts([{ text: "Wat voor mij " }, { text: "centraal staat", marks: ["italic"] }, { text: "." }]),
    intro: blockText("Drie dingen"),
    features: [
      { title: inlineText("Aandacht"), description: blockText("Echt luisteren naar wat een jongere of een gezin op dat moment nodig heeft. Zonder aannames vooraf."), icon: "ear" },
      { title: inlineText("Betrokkenheid"), description: blockText("Naast mensen staan, niet erboven. Werken vanuit gelijkwaardigheid en vertrouwen."), icon: "heart-handshake" },
      { title: inlineText("Continuïteit"), description: blockText("Aanwezig blijven, ook als trajecten lang of ingewikkeld worden. De relatie als basis."), icon: "clock" },
    ],
  },
  {
    blockType: "cta",
    designVariant: "shadcnui-blocks.cta-03",
    anchor: "over",
    headline: inlineParts([{ text: "Het vak waar mijn " }, { text: "hart ligt", marks: ["italic"] }, { text: "." }]),
    description: paragraphs([
      "Tegelijk blijf ik mijzelf graag ontwikkelen, en sta ik open voor nieuwe uitdagingen en opdrachten binnen het werkveld.",
      "Naast mijn werk ben ik moeder, en geniet ik van het drukke, gezellige gezinsleven. De combinatie van werk en gezin maakt mijn dagen dynamisch — en waardevol.",
    ]),
    primary: { label: "Neem contact op", href: "#contact" },
    backgroundImage: media("toys.jpg", "Speelgoed"),
  },
  {
    blockType: "cta",
    designVariant: "shadcnui-blocks.cta-02",
    anchor: "wat-telt",
    headline: inlineText("Vertrouwen ontstaat in de tijd, niet in één gesprek."),
    description: blockText("Daarom werk ik graag in trajecten waar continuïteit en kleine stappen het echte werk doen — voor jongeren, voor gezinnen, en voor de mensen om hen heen."),
    backgroundImage: media("bedroom.jpg", "Slaapkamer met zacht ochtendlicht"),
  },
  {
    blockType: "contactDetails",
    designVariant: "shadcnui-blocks.contact-01",
    anchor: "contact",
    title: inlineText("Wilt u meer informatie of in contact komen?"),
    items: [
      { title: "E-mail", description: "Neem rechtstreeks contact op.", value: "info@ami-care.nl", href: "mailto:info@ami-care.nl", icon: "mail" },
      { title: "Werkgebied", description: "Jeugdzorg voor jongeren en gezinnen.", value: "Nederland", icon: "map-pin" },
      { title: "Bedrijfsgegevens", description: "KVK 99968347", value: "Vestigingsnummer 000065004922", icon: "building-2" },
    ],
  },
]

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const canonicalManifest = () => ({
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  colorTokens: [],
  fontFamilies: [
    { id: "title", label: "Title font", cssVar: "--font-title" },
    { id: "heading", label: "Heading font", cssVar: "--font-heading" },
    { id: "text", label: "Text font", cssVar: "--font-text" },
  ],
  typeStyles: [],
  blocks: BLOCK_MANIFEST,
  generation: { source: "migration", generator: { name: "amicare-provider-rebuild", version: "1" } },
})

function providerPrivacyBlocks(blocks: unknown): unknown[] {
  if (!Array.isArray(blocks)) return []
  return blocks.map((value) => {
    const block = value as Record<string, unknown>
    if (block.blockType === "richText") {
      const { blockName: _blockName, id: _id, ...rest } = block
      return { ...rest, blockType: "contentSection", designVariant: "shadcnui-blocks.legal-content-01" }
    }
    if (typeof block.designVariant === "string" && block.designVariant.startsWith("amicare")) {
      throw new Error(`Ami Care rebuild encountered unsupported legacy block ${block.blockType}:${block.designVariant}.`)
    }
    const { blockName: _blockName, ...rest } = block
    return rest
  })
}

export async function rebuildAmicare(payload: MigrateUpArgs["payload"]): Promise<void> {
  const tenants = await payload.find({
    collection: "tenants",
    where: { or: [
      { slug: { in: ["ami-care", "amicare", "amicare-zorg", "tenant-amicare"] } },
      { domain: { in: ["ami-care.nl", "amicare.nl", "amicare.optidigi.nl"] } },
    ] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  } as any)
  if (tenants.docs.length === 0) return
  if (tenants.docs.length !== 1) throw new Error(`Ami Care rebuild requires exactly one matching tenant; found ${tenants.docs.length}.`)
  const tenant = tenants.docs[0] as any

  const [mediaResult, pageResult, settingsResult, snapshotResult] = await Promise.all([
    payload.find({ collection: "media", where: { tenant: { equals: tenant.id } }, limit: 100, depth: 0, overrideAccess: true } as any),
    payload.find({ collection: "pages", where: { tenant: { equals: tenant.id } }, limit: 100, depth: 0, overrideAccess: true } as any),
    payload.find({ collection: "site-settings", where: { tenant: { equals: tenant.id } }, limit: 2, depth: 0, overrideAccess: true } as any),
    payload.find({ collection: "published-site-snapshots", where: { tenant: { equals: tenant.id } }, limit: 100, sort: "-version", depth: 0, overrideAccess: true } as any),
  ])
  const mediaByFilename = new Map<string, string | number>()
  for (const item of mediaResult.docs as any[]) if (typeof item.filename === "string") mediaByFilename.set(item.filename, item.id)
  const missing = REQUIRED_MEDIA.filter((filename) => !mediaByFilename.has(filename))
  if (missing.length) throw new Error(`Ami Care rebuild is missing required tenant media: ${missing.join(", ")}.`)
  if (settingsResult.docs.length !== 1) throw new Error(`Ami Care rebuild requires exactly one site-settings row; found ${settingsResult.docs.length}.`)
  const indexPage = (pageResult.docs as any[]).find((page) => page.slug === "index")
  const otherPages = (pageResult.docs as any[]).filter((page) => page.slug !== "index")
  if (!indexPage) throw new Error("Ami Care rebuild requires an index page.")
  if (otherPages.some((page) => page.slug !== "privacy-en-cookieverklaring")) {
    throw new Error(`Ami Care rebuild found unexpected pages: ${otherPages.map((page) => page.slug).join(", ")}.`)
  }
  const activeSnapshot = (snapshotResult.docs as any[]).find((snapshot) => snapshot.status === "active")
  if (!activeSnapshot?.snapshot) throw new Error("Ami Care rebuild requires an active snapshot to preserve governed settings.")

  const cmsMedia: MediaBinding = (filename) => mediaByFilename.get(filename)!
  const snapshotMedia: MediaBinding = (filename, alt) => ({ url: `/media/${filename}`, filename, alt })
  const now = new Date().toISOString()
  await payload.update({
    collection: "tenants",
    id: tenant.id,
    data: { theme: THEME, siteManifest: canonicalManifest() },
    depth: 0,
    overrideAccess: true,
    context: { skipProjection: true, source: "amicare-provider-rebuild-migration" },
  } as any)
  const updatedIndex = await payload.update({
    collection: "pages",
    id: indexPage.id,
    data: {
      title: "Home",
      status: "published",
      blocks: pageBlocks(cmsMedia),
      seo: { title: "Amicare-Zorg", description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.", ogImage: mediaByFilename.get("og-default.png") },
    },
    depth: 0,
    overrideAccess: true,
    context: { skipProjection: true, source: "amicare-provider-rebuild-migration" },
  } as any) as any
  const updatedOtherPages = [] as any[]
  for (const page of otherPages) {
    updatedOtherPages.push(await payload.update({
      collection: "pages",
      id: page.id,
      data: { status: "published", blocks: providerPrivacyBlocks(page.blocks) },
      depth: 0,
      overrideAccess: true,
      context: { skipProjection: true, source: "amicare-provider-rebuild-migration" },
    } as any))
  }

  const existingSettings = settingsResult.docs[0] as any
  const header = { variant: "shadcnui-blocks.navbar-03", behavior: "sticky", activeMode: "anchor", mobileMenu: "dropdown", cta: { label: "Contact", href: "#contact" } }
  const footer = {
    variant: "shadcnui-blocks.footer-07",
    tagline: "Jeugdzorg met hart en toewijding.",
    copyright: "© Amicare-Zorg",
    columns: [
      { id: "brand", items: [{ type: "brand", label: "Amicare-Zorg", text: "Jeugdzorg met hart en toewijding." }] },
      { id: "business", items: [{ type: "business", label: "Bedrijfsgegevens" }] },
      { id: "contact", items: [{ type: "contact", label: "Contact", links: [{ label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" }] }] },
      { id: "nav", items: [{ type: "navigation", label: "Navigatie" }] },
    ],
  }
  const banner = {
    ...(existingSettings.chrome?.banner ?? {}),
    variant: "shadcnui-blocks.banner-04",
    visible: true,
    title: "Cookies",
    message: "Wij en onze partners gebruiken cookies en vergelijkbare technologieën om uw ervaring te verbeteren en te analyseren hoe deze website wordt gebruikt.",
    dismissible: false,
  }
  const nav = [
    { type: "section", page: indexPage.id, anchor: "werkwijze", label: "Werkwijze" },
    { type: "section", page: indexPage.id, anchor: "over", label: "Over" },
    { type: "section", page: indexPage.id, anchor: "wat-telt", label: "Wat telt" },
    { type: "section", page: indexPage.id, anchor: "contact", label: "Contact" },
  ]
  await payload.update({
    collection: "site-settings",
    id: existingSettings.id,
    data: {
      siteName: "Amicare-Zorg",
      siteUrl: `https://${tenant.domain}`,
      description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
      language: "nl",
      contactEmail: "info@ami-care.nl",
      branding: { ...(existingSettings.branding ?? {}), primaryColor: "#a04e32", favicon: mediaByFilename.get("favicon.svg") },
      chrome: { header, footer, banner },
      navHeader: nav,
      navFooter: nav,
    },
    depth: 0,
    overrideAccess: true,
    context: { skipProjection: true, source: "amicare-provider-rebuild-migration" },
  } as any)
  const snapshotSettings = activeSnapshot.snapshot.settings as Record<string, any>
  const publishedPages = [
    {
      id: String(updatedIndex.id), slug: "index", title: "Home", status: "published", updatedAt: now,
      seo: { title: "Amicare-Zorg", description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.", ogImage: snapshotMedia("og-default.png", "Amicare-Zorg") },
      blocks: pageBlocks(snapshotMedia),
    },
    ...updatedOtherPages.map((page) => ({
      id: String(page.id), slug: page.slug, title: page.title, status: "published", updatedAt: now,
      ...(page.seo ? { seo: page.seo } : {}), blocks: providerPrivacyBlocks(page.blocks),
    })),
  ]
  const snapshotVersion = Math.max(0, ...(snapshotResult.docs as any[]).map((snapshot) => Number(snapshot.version) || 0)) + 1
  const snapshot = {
    schemaVersion: 1,
    tenantId: String(tenant.id),
    tenantSlug: tenant.slug,
    domain: tenant.domain,
    siteUrl: `https://${tenant.domain}`,
    manifest: {
      tenantId: String(tenant.id), version: snapshotVersion, updatedAt: now,
      entries: [
        { type: "settings", key: "site-settings", updatedAt: now },
        ...publishedPages.map((page) => ({ type: "page", key: page.slug, updatedAt: now })),
      ],
    },
    settings: {
      ...snapshotSettings,
      siteName: "Amicare-Zorg",
      siteUrl: `https://${tenant.domain}`,
      description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
      language: "nl",
      contactEmail: "info@ami-care.nl",
      branding: { ...(snapshotSettings.branding ?? {}), primaryColor: "#a04e32", favicon: snapshotMedia("favicon.svg", "Amicare-Zorg favicon") },
      chrome: { header, footer, banner },
      navHeader: nav.map(({ type: _type, page: _page, ...entry }) => ({ label: entry.label, href: `#${entry.anchor}` })),
      navFooter: nav.map(({ type: _type, page: _page, ...entry }) => ({ label: entry.label, href: `#${entry.anchor}` })),
    },
    pages: publishedPages,
    theme: THEME,
    blocks: BLOCK_MANIFEST,
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
      activationReason: "Replace retired Ami Care renderer with canonical provider blocks",
    },
    depth: 0,
    overrideAccess: true,
  } as any) as any
  const lifecycleContext = { publishSnapshotLifecycleMutation: true }
  await payload.update({ collection: "published-site-snapshots", id: activeSnapshot.id, data: { status: "superseded" }, depth: 0, overrideAccess: true, context: lifecycleContext } as any)
  await payload.update({ collection: "published-site-snapshots", id: created.id, data: { status: "active", activatedAt: now }, depth: 0, overrideAccess: true, context: lifecycleContext } as any)
  await payload.update({ collection: "tenants", id: tenant.id, data: { activeSnapshot: created.id }, depth: 0, overrideAccess: true, context: lifecycleContext } as any)
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await rebuildAmicare(payload)
  await db.execute(sql`
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" TYPE text;
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" TYPE text;
    UPDATE "site_settings" SET "chrome_header_variant" = 'shadcnui-blocks.navbar-01' WHERE "chrome_header_variant" = 'amicareZen';
    UPDATE "site_settings" SET "chrome_footer_variant" = 'shadcnui-blocks.footer-01' WHERE "chrome_footer_variant" = 'amicareZen';
    DROP TYPE "public"."enum_site_settings_chrome_header_variant";
    DROP TYPE "public"."enum_site_settings_chrome_footer_variant";
    CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('shadcnui-blocks.navbar-01','shadcnui-blocks.navbar-02','shadcnui-blocks.navbar-03','shadcnui-blocks.navbar-04','shadcnui-blocks.navbar-05');
    CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('shadcnui-blocks.footer-01','shadcnui-blocks.footer-02','shadcnui-blocks.footer-03','shadcnui-blocks.footer-04','shadcnui-blocks.footer-05','shadcnui-blocks.footer-06','shadcnui-blocks.footer-07');
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260718_230256 is intentionally irreversible: the retired Ami Care renderer and variants cannot be restored safely.")
}
