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

const revisioned = {
  ...baseMessage,
  expectedRevision: 1,
}

const sampleBlock = {
  id: "block_1",
  blockType: "richText",
  body: {
    t: "root",
    variant: "block",
    children: [{
      t: "paragraph",
      children: [{ t: "text", v: "Hello" }],
    }],
  },
}

const samplePage = {
  title: "Home",
  slug: "index",
  status: "published",
  blocks: [sampleBlock],
  updatedAt: "2026-07-02T00:00:00.000Z",
}

const validSamplesByType = {
  "renderer.ready": {
    ...baseMessage,
    type: "renderer.ready",
    rendererId: "renderer_1",
    revision: 2,
  },
  "renderer.ack": {
    ...baseMessage,
    type: "renderer.ack",
    acknowledgedMessageId: "msg_0",
    revision: 2,
  },
  "renderer.reject": {
    ...baseMessage,
    type: "renderer.reject",
    rejectedMessageId: "msg_0",
    code: "stale_revision",
    message: "Stale revision",
    recoverable: true,
  },
  "page.replace": {
    ...revisioned,
    type: "page.replace",
    pageId: "home",
    page: samplePage,
  },
  "theme.patch": {
    ...revisioned,
    type: "theme.patch",
    theme: null,
  },
  "block.patch": {
    ...revisioned,
    type: "block.patch",
    pageId: "home",
    blockId: "block_1",
    patch: { title: "Updated" },
  },
  "blocks.reorder": {
    ...revisioned,
    type: "blocks.reorder",
    pageId: "home",
    blockIds: ["block_1"],
  },
  "blocks.insert": {
    ...revisioned,
    type: "blocks.insert",
    pageId: "home",
    block: sampleBlock,
    index: 0,
  },
  "blocks.delete": {
    ...revisioned,
    type: "blocks.delete",
    pageId: "home",
    blockId: "block_1",
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
  "selection.scrollIntoView": {
    ...baseMessage,
    type: "selection.scrollIntoView",
    selection: { pageId: "home", blockId: "block_1" },
    behavior: "smooth",
    block: "nearest",
  },
  "selection.pulsed": {
    ...baseMessage,
    type: "selection.pulsed",
    selection: { pageId: "home", blockId: "block_1" },
    pulseId: "pulse_1",
    durationMs: 800,
  },
  "geometry.changed": {
    ...baseMessage,
    type: "geometry.changed",
    pageId: "home",
    revision: 1,
    viewport: { width: 1280, height: 720 },
    blocks: [{ blockId: "block_1", rect: { x: 0, y: 0, width: 100, height: 200 } }],
  },
  "field.input": {
    ...revisioned,
    type: "field.input",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
    value: "Draft",
  },
  "field.commit": {
    ...revisioned,
    type: "field.commit",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
    value: "Committed",
  },
  "field.focus": {
    ...baseMessage,
    type: "field.focus",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
  },
  "field.blur": {
    ...baseMessage,
    type: "field.blur",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
  },
  "viewport.resize": {
    ...baseMessage,
    type: "viewport.resize",
    width: 1280,
    height: 720,
  },
  "asset.pickRequested": {
    ...baseMessage,
    type: "asset.pickRequested",
    requestId: "asset_1",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "image"],
  },
  "asset.picked": {
    ...revisioned,
    type: "asset.picked",
    requestId: "asset_1",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "image"],
    asset: { id: "media_1", url: "/media/image.jpg", alt: "Image" },
  },
  "asset.cancelled": {
    ...baseMessage,
    type: "asset.cancelled",
    requestId: "asset_1",
    reason: "user",
  },
  "edit.start": {
    ...revisioned,
    type: "edit.start",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
    mode: "text",
  },
  "edit.cancel": {
    ...revisioned,
    type: "edit.cancel",
    pageId: "home",
    blockId: "block_1",
    fieldPath: ["blocks", "0", "title"],
    reason: "escape",
  },
  "chrome.select": {
    ...baseMessage,
    type: "chrome.select",
    selection: { pageId: "home", fieldPath: ["chrome", "header"] },
    point: { x: 320, y: 48 },
  },
  "chrome.patchRequested": {
    ...revisioned,
    type: "chrome.patchRequested",
    pageId: "home",
    blockId: "chrome:footer",
    patch: { tagline: "Updated" },
  },
  "editor.view.set": {
    ...baseMessage,
    type: "editor.view.set",
    view: "canvas",
  },
  "editor.mobileMode.set": {
    ...baseMessage,
    type: "editor.mobileMode.set",
    mode: "focusedSection",
    focusedBlockId: "block_1",
    focusedBlockIndex: 0,
    showChrome: false,
    showGutters: false,
    allowInlineEditing: false,
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

describe("iframe editor message protocol", () => {
  it("validates every declared message type", () => {
    expect(Object.keys(validSamplesByType).sort()).toEqual([...IFRAME_EDITOR_MESSAGE_TYPES].sort())
    for (const type of IFRAME_EDITOR_MESSAGE_TYPES) {
      expect(IframeEditorMessageSchema.safeParse(validSamplesByType[type]).success, type).toBe(true)
    }
  })

  it("accepts a valid renderer.ready message", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "renderer.ready",
      rendererId: "renderer_1",
      revision: 2,
      pageId: "home",
      capabilities: { selection: true, fieldEditing: true },
    }).success).toBe(true)
  })

  it("accepts chrome.select messages for site chrome targeting", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "chrome.select",
      selection: { pageId: "home", fieldPath: ["chrome", "header"] },
      point: { x: 120, y: 32 },
    }).success).toBe(true)
  })

  it("accepts editor.view.set messages for canvas/sidebar mode sync", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "editor.view.set",
      view: "canvas",
    }).success).toBe(true)
  })

  it("accepts editor.mobileMode.set messages for focused mobile section mode", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "editor.mobileMode.set",
      mode: "focusedSection",
      focusedBlockId: "block_1",
      focusedBlockIndex: 0,
      showChrome: false,
      showGutters: false,
      allowInlineEditing: false,
    }).success).toBe(true)
  })

  it("rejects unknown message types", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "renderer.loaded",
      rendererId: "renderer_1",
      revision: 2,
    }).success).toBe(false)
  })

  it("rejects wrong protocol versions", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      schemaVersion: 2,
      type: "viewport.resize",
      width: 1280,
      height: 720,
    }).success).toBe(false)
  })

  it("rejects stale revisions for revisioned messages", () => {
    const result = validateIframeEditorMessage({
      ...baseMessage,
      type: "block.patch",
      expectedRevision: 4,
      pageId: "home",
      blockId: "hero_1",
      patch: { variant: "split" },
    }, { currentRevision: 5 })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues).toContainEqual({
      path: ["expectedRevision"],
      message: "Stale revision 4; expected 5",
    })
  })

  it("accepts theme.patch even when revision is stale", () => {
    const result = validateIframeEditorMessage({
      ...baseMessage,
      type: "theme.patch",
      expectedRevision: 2,
      theme: { colors: { accent: "#112233" } },
    }, { currentRevision: 9 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message.type).toBe("theme.patch")
    }
  })

  it("rejects missing required ids and field paths", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "field.commit",
      expectedRevision: 7,
      pageId: "home",
      blockId: "",
      fieldPath: [],
      value: "Updated headline",
    }).success).toBe(false)
  })

  it("rejects structured patches carrying HTML or source payload keys", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "block.patch",
      expectedRevision: 7,
      pageId: "home",
      blockId: "hero_1",
      patch: {
        headline: { rawHtml: "<strong>Unsafe</strong>" },
      },
    }).success).toBe(false)
  })

  it("rejects insert messages without a valid block type", () => {
    expect(IframeEditorMessageSchema.safeParse({
      ...baseMessage,
      type: "blocks.insert",
      expectedRevision: 7,
      pageId: "home",
      block: {
        id: "block_1",
        blockType: "unknown",
      },
      index: 0,
    }).success).toBe(false)
  })
})
