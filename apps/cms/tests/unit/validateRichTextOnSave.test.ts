import { describe, expect, it, vi } from "vitest"
import { cast } from "../_helpers/cast"
import { hookArgsFor } from "../_helpers/hookFixtures"
import type { PayloadRequest } from "payload"
import { validateRichTextOnSave } from "@/hooks/validateRichTextOnSave"
import type { RtManifest } from "@/lib/richText/manifest"

const manifest: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2] } },
}

vi.mock("@/lib/richText/loadManifest", () => ({
  loadTenantManifest: vi.fn(async () => manifest),
}))

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

const runHook = (blocks: unknown[]) =>
  validateRichTextOnSave(hookArgsFor(validateRichTextOnSave, {
    data: { tenant: 1, blocks },
    originalDoc: undefined,
    req: cast<PayloadRequest>({}),
  }))

describe("validateRichTextOnSave", () => {
  it("validates nested FeatureList rich-text array fields", async () => {
    await expect(runHook([{
      blockType: "featureList",
      title: inlineRoot("Features"),
      intro: blockRoot("Intro"),
      features: [{
        title: { arbitrary: "jsonb" },
        description: blockRoot("Description"),
      }],
    }])).rejects.toThrow(/blocks\[0\]\.features\[0\]\.title/i)

    await expect(runHook([{
      blockType: "featureList",
      title: inlineRoot("Features"),
      intro: blockRoot("Intro"),
      features: [{
        title: inlineRoot("Feature"),
        description: inlineRoot("Wrong variant"),
      }],
    }])).rejects.toThrow(/blocks\[0\]\.features\[0\]\.description: variant must be "block"/i)
  })

  it("validates nested FAQ rich-text array fields", async () => {
    await expect(runHook([{
      blockType: "faq",
      title: inlineRoot("FAQ"),
      items: [{
        question: blockRoot("Wrong variant"),
        answer: blockRoot("Answer"),
      }],
    }])).rejects.toThrow(/blocks\[0\]\.items\[0\]\.question: variant must be "inline"/i)

    await expect(runHook([{
      blockType: "faq",
      title: inlineRoot("FAQ"),
      items: [{
        question: inlineRoot("Question"),
        answer: {
          t: "root",
          variant: "block",
          children: [{ t: "heading", level: 3, children: [{ t: "text", v: "Nope" }] }],
        },
      }],
    }])).rejects.toThrow(/blocks\[0\]\.items\[0\]\.answer: root\[0\]: heading level 3/i)
  })

  it("accepts valid nested rich-text fields", async () => {
    await expect(runHook([{
      blockType: "featureList",
      title: inlineRoot("Features"),
      intro: blockRoot("Intro"),
      features: [{
        title: inlineRoot("Feature"),
        description: blockRoot("Description"),
      }],
    }, {
      blockType: "faq",
      title: inlineRoot("FAQ"),
      items: [{
        question: inlineRoot("Question"),
        answer: blockRoot("Answer"),
      }],
    }])).resolves.toMatchObject({ tenant: 1 })
  })
})
