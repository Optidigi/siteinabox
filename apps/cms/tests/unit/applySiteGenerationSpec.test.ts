import { describe, expect, it, vi } from "vitest"
import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { applySiteGenerationSpec, validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { pageToJson } from "@/lib/projection/pageToJson"

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
          designVariant: "tailwindPlusSimpleCentered",
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
  type CollectionSlug = "tenants" | "pages" | "site-settings" | "media"
  const store: Record<CollectionSlug, any[]> = {
    tenants: [],
    pages: [],
    "site-settings": [],
    media: [],
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
        script: "Georgia",
      },
      radius: "8px",
      mode: "light",
    })
    expect(tenant.siteManifest.generation.hash).toBe(result.idempotencyKey)
    expect(settings.navHeader[0]).toMatchObject({ type: "page", page: page.id })
    expect(settings.navHeader[1]).toMatchObject({ type: "section", page: page.id, anchor: "contact" })
    expect([...calls.create, ...calls.update].every((call) => call.context?.skipProjection === true)).toBe(true)
  })

  it("enables manifest capabilities required by generated rich-text content", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()

    const result = await applySiteGenerationSpec(payload, {
      ...spec,
      pages: [
        {
          ...spec.pages[0]!,
          blocks: [
            ...spec.pages[0]!.blocks,
            {
              blockType: "richText",
              body: {
                t: "root",
                variant: "block",
                children: [
                  { t: "themed", id: "eyebrow", props: { text: "Over mij" } },
                  {
                    t: "blockquote",
                    children: [
                      {
                        t: "paragraph",
                        children: [{ t: "text", v: "Jeugdzorg werkt wanneer een jongere zich gezien voelt." }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    } as SiteGenerationSpec)

    expect(result.ok).toBe(true)
    expect(store.tenants[0]!.siteManifest.blockTypes.blockquote).toBe(true)
    expect(store.tenants[0]!.siteManifest.themedNodes).toEqual([
      { id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text", required: true }] },
    ])
  })

  it("upserts generated media refs with filenames and keeps bare paths omitted", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()

    const result = await applySiteGenerationSpec(payload, {
      ...spec,
      settings: {
        ...spec.settings,
        branding: {
          logo: { id: "generated-logo", url: "/logo.png", filename: "logo.png", alt: "Logo" },
          favicon: "/favicon.ico",
        } as any,
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
              designVariant: null,
              image: { id: "generated-hero", url: "/hero.jpg", filename: "hero.jpg", alt: "Hero" },
            } as any,
          ],
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(store.media).toHaveLength(2)
    const heroMedia = store.media.find((media) => media.filename === "hero.jpg")!
    const logoMedia = store.media.find((media) => media.filename === "logo.png")!
    expect(heroMedia).toMatchObject({ tenant: store.tenants[0]!.id, filename: "hero.jpg", alt: "Hero", mimeType: "image/jpeg" })
    expect(logoMedia).toMatchObject({ tenant: store.tenants[0]!.id, filename: "logo.png", alt: "Logo", mimeType: "image/png" })
    expect(store.pages[0]!.seo.ogImage).toBeUndefined()
    expect(store.pages[0]!.blocks[0].image).toBe(heroMedia.id)
    expect(store["site-settings"][0]!.branding.logo).toBe(logoMedia.id)
    expect(store["site-settings"][0]!.branding.favicon).toBeUndefined()
  })

  it("downloads generated media and retries upload when Payload requires a file", async () => {
    const { payload, store, calls } = createPayloadStub()
    const originalCreate = payload.create
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    )
    ;(payload as any).create = async (args: any) => {
      if (args.collection === "media" && !args.filePath) {
        const error = new Error("No files were uploaded.") as Error & { status?: number }
        error.name = "MissingFile"
        error.status = 400
        throw error
      }
      return originalCreate(args)
    }

    try {
      const spec = fixtureSpec()
      const result = await applySiteGenerationSpec(payload, {
        ...spec,
        pages: [
          {
            ...spec.pages[0]!,
            blocks: [
              {
                ...spec.pages[0]!.blocks[0]!,
                designVariant: null,
                image: { id: "generated-hero", url: "https://assets.example/hero.jpg", filename: "hero.jpg", alt: "Hero" },
              } as any,
            ],
          },
        ],
      })

      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith("https://assets.example/hero.jpg")
      expect(store.media).toHaveLength(1)
      expect(store.pages[0]!.blocks[0].image).toBe(store.media[0]!.id)
      const mediaCreate = calls.create.find((call) => call.collection === "media")
      expect(mediaCreate?.filePath).toContain("hero.jpg")
      expect(mediaCreate?.overwriteExistingFiles).toBe(true)
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("rejects inactive provider media for self-serve output before downloads", async () => {
    const { payload, store } = createPayloadStub()
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const spec = fixtureSpec()

    const result = await applySiteGenerationSpec(payload, {
      ...spec,
      pages: [
        {
          ...spec.pages[0]!,
          blocks: [
            {
              ...spec.pages[0]!.blocks[0]!,
              image: { id: "generated-hero", url: "https://assets.example/hero.jpg", filename: "hero.jpg", alt: "Hero" },
            } as any,
          ],
        },
      ],
    }, { variantScope: "self-serve" })

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((issue) => issue.code)).toContain("inactive_slot_value")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.media).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    fetchMock.mockRestore()
  })

  it("accepts generated designVariant without writing legacy visual fields", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      designVariant: "tailwindPlusSimpleCentered",
    } as any
    spec.pages[0]!.blocks = [spec.pages[0]!.blocks[0]!]
    spec.blocks = [{ slug: "hero", label: "Hero" }]

    const result = await applySiteGenerationSpec(payload, spec, { variantScope: "self-serve" })

    expect(result.ok).toBe(true)
    expect(store.pages[0]!.blocks[0]).toMatchObject({
      designVariant: "tailwindPlusSimpleCentered",
    })
    expect(store.pages[0]!.blocks[0]).not.toHaveProperty("variant")
    expect(store.pages[0]!.blocks[0].analytics ?? {}).toEqual({})
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
      designVariant: "tailblocksCtaA",
    } as any

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toContain("unsupported_block_variant")
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects unknown analytics visual identity fields", () => {
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      analytics: { legacyVisualIdentity: "tailwindPlusSimpleCentered" },
    } as any

    const report = validateSiteGenerationSpecForCms(spec)

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toContain("invalid_contract_shape")
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

  it("accepts canonical provider IDs for new self-serve generation while keeping legacy aliases compatible", () => {
    const canonicalSpec = fixtureSpec()
    canonicalSpec.pages[0]!.blocks[0] = {
      ...canonicalSpec.pages[0]!.blocks[0]!,
      designVariant: "tailwindplus.marketing.hero.simple-centered",
    } as any
    canonicalSpec.pages[0]!.blocks[1] = {
      ...canonicalSpec.pages[0]!.blocks[1]!,
      designVariant: "tailwindplus.marketing.contact.centered",
      description: null,
    } as any

    const legacySpec = fixtureSpec()
    legacySpec.pages[0]!.blocks[1] = {
      ...legacySpec.pages[0]!.blocks[1]!,
      designVariant: "tailwindPlusCentered",
      description: null,
    } as any

    expect(validateSiteGenerationSpecForCms(canonicalSpec, { variantScope: "self-serve" }).valid).toBe(true)
    expect(validateSiteGenerationSpecForCms(legacySpec, { variantScope: "self-serve" }).valid).toBe(true)
  })

  it("preserves generated chrome variants and banner settings during apply", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.settings = {
      ...spec.settings,
      chrome: {
        header: {
          variant: "default",
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          cta: { label: "Plan intake", href: "/intake" },
        },
        footer: {
          variant: "default",
          tagline: "Structured draft footer",
          copyright: "© Fixture Care",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [{ id: "main", items: [{ type: "links", label: "Explore", links: [{ label: "Home", href: "/" }] }] }],
        },
        banner: {
          variant: "default",
          visible: true,
          title: "Launch offer",
          message: "Book a free intake this month.",
          link: { label: "Contact", href: "/#contact" },
          dismissible: true,
        },
      },
    }

    const result = await applySiteGenerationSpec(payload, spec)

    expect(result.ok).toBe(true)
    expect(store["site-settings"][0]!.chrome).toMatchObject({
      header: {
        variant: "default",
        behavior: "sticky",
        activeMode: "path",
        mobileMenu: "drawer",
        cta: { label: "Plan intake", href: "/intake" },
      },
      footer: {
        variant: "default",
        tagline: "Structured draft footer",
        legalLinks: [{ label: "Privacy", href: "/privacy" }],
      },
      banner: {
        variant: "default",
        visible: true,
        title: "Launch offer",
        message: "Book a free intake this month.",
        link: { label: "Contact", href: "/#contact" },
        dismissible: true,
      },
    })
  })

  it("rejects inactive provider candidate variants before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.blocks = [
      {
        blockType: "pricing",
        designVariant: "tailwindPlusSimpleTiers",
        title: rtInline("Pakketten"),
        intro: rtBlock("Kies een passend pakket."),
        plans: [{
          title: rtInline("Basis"),
          description: rtBlock("Voor starters."),
          price: "€499",
          period: "eenmalig",
          features: [{ label: rtInline("Een pagina"), included: true }],
          cta: { label: "Start", href: "/intake" },
          badge: "Populair",
          highlighted: true,
        }],
      } as any,
      {
        blockType: "stats",
        designVariant: "tailwindPlusSimple",
        title: rtInline("Resultaten"),
        intro: rtBlock("Meetbare impact."),
        items: [{ value: "24", label: "Projecten", description: rtBlock("Opgeleverd dit jaar.") }],
      } as any,
      {
        blockType: "logoCloud",
        designVariant: "tailwindPlusSimple",
        title: rtInline("Partners"),
        logos: [{ name: "Partner", image: 12, href: "https://example.com" }],
      } as any,
      {
        blockType: "team",
        designVariant: "tailwindPlusGrid",
        title: rtInline("Team"),
        members: [{ name: "Alex", role: "Founder", bio: rtBlock("Helpt klanten groeien."), image: 14, links: [{ label: "LinkedIn", href: "https://example.com" }] }],
      } as any,
      {
        blockType: "blogCards",
        designVariant: "tailwindPlusThreeColumn",
        title: rtInline("Updates"),
        posts: [{ title: rtInline("Nieuwe site"), excerpt: rtBlock("Wat er verbeterde."), image: 15, href: "/blog/nieuwe-site", date: "2026-06-27", author: "Alex", cta: { label: "Lees", href: "/blog/nieuwe-site" } }],
      } as any,
    ]
    spec.blocks = [
      { slug: "pricing", label: "Pricing" },
      { slug: "stats", label: "Stats" },
      { slug: "logoCloud", label: "Logo cloud" },
      { slug: "team", label: "Team" },
      { slug: "blogCards", label: "Blog cards" },
    ]

    const report = validateSiteGenerationSpecForCms(spec)
    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "unresolved_provider_variant",
    ]))

    const result = await applySiteGenerationSpec(payload, spec)
    expect(result.ok).toBe(false)
    expect(store.tenants).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(store["site-settings"]).toHaveLength(0)
  })

  it("rejects tenant-exclusive tenant-exclusive variants for self-serve generated tenants", () => {
    const spec = fixtureSpec()
    spec.settings = {
      ...spec.settings,
      chrome: {
        header: { variant: "amicareZen" },
        footer: { variant: "amicareZen" },
        banner: { variant: "default", visible: false, message: "Preview ready" },
      },
    } as any
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      designVariant: "amicareZenHero",
    } as any

    const report = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "tenant_exclusive_block_variant",
      "tenant_exclusive_chrome_variant",
    ]))
  })

  it("rejects raw HTML, arbitrary class names, and generated source payload fields", async () => {
    const blockedFields = [
      { key: "rawHtml", value: "<section class=\"p-24\">Generated HTML</section>" },
      { key: "html", value: "<div>Generated HTML</div>" },
      { key: "className", value: "bg-red-500 p-[99px]" },
      { key: "classes", value: ["grid", "md:grid-cols-7"] },
      { key: "style", value: { padding: "64px" } },
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

    const blockedStructuredFields = [
      { key: "tokens", value: { spacing: "compact" }, code: "generated_block_visual_tokens" },
      { key: "tokens", value: { className: "p-[99px]", spacing: "compact" } },
      { key: "tokens", value: { nested: { classes: ["grid", "md:grid-cols-7"] } } },
      { key: "metadata", value: { rawHtml: "<div>Generated HTML</div>" } },
      { key: "metadata", value: { nested: { component: "export function GeneratedBlock() { return null }" } } },
      { key: "metadata", value: { sourceCode: "const classes = 'p-24'" } },
      { key: "metadata", value: { filePath: "sites/new-tenant/src/pages/index.tsx" } },
    ]

    for (const field of blockedStructuredFields) {
      const { payload, store } = createPayloadStub()
      const spec = fixtureSpec()
      ;(spec.pages[0]!.blocks[0]! as any)[field.key] = field.value

      const result = await applySiteGenerationSpec(payload, spec)

      expect(result.ok, `${field.key}:${JSON.stringify(field.value)}`).toBe(false)
      expect(result.validation.issues.map((entry) => entry.code), field.key).toContain(field.code ?? "invalid_contract_shape")
      expect(store.tenants, field.key).toHaveLength(0)
      expect(store.pages, field.key).toHaveLength(0)
      expect(store["site-settings"], field.key).toHaveLength(0)
    }
  })
})
