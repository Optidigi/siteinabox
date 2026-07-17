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

const validSamplesByType = {
  "renderer.ready": {
    ...baseMessage,
    type: "renderer.ready",
    rendererId: "renderer_1",
  },
  "page.replace": {
    ...baseMessage,
    type: "page.replace",
    expectedRevision: 1,
    pageId: "home",
    page: samplePage,
  },
  "theme.patch": {
    ...baseMessage,
    type: "theme.patch",
    theme: null,
  },
  "selection.set": {
    ...baseMessage,
    type: "selection.set",
    selection: { pageId: "home", blockId: "block_1" },
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
  "editor.mobileMode.set": {
    ...baseMessage,
    type: "editor.mobileMode.set",
    mode: "focusedSection",
    focusedBlockId: "block_1",
    focusedBlockIndex: 0,
    showChrome: false,
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
    for (const type of ["block.patch", "blocks.reorder", "geometry.changed", "field.commit", "editor.view.set"]) {
      expect(IframeEditorMessageSchema.safeParse({ ...baseMessage, type }).success, type).toBe(false)
    }
  })

  it("rejects wrong protocol versions", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...validSamplesByType["renderer.ready"],
      schemaVersion: 1,
    }).success).toBe(false)
  })

  it("rejects stale page revisions", () => {
    const result = validateIframeEditorMessage({
      ...validSamplesByType["page.replace"],
      expectedRevision: 4,
    }, { currentRevision: 5 })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues).toContainEqual({
      path: ["expectedRevision"],
      message: "Stale revision 4; expected 5",
    })
  })

  it("keeps theme updates independent from the page revision stream", () => {
    const result = validateIframeEditorMessage({
      ...baseMessage,
      type: "theme.patch",
      theme: {
        version: 3,
        appearance: { mode: "light" },
        colors: { schemeId: "blue-professional" },
        fonts: { schemeId: "clear-modern" },
        shape: { schemeId: "soft" },
      },
    }, { currentRevision: 9 })

    expect(result.ok).toBe(true)
  })

  it("rejects unvalidated page contracts", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...validSamplesByType["page.replace"],
      page: { ...samplePage, blocks: [{ blockType: "unknown" }] },
    }).success).toBe(false)
  })
})
