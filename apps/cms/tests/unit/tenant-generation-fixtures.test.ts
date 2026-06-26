import { describe, expect, it } from "vitest"
import type { Page } from "@siteinabox/contracts"
import {
  amblastPublishedSiteSnapshot,
  amblastSiteGenerationSpec,
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
  tenantPublishedSiteSnapshots,
  tenantSiteGenerationSpecs,
} from "@siteinabox/contracts/fixtures/tenants"
import { applySiteGenerationSpec, validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { buildPageSeoMetadata } from "@siteinabox/site-renderer/seo"
import { findPublishedPage, pagePath } from "../../../renderer/src/lib/snapshot"

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as any).equals)
    }
    return doc[field] === condition
  })
}

const createPayloadStub = () => {
  let nextId = 1
  type CollectionSlug = "tenants" | "pages" | "site-settings"
  const store: Record<CollectionSlug, any[]> = {
    tenants: [],
    pages: [],
    "site-settings": [],
  }
  const payload = {
    find: async (args: any) => {
      const docs = store[args.collection as CollectionSlug].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: any) => {
      const doc = { ...args.data, id: nextId++ }
      store[args.collection as CollectionSlug].push(doc)
      return doc
    },
    update: async (args: any) => {
      const docs = store[args.collection as CollectionSlug]
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const current = docs[index]!
      docs[index] = { ...current, ...args.data, id: current.id }
      return docs[index]!
    },
  }
  return { payload: payload as any, store }
}

const asPublishedPage = (page: (typeof tenantPublishedSiteSnapshots)[number]["pages"][number]): Page => ({
  ...page,
  status: "published",
  updatedAt: page.updatedAt ?? "2026-06-25T00:00:00.000Z",
})

describe("legacy tenant generation fixtures", () => {
  it("validates Amicare and Amblast SiteGenerationSpec data for CMS apply", () => {
    for (const spec of tenantSiteGenerationSpecs) {
      const report = validateSiteGenerationSpecForCms(spec)

      expect(report.valid, `${spec.tenant.slug}: ${report.issues.map((entry) => entry.code).join(", ")}`).toBe(true)
      expect(spec.settings.navHeader?.length).toBeGreaterThan(0)
      expect(spec.theme.colors?.accent).toBeTruthy()
      expect(spec.pages.every((page) => page.seo?.description)).toBe(true)
      expect(spec.pages.every((page) => page.blocks.length > 0)).toBe(true)
    }
  })

  it("keeps generated specs and published snapshots in data parity", () => {
    const pairs = [
      [amicareSiteGenerationSpec, amicarePublishedSiteSnapshot],
      [amblastSiteGenerationSpec, amblastPublishedSiteSnapshot],
    ] as const

    for (const [spec, snapshot] of pairs) {
      expect(snapshot.schemaVersion).toBe(1)
      expect(snapshot.tenantSlug).toBe(spec.tenant.slug)
      expect(snapshot.domain).toBe(spec.tenant.domain)
      expect(snapshot.siteUrl).toBe(spec.settings.siteUrl)
      expect(snapshot.settings).toEqual(spec.settings)
      expect(snapshot.theme).toEqual(spec.theme)
      expect(snapshot.pages.map((page) => page.slug)).toEqual(spec.pages.map((page) => page.slug))
      expect(snapshot.manifest.entries.filter((entry) => entry.type === "page").map((entry) => entry.key)).toEqual(
        spec.pages.map((page) => page.slug),
      )
      expect(snapshot.manifest.entries.filter((entry) => entry.type === "media").length).toBe(spec.assets?.length ?? 0)
    }
  })

  it("represents Amblast legacy pages, SEO, navigation, services, contact, and media as canonical data", () => {
    expect(amblastSiteGenerationSpec.pages.map((page) => page.slug)).toEqual([
      "index",
      "over-ons",
      "diensten",
      "portfolio",
      "contact",
    ])
    expect(amblastSiteGenerationSpec.settings.contact?.phone).toBe("+31619963651")
    expect(amblastSiteGenerationSpec.settings.nap?.kvkNumber).toBe("72128690")
    expect(amblastSiteGenerationSpec.settings.hours).toHaveLength(7)
    expect(amblastSiteGenerationSpec.settings.navHeader?.map((entry) => entry.label)).toEqual([
      "Home",
      "Over ons",
      "Onze diensten",
      "Portfolio",
      "Contact",
    ])
    expect(amicareSiteGenerationSpec.settings.navHeader?.[0]?.href).toBe("/")
    expect(amblastSiteGenerationSpec.settings.navHeader?.[0]?.href).toBe("/")

    const allBlocks = amblastSiteGenerationSpec.pages.flatMap((page) => page.blocks)
    expect(allBlocks.some((block) => block.blockType === "featureList")).toBe(true)
    expect(allBlocks.some((block) => block.blockType === "contactSection")).toBe(true)
    expect(JSON.stringify(allBlocks)).toContain("Papierindustrie")
    expect(JSON.stringify(allBlocks)).toContain("Vloeren reiniging")
    expect(JSON.stringify(allBlocks)).toContain("/uploads/portfolio/1-olie-scaled.jpg")

    const contactPage = amblastSiteGenerationSpec.pages.find((page) => page.slug === "contact")
    const contactForm = contactPage?.blocks.find((block) => block.blockType === "contactSection")
    expect(contactForm).toMatchObject({
      blockType: "contactSection",
      formName: "amblast-contact",
    })
    if (contactForm?.blockType !== "contactSection") throw new Error("Expected contact section")
    expect(contactForm.fields.map((field) => field.name)).toEqual(["name", "email", "subject", "message"])
    expect(JSON.stringify(contactPage?.blocks)).toContain("Stationspark 189")
    expect(amblastSiteGenerationSpec.settings.contact?.address).toBe("Heinsbergerweg 172, 6045 CK Roermond")
  })

  it("publishes both real validation tenants through the snapshot model", () => {
    expect(tenantPublishedSiteSnapshots.map((snapshot) => snapshot.tenantSlug)).toEqual(["amicare", "amblast"])
    expect(tenantPublishedSiteSnapshots.every((snapshot) => snapshot.pages.some((page) => page.slug === "index"))).toBe(true)
    expect(tenantPublishedSiteSnapshots.every((snapshot) => snapshot.manifest.entries.some((entry) => entry.type === "settings"))).toBe(true)
    expect(tenantPublishedSiteSnapshots.every((snapshot) => snapshot.manifest.entries.some((entry) => entry.type === "media"))).toBe(true)
  })

  it("resolves legacy tenant snapshots through renderer path and SEO helpers", () => {
    expect(pagePath(asPublishedPage(amicarePublishedSiteSnapshot.pages[0]!))).toBe("/")
    expect(amblastPublishedSiteSnapshot.pages.map((page) => pagePath(asPublishedPage(page)))).toEqual(["/", "/over-ons", "/diensten", "/portfolio", "/contact"])
    expect(findPublishedPage(amicarePublishedSiteSnapshot, "/")?.title).toBe("Home")
    expect(findPublishedPage(amblastPublishedSiteSnapshot, "/diensten")?.title).toBe("Diensten")
    expect(findPublishedPage(amblastPublishedSiteSnapshot, "/missing")).toBeNull()

    const amicareSeo = buildPageSeoMetadata({
      page: asPublishedPage(amicarePublishedSiteSnapshot.pages[0]!),
      settings: amicarePublishedSiteSnapshot.settings,
    })
    const amblastPortfolio = findPublishedPage(amblastPublishedSiteSnapshot, "/portfolio")
    if (!amblastPortfolio) throw new Error("Missing Amblast portfolio fixture page")
    const amblastSeo = buildPageSeoMetadata({
      page: amblastPortfolio,
      settings: amblastPublishedSiteSnapshot.settings,
    })

    expect(amicareSeo).toMatchObject({
      title: "Amicare-Zorg",
      canonical: "https://ami-care.nl/",
    })
    expect(amicareSeo.openGraph?.images?.[0]?.url).toBe("/og-default.png")
    expect(amblastSeo).toMatchObject({
      title: "Portfolio | Amblast",
      canonical: "https://amblast.nl/portfolio",
    })
    expect(amblastPublishedSiteSnapshot.theme?.colors?.accent).toBe("#ffd500")
    expect(amblastPublishedSiteSnapshot.settings.branding?.logo).toMatchObject({ filename: "logo.png" })
  })

  it("applies both tenant specs through the CMS generation path", async () => {
    for (const spec of tenantSiteGenerationSpecs) {
      const { payload, store } = createPayloadStub()
      const result = await applySiteGenerationSpec(payload, spec)

      expect(result.ok).toBe(true)
      expect(result.tenantSlug).toBe(spec.tenant.slug)
      expect(store.tenants[0]?.theme?.palette?.accent).toBe(spec.theme.colors?.accent)
      expect(store.pages).toHaveLength(spec.pages.length)
      expect(store["site-settings"][0]?.navHeader).toHaveLength(spec.settings.navHeader?.length ?? 0)
    }
  })
})
