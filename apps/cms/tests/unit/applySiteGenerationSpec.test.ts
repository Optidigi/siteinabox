import { describe, expect, it } from "vitest"
import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { applySiteGenerationSpec, siteGenerationSpecHash, validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"

const rtInline = (text: string) =>
  ({
    t: "root",
    variant: "inline",
    children: [{ t: "text", v: text }],
  }) as any

const rtBlock = (text: string) =>
  ({
    t: "root",
    variant: "block",
    children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
  }) as any

const fixtureSpec = (): SiteGenerationSpec => ({
  schemaVersion: 1,
  intake: {
    businessName: "Fixture Care",
    tenantSlug: "fixture-care",
    primaryDomain: "fixture-care.test",
    siteUrl: "https://fixture-care.test",
    language: "en",
    serviceArea: ["Amsterdam"],
    goals: ["Generate draft site"],
    requestedPages: [{ slug: "index", title: "Home" }],
  },
  tenant: {
    name: "Fixture Care",
    slug: "fixture-care",
    domain: "fixture-care.test",
    status: "provisioning",
  },
  theme: {
    colors: {
      accent: "#2563eb",
      bg: "#ffffff",
      ink: "#111827",
      muted: "#6b7280",
      card: "#f8fafc",
    },
    fonts: {
      heading: "Inter",
      text: "Inter",
      script: "Georgia",
    },
    radius: "8px",
    mode: "light",
  },
  settings: {
    siteName: "Fixture Care",
    siteUrl: "https://fixture-care.test",
    description: "Fixture draft site.",
    language: "en",
    navHeader: [{ label: "Home", href: "/" }, { label: "Contact", href: "/#contact" }],
    navFooter: [{ label: "Email", href: "mailto:hello@example.com", external: true }],
    contactEmail: "hello@example.com",
  },
  pages: [
    {
      slug: "index",
      title: "Home",
      status: "published",
      blocks: [
        {
          blockType: "hero",
          headline: rtInline("Fixture Care"),
          subheadline: rtBlock("Editable CMS draft content."),
          cta: { label: "Contact", href: "#contact" },
        },
        {
          blockType: "contactSection",
          anchor: "contact",
          title: rtInline("Contact"),
          formName: "Contact form",
          submitLabel: "Send",
          fields: [{ name: "email", label: "Email", type: "email", required: true }],
        },
      ],
      seo: {
        title: "Fixture Care",
        description: "Fixture SEO description.",
      },
    },
  ],
  blocks: [
    { slug: "hero", label: "Hero" },
    { slug: "contactSection", label: "Contact" },
  ],
  generatedAt: "2026-06-25T12:00:00.000Z",
  generator: { name: "fixture", version: "1.0.0" },
})

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
  const calls = {
    create: [] as any[],
    update: [] as any[],
    find: [] as any[],
  }
  const payload = {
    find: async (args: any) => {
      calls.find.push(args)
      const docs = store[args.collection as CollectionSlug].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: any) => {
      calls.create.push(args)
      const doc = { ...args.data, id: nextId++ }
      store[args.collection as CollectionSlug].push(doc)
      return doc
    },
    update: async (args: any) => {
      calls.update.push(args)
      const docs = store[args.collection as CollectionSlug]
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const current = docs[index]!
      docs[index] = { ...current, ...args.data, id: current.id }
      return docs[index]!
    },
  }
  return { payload: payload as any, store, calls }
}

describe("applySiteGenerationSpec", () => {
  it("creates draft CMS tenant, pages, settings, theme, and manifest data", async () => {
    const { payload, store, calls } = createPayloadStub()

    const result = await applySiteGenerationSpec(payload, fixtureSpec())

    expect(result.ok).toBe(true)
    expect(result.tenantSlug).toBe("fixture-care")
    expect(result.pageIds).toHaveLength(1)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(1)
    expect(store["site-settings"]).toHaveLength(1)
    const page = store.pages[0]!
    const tenant = store.tenants[0]!
    const settings = store["site-settings"][0]!
    expect(tenant.status).toBe("provisioning")
    expect(page.status).toBe("draft")
    expect(tenant.theme).toEqual({
      palette: {
        accent: "#2563eb",
        bg: "#ffffff",
        ink: "#111827",
        muted: "#6b7280",
      },
      fonts: {
        heading: "Inter",
        text: "Inter",
      },
      radius: "8px",
      mode: "light",
    })
    expect(tenant.siteManifest.generation.hash).toBe(siteGenerationSpecHash(fixtureSpec()))
    expect(settings.navHeader[0]).toMatchObject({ type: "page", page: page.id })
    expect(settings.navHeader[1]).toMatchObject({ type: "section", page: page.id, anchor: "contact" })
    expect([...calls.create, ...calls.update].every((call) => call.context?.skipProjection === true)).toBe(true)
  })

  it("omits generated media paths that are not existing Payload media ids", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()

    const result = await applySiteGenerationSpec(payload, {
      ...spec,
      settings: {
        ...spec.settings,
        branding: { logo: "/logo.png" } as any,
      },
      pages: [
        {
          ...spec.pages[0]!,
          seo: {
            ...spec.pages[0]!.seo,
            ogImage: "/og-default.png" as any,
          },
          blocks: [
            {
              ...spec.pages[0]!.blocks[0]!,
              image: { id: "generated-hero", url: "/hero.jpg", filename: "hero.jpg", alt: "Hero" },
            } as any,
          ],
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(store.pages[0]!.seo.ogImage).toBeUndefined()
    expect(store.pages[0]!.blocks[0].image).toBeUndefined()
    expect(store["site-settings"][0]!.branding.logo).toBeUndefined()
  })

  it("updates existing records on repeat apply instead of creating duplicates", async () => {
    const { payload, store, calls } = createPayloadStub()
    const spec = fixtureSpec()

    const first = await applySiteGenerationSpec(payload, spec)
    const second = await applySiteGenerationSpec(payload, {
      ...spec,
      settings: { ...spec.settings, description: "Updated description." },
      pages: [{ ...spec.pages[0]!, title: "Updated Home" }],
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(store.tenants).toHaveLength(1)
    expect(store.pages).toHaveLength(1)
    expect(store["site-settings"]).toHaveLength(1)
    expect(store.pages[0]!.id).toBe(first.pageIds?.[0])
    expect(store.pages[0]!.title).toBe("Updated Home")
    expect(store["site-settings"][0]!.description).toBe("Updated description.")
    expect(calls.create).toHaveLength(3)
    expect(calls.update).toHaveLength(3)
    expect(second.operations?.pages?.[0]?.operation).toBe("updated")
  })

  it("preserves existing tenant status during draft import", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()

    await applySiteGenerationSpec(payload, spec)
    store.tenants[0]!.status = "active"
    const second = await applySiteGenerationSpec(payload, {
      ...spec,
      tenant: { ...spec.tenant, status: "suspended" },
    })

    expect(second.ok).toBe(true)
    expect(store.tenants[0]!.status).toBe("active")
  })

  it("keeps pages removed from a later generated spec as retained CMS records", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    const aboutPage = {
      ...spec.pages[0]!,
      slug: "about",
      title: "About",
      seo: { title: "About", description: "About Fixture Care." },
    }

    const first = await applySiteGenerationSpec(payload, {
      ...spec,
      pages: [spec.pages[0]!, aboutPage],
    })
    const retainedPage = store.pages.find((page) => page.slug === "about")!
    retainedPage.status = "published"
    const second = await applySiteGenerationSpec(payload, spec)

    expect(first.pageIds).toHaveLength(2)
    expect(second.pageIds).toHaveLength(1)
    expect(store.pages).toHaveLength(2)
    expect(store.pages.find((page) => page.slug === "about")?.status).toBe("published")
    expect(second.operations?.retainedPages).toEqual([
      expect.objectContaining({ id: retainedPage.id, slug: "about", status: "published" }),
    ])
  })

  it("returns validation errors before writing invalid specs", async () => {
    const report = validateSiteGenerationSpecForCms({
      ...fixtureSpec(),
      tenant: { ...fixtureSpec().tenant, slug: "Bad Slug" },
    })

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toContain("invalid_tenant_slug")
  })

  it("rejects generated specs without an index root page", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.slug = "home"
    spec.intake.requestedPages[0]!.slug = "home"

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("missing_root_page")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects unsupported generated block slugs before apply", () => {
    const spec = fixtureSpec()
    const report = validateSiteGenerationSpecForCms({
      ...spec,
      pages: [
        {
          ...spec.pages[0]!,
          blocks: [
            {
              ...spec.pages[0]!.blocks[0]!,
              blockType: "pricingTable",
            } as any,
          ],
        },
      ],
      blocks: [{ slug: "pricingTable" as any, label: "Pricing" }],
    })

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["unsupported_block_type", "unsupported_manifest_block_slug"]),
    )
  })

  it("rejects missing required block fields before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    delete (spec.pages[0]!.blocks[0]! as any).headline

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("invalid_contract_shape")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects invalid rich text before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    ;(spec.pages[0]!.blocks[0]! as any).headline = {
      t: "root",
      variant: "inline",
      children: [{ t: "paragraph", children: [{ t: "text", v: "Not inline" }] }],
    }

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("invalid_contract_shape")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects invalid theme tokens before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.theme = {
      ...spec.theme,
      colors: {
        ...spec.theme.colors,
        accent: "not-a-color",
      },
    }

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("invalid_contract_shape")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects unsupported source-backed block variants before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      analytics: { sectionVariant: "tailblocks-cta-a" },
    } as any

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("unsupported_block_variant")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("accepts only canonical approved source-backed variants for the matching block type", () => {
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      analytics: { sectionVariant: "tailwind-plus-simple-centered" },
    } as any

    const report = validateSiteGenerationSpecForCms(spec)

    expect(report.valid).toBe(true)
  })

  it("allows canonical generated block source metadata", () => {
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      source: "ai",
    } as any

    const report = validateSiteGenerationSpecForCms(spec)

    expect(report.valid).toBe(true)
  })

  it("rejects raw HTML, arbitrary class names, and generated source payload fields", async () => {
    const blockedFields = [
      { key: "rawHtml", value: "<section class=\"p-24\">Generated HTML</section>" },
      { key: "html", value: "<div>Generated HTML</div>" },
      { key: "className", value: "bg-red-500 p-[99px]" },
      { key: "classes", value: ["grid", "md:grid-cols-7"] },
      { key: "component", value: "export function GeneratedBlock() { return null }" },
      { key: "sourceCode", value: "const classes = 'p-24'" },
      { key: "filePath", value: "sites/new-tenant/src/pages/index.tsx" },
      { key: "source", value: "sites/new-tenant/src/components/Hero.tsx" },
    ]

    for (const field of blockedFields) {
      const { payload, store } = createPayloadStub()
      const spec = fixtureSpec()
      ;(spec.pages[0]!.blocks[0]! as any)[field.key] = field.value

      const result = await applySiteGenerationSpec(payload, spec)

      expect(result.ok, field.key).toBe(false)
      expect(result.validation.issues.map((entry) => entry.code), field.key).toContain("invalid_contract_shape")
      expect(store.tenants, field.key).toHaveLength(0)
      expect(store.pages, field.key).toHaveLength(0)
      expect(store["site-settings"], field.key).toHaveLength(0)
    }
  })
})
