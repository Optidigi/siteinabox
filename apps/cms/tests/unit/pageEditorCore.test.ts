import { describe, expect, it } from "vitest"
import type { ElementPath } from "@/components/editor/elementPath"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import {
  aggregatePageEditorDirty,
  buildPageDraftKey,
  countPageEditorDirtyLeaves,
  createPageEditorSchema,
  deriveChromeDirty,
  deriveNavDirty,
  deriveThemeDirty,
  editorAppendBlock,
  editorCloneBlockAt,
  editorInsertBlockAt,
  editorRemoveBlock,
  editorReorderBlocks,
  isPageDraftStaleAgainstServer,
  mergeRestoredChromeDraft,
  pageEditorDefaultValues,
  pageEditorHasRecoverableDraftWork,
  selectChromeZone,
  selectElementPath,
} from "@/lib/editor/pageEditorCore"
import type { PageEditorDraft } from "@/lib/editor/pageDraftStore"
import type { SiteChromeDraft } from "@/lib/siteChromeDraft"
import type { ThemeTokens } from "@/lib/theme/schema"

const hero = (id: string): EditorBlock =>
  ({ id, blockType: "hero", headline: { t: "root", variant: "block", children: [] } }) as EditorBlock

const emptyChromeDraft = (): SiteChromeDraft => ({
  header: { logo: null },
  footer: {
    logo: null,
    tagline: null,
    copyright: null,
    columns: [],
  },
})

describe("buildPageDraftKey", () => {
  it("encodes tenant, page id, and base href", () => {
    expect(buildPageDraftKey(12, { id: 34 } as never, "/t/acme/pages")).toBe(
      "page:12:34:%2Ft%2Facme%2Fpages",
    )
    expect(buildPageDraftKey("t-1", undefined, "/pages")).toBe("page:t-1:new:%2Fpages")
  })
})

describe("isPageDraftStaleAgainstServer", () => {
  const draft = (savedAt: number): PageEditorDraft => ({
    version: 1,
    key: "k",
    savedAt,
    baselineUpdatedAt: null,
    formValues: {},
    theme: null,
  })

  it("treats drafts saved before server updatedAt as stale", () => {
    const updatedAt = "2026-01-02T00:00:00.000Z"
    const serverMs = Date.parse(updatedAt)
    expect(isPageDraftStaleAgainstServer(draft(serverMs), updatedAt)).toBe(true)
    expect(isPageDraftStaleAgainstServer(draft(serverMs + 1), updatedAt)).toBe(false)
  })

  it("does not stale-check when server baseline is missing", () => {
    expect(isPageDraftStaleAgainstServer(draft(1), null)).toBe(false)
  })
})

describe("dirty derivation", () => {
  const themeA = { palette: "a" } as unknown as ThemeTokens
  const themeB = { palette: "b" } as unknown as ThemeTokens

  it("detects theme dirty via JSON compare", () => {
    expect(deriveThemeDirty(themeA, themeA)).toBe(false)
    expect(deriveThemeDirty(themeA, themeB)).toBe(true)
  })

  it("detects nav dirty only for saved pages", () => {
    expect(deriveNavDirty(true, false, true, false, true)).toBe(false)
    expect(deriveNavDirty(true, false, false, false, true)).toBe(true)
    expect(deriveNavDirty(true, false, false, false, false)).toBe(false)
  })

  it("aggregates page editor dirty flags", () => {
    const base = {
      readOnly: false,
      formDirty: false,
      themeDirty: false,
      navDirty: false,
      chromeDirty: false,
      dirtyFields: {},
    }
    expect(aggregatePageEditorDirty(base)).toBe(false)
    expect(aggregatePageEditorDirty({ ...base, themeDirty: true })).toBe(true)
    expect(aggregatePageEditorDirty({ ...base, readOnly: true, themeDirty: true })).toBe(false)
  })

  it("counts leaf dirty fields plus extension surfaces", () => {
    const count = countPageEditorDirtyLeaves({
      readOnly: false,
      formDirty: true,
      themeDirty: true,
      navDirty: true,
      chromeDirty: false,
      dirtyFields: { title: true },
    })
    expect(count).toBe(3)
  })

  it("detects chrome dirty via comparable projection", () => {
    const a = emptyChromeDraft()
    const b = { ...emptyChromeDraft(), footer: { ...emptyChromeDraft().footer, tagline: "Hi" } }
    expect(deriveChromeDirty(a, a, null)).toBe(false)
    expect(deriveChromeDirty(a, b, null)).toBe(true)
  })

  it("reports recoverable draft work across surfaces", () => {
    expect(pageEditorHasRecoverableDraftWork(false, false, false, false)).toBe(false)
    expect(pageEditorHasRecoverableDraftWork(false, true, false, false)).toBe(true)
  })
})

describe("selection helpers", () => {
  const path: ElementPath = { blockIndex: 0, field: "headline" }

  it("clears chrome when selecting an element path", () => {
    expect(selectElementPath(false, null, path)).toEqual({
      selection: path,
      chromeSelection: null,
    })
    expect(selectElementPath(true, null, path)).toBeNull()
  })

  it("clears element path when selecting chrome", () => {
    expect(selectChromeZone(false, { zone: "header" })).toEqual({
      selection: null,
      chromeSelection: { zone: "header" },
    })
    expect(selectChromeZone(true, { zone: "footer" })).toBeNull()
  })
})

describe("block command wiring", () => {
  const blocks = [hero("a"), hero("b"), hero("c")]
  const selected: ElementPath = { blockIndex: 1, field: "" }

  it("reorders blocks and remaps selection", () => {
    const result = editorReorderBlocks(blocks, selected, 1, 0)
    expect(result.blocks.map((b) => (b as { id?: string }).id)).toEqual(["b", "a", "c"])
    expect(result.selection).toEqual({ blockIndex: 0, field: "" })
  })

  it("removes blocks and remaps selection", () => {
    const result = editorRemoveBlock(blocks, selected, 0)
    expect(result.blocks).toHaveLength(2)
    expect(result.selection).toEqual({ blockIndex: 0, field: "" })
  })

  it("clones blocks and remaps selection to insert index", () => {
    const result = editorCloneBlockAt(blocks, selected, 1)
    expect(result?.blocks).toHaveLength(4)
    expect(result?.selection).toEqual({ blockIndex: 1, field: "" })
  })

  it("inserts and appends with selection on new block", () => {
    const inserted = editorInsertBlockAt(blocks, 1, { blockType: "stats" })
    expect(inserted.blocks).toHaveLength(4)
    expect(inserted.selection).toEqual({ blockIndex: 1, field: "" })

    const appended = editorAppendBlock(blocks, { blockType: "cta" })
    expect(appended.blocks).toHaveLength(4)
    expect(appended.selection).toEqual({ blockIndex: 3, field: "" })
  })
})

describe("pageEditorDefaultValues", () => {
  const t = (key: string) => key

  it("seeds empty document for new pages", () => {
    expect(pageEditorDefaultValues()).toEqual({
      title: "",
      slug: "",
      status: "published",
      blocks: [],
      seo: {},
    })
  })

  it("normalizes populated seo.ogImage for editor schema validation", () => {
    const values = pageEditorDefaultValues({
      id: 1,
      title: "Home",
      slug: "home",
      seo: {
        title: "Home SEO",
        ogImage: {
          id: 42,
          url: "/media/og.png",
          filename: "og.png",
          alt: "OG",
          width: 1200,
          height: 630,
        },
      },
    } as never)

    expect(values.seo?.ogImage).toBe(42)
    expect(createPageEditorSchema(t).safeParse(values).success).toBe(true)
  })
})

describe("mergeRestoredChromeDraft", () => {
  it("merges partial chrome draft onto settings baseline", () => {
    const settings = {
      chrome: {
        header: { variant: "default", logo: null },
        footer: { variant: "simple", logo: null, tagline: "Old", copyright: null, columns: [] },
      },
    }
    const merged = mergeRestoredChromeDraft(settings, null, {
      footer: { tagline: "Restored" },
    })
    expect(merged.footer.tagline).toBe("Restored")
    expect(merged.header.variant).toBe("default")
  })
})
