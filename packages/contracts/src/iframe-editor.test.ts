import { describe, expect, it } from "vitest"
import {
  IFRAME_EDITOR_MESSAGE_TYPES,
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  IframeEditorMessageSchema,
  validateIframeEditorMessage,
} from "./iframe-editor"

const baseMessage = {
  protocol: IFRAME_EDITOR_PROTOCOL_NAME,
  schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
  messageId: "msg_1",
}

const samplePage = {
  title: "Home",
  slug: "index",
  status: "published",
  blocks: [{
    id: "block_1",
    blockType: "contentSection",
    designVariant: "shadcnui-blocks.legal-content-01",
    title: { t: "root", variant: "inline", children: [{ t: "text", v: "About" }] },
    body: {
      t: "root",
      variant: "block",
      children: [{ t: "paragraph", children: [{ t: "text", v: "Hello" }] }],
    },
  }],
  updatedAt: "2026-07-02T00:00:00.000Z",
}

const sampleSettings = {
  siteName: "Example",
  siteUrl: "https://example.invalid",
  language: "en",
  chrome: {
    header: { variant: "shadcnui-blocks.navbar-01" },
    footer: { variant: "shadcnui-blocks.footer-01" },
  },
}

const validSamplesByType = {
  "renderer.ready": {
    ...baseMessage,
    type: "renderer.ready",
    rendererId: "renderer_1",
  },
  "renderer.height": {
    ...baseMessage,
    type: "renderer.height",
    height: 2400,
  },
  "render.snapshot": {
    ...baseMessage,
    type: "render.snapshot",
    expectedRevision: 1,
    pageId: "home",
    page: samplePage,
    settings: sampleSettings,
    theme: null,
    selection: { pageId: "home", blockId: "block_1" },
    mobileMode: {
      mode: "focusedSection",
      focusedBlockId: "block_1",
      focusedBlockIndex: 0,
      showChrome: false,
    },
  },
  "selection.changed": {
    ...baseMessage,
    type: "selection.changed",
    selection: { pageId: "home", blockId: "block_1" },
  },
  "chrome.select": {
    ...baseMessage,
    type: "chrome.select",
    selection: { pageId: "home", fieldPath: ["chrome", "header"] },
  },
  "navigation.requested": {
    ...baseMessage,
    type: "navigation.requested",
    href: "/contact",
    reason: "linkClick",
  },
  error: {
    ...baseMessage,
    type: "error",
    code: "render_failed",
    message: "Renderer failed",
  },
} satisfies Record<(typeof IFRAME_EDITOR_MESSAGE_TYPES)[number], unknown>

describe("iframe renderer protocol", () => {
  it("validates every declared message type", () => {
    expect(Object.keys(validSamplesByType).sort()).toEqual([...IFRAME_EDITOR_MESSAGE_TYPES].sort())
    for (const type of IFRAME_EDITOR_MESSAGE_TYPES) {
      expect(IframeEditorMessageSchema.safeParse(validSamplesByType[type]).success, type).toBe(true)
    }
  })

  it("rejects removed mutation and canvas messages", () => {
    for (const type of [
      "block.patch",
      "blocks.reorder",
      "geometry.changed",
      "field.commit",
      "editor.view.set",
      "page.replace",
      "theme.patch",
      "selection.set",
      "editor.mobileMode.set",
    ]) {
      expect(IframeEditorMessageSchema.safeParse({ ...baseMessage, type }).success, type).toBe(false)
    }
  })

  it("rejects wrong protocol versions", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...validSamplesByType["renderer.ready"],
      schemaVersion: 2,
    }).success).toBe(false)
  })

  it("rejects stale render snapshot revisions", () => {
    const result = validateIframeEditorMessage({
      ...validSamplesByType["render.snapshot"],
      expectedRevision: 4,
    }, { currentRevision: 5 })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues).toContainEqual({
      path: ["expectedRevision"],
      message: "Stale revision 4; expected >= 5",
    })
  })

  it("accepts render snapshots at the current revision", () => {
    const result = validateIframeEditorMessage({
      ...validSamplesByType["render.snapshot"],
      expectedRevision: 5,
    }, { currentRevision: 5 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message.type).toBe("render.snapshot")
    }
  })

  it("accepts render snapshots ahead of the frame revision so remounts can resync", () => {
    const result = validateIframeEditorMessage({
      ...validSamplesByType["render.snapshot"],
      expectedRevision: 7,
    }, { currentRevision: 0 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message.type).toBe("render.snapshot")
    }
  })

  it("accepts preview snapshots without editor-only fields", () => {
    const result = IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "render.snapshot",
      expectedRevision: 0,
      pageId: "home",
      page: samplePage,
      settings: sampleSettings,
      theme: null,
    })

    expect(result.success).toBe(true)
  })

  it("rejects unvalidated page contracts", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...validSamplesByType["render.snapshot"],
      page: { ...samplePage, blocks: [{ blockType: "unknown" }] },
    }).success).toBe(false)
  })
})
