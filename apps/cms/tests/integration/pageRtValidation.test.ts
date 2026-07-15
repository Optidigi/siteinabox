import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantId: string | number

const uniq = `${Date.now()}-${Math.floor(Math.random() * 100000)}`

const inlineRoot = (text = "hi") => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockRoot = (text = "hi") => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

beforeAll(async () => {
  payload = await getTestPayload()
  const t = await payload.create({
    collection: "tenants",
    data: {
      name: "RT Validation Test", slug: `rtv-${uniq}`, domain: `rtv-${uniq}.test`,
      siteManifest: {
        version: 1,
        inlineMarks: { bold: true, italic: true },
        blockTypes: { paragraph: true, heading: { levels: [2] } },
        themedNodes: [{ id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text", required: true }] }],
      },
    } as any,
    overrideAccess: true,
  })
  tenantId = (t as any).id
})

afterAll(async () => {
  if (tenantId) await payload.delete({ collection: "tenants", id: tenantId as any, overrideAccess: true })
})

describe("Pages rich-text save validation", () => {
  it("accepts a valid RtNode body", async () => {
    const p = await payload.create({
      collection: "pages",
      data: {
        title: "Valid", slug: `valid-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
          t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "hi" }] }],
        }}],
      } as any,
      overrideAccess: true,
    })
    expect((p as any).id).toBeTruthy()
    await payload.delete({ collection: "pages", id: (p as any).id, overrideAccess: true })
  })

  it("rejects arbitrary jsonb (not RtRoot shape)", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad", slug: `bad-shape-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: { arbitrary: "jsonb" } }],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/rich text/i)
  })

  it("rejects block-shape root in an inline field", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad", slug: `bad-variant-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "hero", designVariant: "shadcnui-blocks.hero-01", headline: {
          t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "x" }] }],
        }}],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/variant must be "inline"/i)
  })

  it("rejects a themed node id not in the manifest", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad", slug: `bad-themed-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
          t: "root", variant: "block",
          children: [{ t: "themed", id: "notInManifest", props: {} }],
        }}],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/notInManifest/i)
  })

  it("rejects a heading level not in the manifest", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad", slug: `bad-h-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
          t: "root", variant: "block",
          children: [{ t: "heading", level: 3, children: [{ t: "text", v: "h" }] }],
        }}],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/heading level 3/i)
  })

  it("rejects arbitrary jsonb on PATCH that omits tenant field", async () => {
    // First: create a valid page
    const valid = await payload.create({
      collection: "pages",
      data: {
        title: "Valid for PATCH", slug: `valid-patch-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
          t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "hi" }] }],
        }}],
      } as any,
      overrideAccess: true,
    })
    const validId = (valid as any).id

    // Then: PATCH with malicious blocks and NO tenant field — should still be rejected
    await expect(payload.update({
      collection: "pages",
      id: validId as any,
      data: { blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: { arbitrary: "jsonb" } }] } as any,
      overrideAccess: true,
    })).rejects.toThrow(/rich text/i)

    // Cleanup
    await payload.delete({ collection: "pages", id: validId, overrideAccess: true })
  })

  it("rejects a themed node id not in the manifest on PATCH that omits tenant field", async () => {
    const valid = await payload.create({
      collection: "pages",
      data: {
        title: "Valid for themed PATCH", slug: `valid-themed-patch-${uniq}`, status: "draft", tenant: tenantId,
        blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
          t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "hi" }] }],
        }}],
      } as any,
      overrideAccess: true,
    })
    const validId = (valid as any).id

    await expect(payload.update({
      collection: "pages",
      id: validId as any,
      data: { blocks: [{ blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", body: {
        t: "root", variant: "block",
        children: [{ t: "themed", id: "notInManifest", props: {} }],
      }}] } as any,
      overrideAccess: true,
    })).rejects.toThrow(/notInManifest/i)

    await payload.delete({ collection: "pages", id: validId, overrideAccess: true })
  })

  it("rejects invalid nested FeatureList rich-text fields", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad nested feature title",
        slug: `bad-feature-title-${uniq}`,
        status: "draft",
        tenant: tenantId,
        blocks: [{
          blockType: "featureList",
          designVariant: "shadcnui-blocks.features-01",
          title: inlineRoot("Features"),
          intro: blockRoot("Intro"),
          features: [{
            title: { arbitrary: "jsonb" },
            description: blockRoot("Description"),
            icon: "check-circle",
          }],
        }],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/blocks\[0\]\.features\[0\]\.title/i)

    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad nested feature description",
        slug: `bad-feature-description-${uniq}`,
        status: "draft",
        tenant: tenantId,
        blocks: [{
          blockType: "featureList",
          designVariant: "shadcnui-blocks.features-01",
          title: inlineRoot("Features"),
          intro: blockRoot("Intro"),
          features: [{
            title: inlineRoot("Feature"),
            description: inlineRoot("Wrong variant"),
            icon: "check-circle",
          }],
        }],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/blocks\[0\]\.features\[0\]\.description: variant must be "block"/i)
  })

  it("rejects invalid nested FAQ rich-text fields", async () => {
    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad nested FAQ question",
        slug: `bad-faq-question-${uniq}`,
        status: "draft",
        tenant: tenantId,
        blocks: [{
          blockType: "faq",
          designVariant: "shadcnui-blocks.faq-01",
          title: inlineRoot("FAQ"),
          items: [{
            question: blockRoot("Wrong variant"),
            answer: blockRoot("Answer"),
          }],
        }],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/blocks\[0\]\.items\[0\]\.question: variant must be "inline"/i)

    await expect(payload.create({
      collection: "pages",
      data: {
        title: "Bad nested FAQ answer",
        slug: `bad-faq-answer-${uniq}`,
        status: "draft",
        tenant: tenantId,
        blocks: [{
          blockType: "faq",
          designVariant: "shadcnui-blocks.faq-01",
          title: inlineRoot("FAQ"),
          items: [{
            question: inlineRoot("Question"),
            answer: {
              t: "root",
              variant: "block",
              children: [{ t: "heading", level: 3, children: [{ t: "text", v: "Nope" }] }],
            },
          }],
        }],
      } as any,
      overrideAccess: true,
    })).rejects.toThrow(/blocks\[0\]\.items\[0\]\.answer: root\[0\]: heading level 3/i)
  })
})
