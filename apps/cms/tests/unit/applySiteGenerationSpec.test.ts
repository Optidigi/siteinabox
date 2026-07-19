import { describe, expect, it, vi } from "vitest"
import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { applySiteGenerationSpec, validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { pageToJson } from "@/lib/projection/pageToJson"
import { rtBlock, rtInline } from "../_helpers/rtFixtures"
import { asMockDoc, cast } from "../_helpers/cast"
import { asPayload, docAt, matchesWhere, type CreateArgs, type FindArgs, type MockDoc, type StoredDoc, type UpdateArgs } from "../_helpers/mockPayload"

import { errLike } from "../_helpers/cast"
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
    version: 3,
    appearance: { mode: "light" },
    colors: { schemeId: "blue-professional" },
    fonts: { schemeId: "clear-modern" },
    shape: { schemeId: "soft" },
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
          designVariant: "shadcnui-blocks.hero-01",
          headline: rtInline("Fixture Care"),
          subheadline: rtBlock("Editable CMS draft content."),
          cta: { label: "Contact", href: "#contact" },
        },
        {
          blockType: "contactSection",
          designVariant: "shadcnui-blocks.contact-02",
          anchor: "contact",
          title: rtInline("Contact"),
          formName: "Contact form",
          submitLabel: "Send",
          fields: [
            { name: "first-name", label: "First name", type: "text", required: true },
            { name: "last-name", label: "Last name", type: "text", required: true },
            { name: "company", label: "Company", type: "text" },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone-number", label: "Phone number", type: "tel" },
            { name: "message", label: "Message", type: "textarea", required: true },
          ],
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

type CollectionSlug = "tenants" | "pages" | "site-settings" | "media"
type LocalFindArgs = FindArgs & { collection: CollectionSlug }
type LocalCreateArgs = CreateArgs & { collection: CollectionSlug }
type LocalUpdateArgs = UpdateArgs & { collection: CollectionSlug }

const createPayloadStub = () => {
  let nextId = 1
  const store: Record<CollectionSlug, StoredDoc[]> = {
    tenants: [],
    pages: [],
    "site-settings": [],
    media: [],
  }
  const calls = {
    create: [] as LocalCreateArgs[],
    update: [] as LocalUpdateArgs[],
    find: [] as LocalFindArgs[],
  }
  const payload = {
    find: async (args: LocalFindArgs) => {
      calls.find.push(args)
      const docs = store[args.collection].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: LocalCreateArgs) => {
      calls.create.push(args)
      const doc = { ...args.data, id: nextId++ }
      store[args.collection].push(doc)
      return doc
    },
    update: async (args: LocalUpdateArgs) => {
      calls.update.push(args)
      const docs = store[args.collection]
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const current = docs[index]!
      docs[index] = { ...current, ...args.data, id: current.id }
      return docs[index]!
    },
  }
  return { payload: asPayload(payload), store, calls }
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
    const page = docAt(store.pages)
    const tenant = docAt(store.tenants)
    const settings = docAt(store["site-settings"])
    const siteManifest = tenant.siteManifest as MockDoc
    const headerNav = settings.navHeader as MockDoc[]
    expect(tenant.status).toBe("provisioning")
    expect(page.status).toBe("draft")
    expect(tenant.theme).toEqual({
      version: 3,
      appearance: { mode: "light" },
      colors: { schemeId: "blue-professional" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
    })
    expect((siteManifest.generation as MockDoc).hash).toBe(result.idempotencyKey)
    expect(siteManifest.analyticsConsent).toEqual({
      enabled: true,
      provider: "posthog",
      consentStorageKey: "siab_cookie_consent_v1",
      consentVersion: "2026-07-07.1",
    })
    expect(headerNav[0]).toMatchObject({ type: "page", page: page.id })
    expect(headerNav[1]).toMatchObject({ type: "section", page: page.id, anchor: "contact" })
    expect([...calls.create, ...calls.update].every((call: LocalCreateArgs | LocalUpdateArgs) => call.context?.skipProjection === true)).toBe(true)
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
              blockType: "contentSection",
              designVariant: "shadcnui-blocks.legal-content-01",
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
                  {
                    t: "list",
                    ordered: false,
                    items: [{ t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "Bullet" }] }] }],
                  },
                  {
                    t: "list",
                    ordered: true,
                    items: [{ t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "Ordered" }] }] }],
                  },
                  { t: "divider" },
                ],
              },
            },
          ],
        },
      ],
    } as SiteGenerationSpec)

    expect(result.ok).toBe(true)
    const tenantManifest = docAt(store.tenants).siteManifest as MockDoc
    expect((tenantManifest.blockTypes as MockDoc).blockquote).toBe(true)
    expect((tenantManifest.blockTypes as MockDoc).bulletList).toBe(true)
    expect((tenantManifest.blockTypes as MockDoc).orderedList).toBe(true)
    expect((tenantManifest.blockTypes as MockDoc).divider).toBe(true)
    expect(tenantManifest.themedNodes).toEqual([
      { id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text", required: true }] },
    ])
  })

  it("upserts generated media refs with filenames and keeps bare paths omitted", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    )

    try {
      const result = await applySiteGenerationSpec(payload, {
        ...spec,
        settings: {
          ...spec.settings,
          branding: {
            logo: { id: "generated-logo", url: "https://assets.example/logo.png", filename: "logo.png", alt: "Logo" },
            favicon: "/favicon.ico",
          },
        },
        pages: [
          {
            ...spec.pages[0]!,
            seo: {
              ...spec.pages[0]!.seo,
              ogImage: "/og-default.png",
            },
            blocks: [
              spec.pages[0]!.blocks[0]!,
              {
                blockType: "gallery",
                designVariant: "shadcnui-blocks.carousel-block-01",
                images: [
                  { image: { id: "generated-hero", url: "https://assets.example/hero.jpg", filename: "hero.jpg", alt: "Hero" } },
                  { image: { id: "generated-logo", url: "https://assets.example/logo.png", filename: "logo.png", alt: "Logo" } },
                ],
              },
            ],
          },
        ],
      })

      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(store.media).toHaveLength(2)
      const heroMedia = store.media.find((media) => media.filename === "hero.jpg")!
      const logoMedia = store.media.find((media) => media.filename === "logo.png")!
      expect(heroMedia).toMatchObject({ tenant: store.tenants[0]!.id, filename: "hero.jpg", alt: "Hero", mimeType: "image/jpeg" })
      expect(logoMedia).toMatchObject({ tenant: store.tenants[0]!.id, filename: "logo.png", alt: "Logo", mimeType: "image/png" })
      expect(asMockDoc(store.pages[0]).seo).toMatchObject({ ogImage: undefined })
      expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[1]!.images).toEqual([
        { image: heroMedia.id },
        { image: logoMedia.id },
      ])
      expect(asMockDoc(asMockDoc(store["site-settings"][0]).branding).logo).toBe(logoMedia.id)
      expect(asMockDoc(asMockDoc(store["site-settings"][0]).branding).favicon).toBeUndefined()
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("downloads generated media and retries upload when Payload requires a file", async () => {
    const { payload: basePayload, store, calls } = createPayloadStub()
    const originalCreate = basePayload.create.bind(basePayload)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    )
    const payload = asPayload({
      find: basePayload.find.bind(basePayload),
      update: basePayload.update.bind(basePayload),
      create: async (args: LocalCreateArgs) => {
        if (args.collection === "media" && !args.filePath) {
          const error = new Error("No files were uploaded.") as Error & { status?: number }
          error.name = "MissingFile"
          error.status = 400
          throw error
        }
        return originalCreate(args)
      },
    })

    try {
      const spec = fixtureSpec()
      const result = await applySiteGenerationSpec(payload, {
        ...spec,
        pages: [
          {
            ...spec.pages[0]!,
            blocks: [
              {
                blockType: "gallery",
                designVariant: "shadcnui-blocks.carousel-block-01",
                images: [{ image: { id: "generated-hero", url: "https://assets.example/hero.jpg", filename: "hero.jpg", alt: "Hero" } }],
              },
            ],
          },
        ],
      })

      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith("https://assets.example/hero.jpg")
      expect(store.media).toHaveLength(1)
      expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]!.images).toEqual([{ image: store.media[0]!.id }])
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
            cast({
              ...spec.pages[0]!.blocks[1]!,
              backgroundImage: { id: "generated-contact", url: "https://assets.example/contact.jpg", filename: "contact.jpg", alt: "Contact" },
            }),
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

  it("canonicalizes empty CTA link groups before CMS persistence", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.blocks = [{
      blockType: "cta",
      designVariant: "shadcnui-blocks.cta-03",
      headline: rtInline("Contact"),
      primary: { label: "Contact", href: "#contact" },
      secondary: {},
    }]
    spec.blocks = [{ slug: "cta", label: "CTA" }]

    const result = await applySiteGenerationSpec(payload, spec, { variantScope: "self-serve" })

    expect(result.ok).toBe(true)
    expect(asMockDoc(store.pages[0]).blocks).toBeDefined()
    expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]).not.toHaveProperty("secondary")
    expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]).toMatchObject({ primary: { label: "Contact", href: "#contact" } })
  })

  it("accepts generated designVariant without writing legacy visual fields", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = cast<SiteGenerationSpec["pages"][number]["blocks"][number]>({
      ...spec.pages[0]!.blocks[0]!,
      designVariant: "shadcnui-blocks.hero-02",
      eyebrow: undefined,
      subheadline: rtBlock("Editable CMS draft content."),
      cta: undefined,
      secondary: undefined,
    })
    spec.pages[0]!.blocks = [spec.pages[0]!.blocks[0]!]
    spec.blocks = [{ slug: "hero", label: "Hero" }]

    const result = await applySiteGenerationSpec(payload, spec, { variantScope: "self-serve" })

    expect(result.ok).toBe(true)
    expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]).toMatchObject({
      designVariant: "shadcnui-blocks.hero-02",
    })
    expect((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]).not.toHaveProperty("variant")
    expect(asMockDoc((asMockDoc(store.pages[0]).blocks as MockDoc[])[0]).analytics ?? {}).toEqual({})
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
            cast({
              ...spec.pages[0]!.blocks[0]!,
              blockType: "pricingTable",
            }),
          ],
        },
      ],
      blocks: [{ slug: cast("pricingTable"), label: "Pricing" }],
    })

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["unsupported_block_type", "unsupported_manifest_block_slug"]),
    )
  })

  it("rejects missing required block fields before mutating CMS state", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    delete (spec.pages[0]!.blocks[0]! as Record<string, unknown>).headline

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
    ;(spec.pages[0]!.blocks[0]! as Record<string, unknown>).headline = {
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
    spec.theme = cast({
      ...spec.theme,
      colors: {
        ...(asMockDoc(spec.theme).colors as Record<string, unknown>),
        accent: "not-a-color",
      },
    })

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
      designVariant: "unknown-provider.cta-01",
    }

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
      analytics: cast({ legacyVisualIdentity: "retired-provider-alias" }),
    }

    const report = validateSiteGenerationSpecForCms(spec)

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toContain("invalid_contract_shape")
  })

  it("allows canonical generated block source metadata", () => {
    const spec = fixtureSpec()
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      source: "ai",
    }

    const report = validateSiteGenerationSpecForCms(spec)

    expect(report.valid).toBe(true)
  })

  it("requires canonical provider IDs in every generation scope", () => {
    const canonicalSpec = fixtureSpec()
    canonicalSpec.pages[0]!.blocks[0] = cast<SiteGenerationSpec["pages"][number]["blocks"][number]>({
      ...canonicalSpec.pages[0]!.blocks[0]!,
      designVariant: "shadcnui-blocks.hero-02",
      eyebrow: undefined,
      subheadline: rtBlock("Editable CMS draft content."),
      cta: undefined,
      secondary: undefined,
    })
    canonicalSpec.pages[0]!.blocks = [canonicalSpec.pages[0]!.blocks[0]!]
    canonicalSpec.blocks = [{ slug: "hero", label: "Hero" }]

    const legacySpec = fixtureSpec()
    legacySpec.pages[0]!.blocks[0] = cast<SiteGenerationSpec["pages"][number]["blocks"][number]>({
      ...canonicalSpec.pages[0]!.blocks[0]!,
      designVariant: cast("retired-provider.hero"),
    })
    legacySpec.pages[0]!.blocks = [legacySpec.pages[0]!.blocks[0]!]
    legacySpec.blocks = [{ slug: "hero", label: "Hero" }]

    const canonicalReport = validateSiteGenerationSpecForCms(canonicalSpec, { variantScope: "self-serve" })
    expect(canonicalReport.issues).toEqual([])
    expect(validateSiteGenerationSpecForCms(legacySpec, { variantScope: "self-serve" }).valid).toBe(false)
    expect(validateSiteGenerationSpecForCms(legacySpec, { variantScope: "tenant-aware" }).valid).toBe(false)
  })

  it("preserves generated chrome variants and banner settings during apply", async () => {
    const { payload, store } = createPayloadStub()
    const spec = fixtureSpec()
    spec.settings = {
      ...spec.settings,
      chrome: {
        header: {
          variant: "shadcnui-blocks.navbar-01",
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          cta: { label: "Plan intake", href: "/intake" },
        },
        footer: {
          variant: "shadcnui-blocks.footer-01",
          tagline: "Structured draft footer",
          copyright: "© Fixture Care",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [{ id: "main", items: [{ type: "links", label: "Explore", links: [{ label: "Home", href: "/" }] }] }],
        },
        banner: {
          variant: "shadcnui-blocks.banner-01",
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
        variant: "shadcnui-blocks.navbar-01",
        behavior: "sticky",
        activeMode: "path",
        mobileMenu: "drawer",
        cta: { label: "Plan intake", href: "/intake" },
      },
      footer: {
        variant: "shadcnui-blocks.footer-01",
        tagline: "Structured draft footer",
        legalLinks: [{ label: "Privacy", href: "/privacy" }],
      },
      banner: {
        variant: "shadcnui-blocks.banner-01",
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
        designVariant: "shadcnui-blocks.pricing-01",
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
      },
      {
        blockType: "stats",
        designVariant: "shadcnui-blocks.stats-01",
        title: rtInline("Resultaten"),
        intro: rtBlock("Meetbare impact."),
        items: [{ value: "24", label: "Projecten", description: rtBlock("Opgeleverd dit jaar.") }],
      },
      {
        blockType: "logoCloud",
        designVariant: "shadcnui-blocks.testimonials-01",
        title: rtInline("Partners"),
        logos: [{ name: "Partner", image: 12, href: "https://example.com" }],
      },
      {
        blockType: "team",
        designVariant: "shadcnui-blocks.team-01",
        title: rtInline("Team"),
        members: [{ name: "Alex", role: "Founder", bio: rtBlock("Helpt klanten groeien."), image: 14, links: [{ label: "LinkedIn", href: "https://example.com" }] }],
      },
      {
        blockType: "blogCards",
        designVariant: "shadcnui-blocks.blog-01",
        title: rtInline("Updates"),
        posts: [{ title: rtInline("Nieuwe site"), excerpt: rtBlock("Wat er verbeterde."), image: 15, href: "/blog/nieuwe-site", date: "2026-06-27", author: "Alex", cta: { label: "Lees", href: "/blog/nieuwe-site" } }],
      },
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

  it("rejects retired tenant-specific variants for generated tenants", () => {
    const spec = fixtureSpec()
    spec.settings = {
      ...spec.settings,
      chrome: {
        header: { variant: cast("amicareZen") },
        footer: { variant: cast("amicareZen") },
        banner: { variant: "shadcnui-blocks.banner-01", visible: false, message: "Preview ready" },
      },
    }
    spec.pages[0]!.blocks[0] = {
      ...spec.pages[0]!.blocks[0]!,
      designVariant: cast("amicareZenHero"),
    }

    const report = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })

    expect(report.valid).toBe(false)
    expect(report.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "invalid_contract_shape",
      "unsupported_block_variant",
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
      ;(spec.pages[0]!.blocks[0]! as Record<string, unknown>)[field.key] = field.value

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
      ;(spec.pages[0]!.blocks[0]! as Record<string, unknown>)[field.key] = field.value

      const result = await applySiteGenerationSpec(payload, spec)

      expect(result.ok, `${field.key}:${JSON.stringify(field.value)}`).toBe(false)
      expect(result.validation.issues.map((entry) => entry.code), field.key).toContain(field.code ?? "invalid_contract_shape")
      expect(store.tenants, field.key).toHaveLength(0)
      expect(store.pages, field.key).toHaveLength(0)
      expect(store["site-settings"], field.key).toHaveLength(0)
    }
  })
})
