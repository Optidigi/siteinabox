// Seed script: create an Amicare-Zorg tenant + index page with the v2 RtNode
// content that mirrors the ami-care.nl production homepage. Used to drive the
// local-pipeline test (siab-payload <-> ami-care Astro) without standing up
// the full admin UI / bootstrap-token flow.
//
// Run: pnpm tsx scripts/seed-local-pipeline.ts
// Prints: <DATA_DIR>/tenants/<id> path so Astro's CMS_DATA_DIR can be set.
import "dotenv/config"
import { getPayload } from "payload"
import config from "@/payload.config"
import { resolve } from "node:path"

const manifest = {
  version: 1 as const,
  inlineMarks: { bold: true, italic: true },
  colorTokens: [{ id: "accent", label: "Accent", cssVar: "--color-accent" }],
  fontFamilies: [
    { id: "title", label: "Title", cssVar: "--font-title" },
    { id: "heading", label: "Heading", cssVar: "--font-heading" },
    { id: "text", label: "Text", cssVar: "--font-text" },
    { id: "script", label: "Script", cssVar: "--font-script" },
    { id: "serif", label: "Serif", cssVar: "--font-serif" },
  ],
  blockTypes: {
    paragraph: true as const,
    heading: { levels: [2, 3] as Array<2 | 3 | 4> },
    bulletList: true,
    orderedList: true,
    blockquote: true,
    divider: true,
  },
  themedNodes: [
    { id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text" as const, required: true }] },
  ],
  blocks: [
    { slug: "hero", label: "Hero", defaultAnchor: "top" },
    { slug: "featureList", label: "Feature list", defaultAnchor: "werkwijze" },
    { slug: "richText", label: "Rich text", defaultAnchor: "over" },
    { slug: "cta", label: "CTA", defaultAnchor: "contact" },
    { slug: "contactSection", label: "Contact", defaultAnchor: "contact" },
    { slug: "faq", label: "FAQ" },
    { slug: "testimonials", label: "Testimonials" },
  ],
  cssEntry: "cms-editor.css",
}

// RtNode helpers
const txt = (v: string, marks?: Array<"bold" | "italic">) => ({ t: "text" as const, v, ...(marks ? { marks } : {}) })
const inline = (...children: any[]) => ({ t: "root" as const, variant: "inline" as const, children })
const block = (...children: any[]) => ({ t: "root" as const, variant: "block" as const, children })
const para = (...children: any[]) => ({ t: "paragraph" as const, children })
const h2 = (...children: any[]) => ({ t: "heading" as const, level: 2 as const, children })
const desiredDomain = "ami-care.nl"
const fallbackDomain = "ami-care.local"

const main = async () => {
  const payload = await getPayload({ config })

  const [existing, desiredDomainOwner] = await Promise.all([
    payload.find({
      collection: "tenants", where: { slug: { equals: "amicare-zorg" } }, limit: 1, overrideAccess: true,
    }),
    payload.find({
      collection: "tenants", where: { domain: { equals: desiredDomain } }, limit: 1, overrideAccess: true,
    }),
  ])

  let tenantId: number | string
  if (existing.docs[0]) {
    const existingTenant = existing.docs[0] as any
    tenantId = existingTenant.id
    const desiredDomainIsAvailable =
      !desiredDomainOwner.docs[0] || String((desiredDomainOwner.docs[0] as any).id) === String(tenantId)
    await payload.update({
      collection: "tenants", id: tenantId as any,
      data: {
        domain: desiredDomainIsAvailable ? desiredDomain : existingTenant.domain ?? fallbackDomain,
        siteManifest: manifest,
      } as any, overrideAccess: true,
    })
    console.log(`[seed] reused existing tenant id=${tenantId}`)
  } else {
    const desiredDomainIsAvailable = !desiredDomainOwner.docs[0]
    const t = await payload.create({
      collection: "tenants",
      data: {
        name: "Amicare-Zorg", slug: "amicare-zorg",
        domain: desiredDomainIsAvailable ? desiredDomain : fallbackDomain,
        siteManifest: manifest,
      } as any, overrideAccess: true,
    })
    tenantId = (t as any).id
    console.log(`[seed] created tenant id=${tenantId}`)
  }

  // Page content mirrors the ami-care prod homepage (from
  // ~/Desktop/ami-care-content-backup-2026-05-13.md), converted to RtNode.
  const blocks = [
    {
      blockType: "hero",
      eyebrow: inline(txt("Voor jongeren en gezinnen")),
      headline: inline(txt("Jeugdzorg met "), txt("hart", ["italic"]), txt(" en toewijding.")),
      subheadline: block(para(txt("Al jarenlang werk ik met toewijding in de jeugdzorg. Dit is het vak dat ik ken — waar mijn hart ligt, en waar ik mij dagelijks voor inzet."))),
      cta: { label: "Contact", href: "#contact" },
    },
    {
      blockType: "featureList",
      title: inline(txt("Wat voor mij "), txt("centraal staat", ["italic"]), txt(".")),
      intro: block(para(txt("Drie dingen"))),
      features: [
        { title: inline(txt("Aandacht")), description: block(para(txt("Echt luisteren naar wat een jongere of een gezin op dat moment nodig heeft. Zonder aannames vooraf."))), icon: "ear" },
        { title: inline(txt("Betrokkenheid")), description: block(para(txt("Naast mensen staan, niet erboven. Werken vanuit gelijkwaardigheid en vertrouwen."))), icon: "heart-handshake" },
        { title: inline(txt("Continuïteit")), description: block(para(txt("Aanwezig blijven, ook als trajecten lang of ingewikkeld worden. De relatie als basis."))), icon: "clock" },
      ],
    },
    {
      blockType: "richText",
      body: block(
        { t: "themed", id: "eyebrow", props: { text: "Over mij" } },
        h2(txt("Het vak waar mijn "), txt("hart ligt", ["italic"]), txt(".")),
        para(txt("Tegelijk blijf ik mijzelf graag ontwikkelen, en sta ik open voor nieuwe uitdagingen en opdrachten binnen het werkveld.")),
        para(txt("Naast mijn werk ben ik moeder, en geniet ik van het drukke, gezellige gezinsleven. De combinatie van werk en gezin maakt mijn dagen dynamisch — en waardevol.")),
      ),
    },
    {
      blockType: "cta",
      headline: inline(txt("Vertrouwen ontstaat in de tijd, niet in één gesprek.")),
      description: block(para(txt("Daarom werk ik graag in trajecten waar continuïteit en kleine stappen het echte werk doen — voor jongeren, voor gezinnen, en voor de mensen om hen heen."))),
      primary: { label: "(unused)", href: "#contact" },
    },
    {
      blockType: "cta",
      headline: inline(txt("Wilt u meer informatie of in contact komen?")),
      primary: { label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" },
    },
  ]

  // Find or create the page
  const pageExisting = await payload.find({
    collection: "pages",
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: "index" } }] },
    limit: 1, overrideAccess: true,
  })

  const seoData = {
    title: "Amicare-Zorg — Jeugdzorg met hart en toewijding",
    description: "Amicare-Zorg — werken in de jeugdzorg met hart en toewijding. Voor jongeren en gezinnen in Roermond e.o.",
  }

  if (pageExisting.docs[0]) {
    await payload.update({
      collection: "pages", id: (pageExisting.docs[0] as any).id,
      data: {
        blocks, status: "published",
        title: "Amicare-Zorg — Jeugdzorg met hart en toewijding",
        seo: seoData,
      } as any,
      overrideAccess: true,
    })
    console.log(`[seed] updated existing page slug=index`)
  } else {
    await payload.create({
      collection: "pages",
      data: {
        title: "Amicare-Zorg — Jeugdzorg met hart en toewijding",
        slug: "index", status: "published", tenant: tenantId, blocks,
        seo: seoData,
      } as any, overrideAccess: true,
    })
    console.log(`[seed] created page slug=index`)
  }

  // Also write minimal site settings so cms.getSite() returns something
  const settingsExisting = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: tenantId } } as any,
    limit: 1, overrideAccess: true,
  })
  if (!settingsExisting.docs[0]) {
    await payload.create({
      collection: "site-settings",
      data: { tenant: tenantId, siteName: "Amicare-Zorg", siteUrl: "https://ami-care.nl" } as any,
      overrideAccess: true,
    })
    console.log(`[seed] created site-settings`)
  }

  const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")
  const tenantDir = resolve(dataDir, "tenants", String(tenantId))
  console.log("")
  console.log("==============================================")
  console.log("Seed complete.")
  console.log(`Tenant id: ${tenantId}`)
  console.log(`Astro CMS_DATA_DIR should point at:`)
  console.log(`  ${tenantDir}`)
  console.log("==============================================")
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
