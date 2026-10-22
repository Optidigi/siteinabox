/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { usePageEditorCore } from "@/components/editor/usePageEditorCore"
import { buildPageDraftKey } from "@/lib/editor/pageEditorCore"
import { readPageEditorDraft, writePageEditorDraft } from "@/lib/editor/pageDraftStore"
import type { Page } from "@/payload-types"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/analytics/CmsUsageTracker", () => ({ captureCmsBrowserEvent: vi.fn() }))

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

describe("rejected page draft recovery", () => {
  it("offers an older local draft after a concurrent server save without applying it automatically", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const initial: Page = { id: 1, tenant: 2, title: "Other session saved", slug: "index", status: "draft",
      blocks: [], createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:02:00Z" }
    const key = buildPageDraftKey(2, initial, "/pages")
    const draft = { version: 1 as const, key, savedAt: Date.parse("2026-10-22T10:01:00Z"),
      baselineUpdatedAt: "2026-10-22T10:00:00Z", theme: null,
      formValues: { title: "My rejected work", slug: "index", status: "draft", blocks: [], seo: {} } }
    await writePageEditorDraft(draft)
    const t = (key: string) => key
    const { result } = renderHook(() => usePageEditorCore({ initial, tenantId: 2, baseHref: "/pages",
      manifest: { version: 1, inlineMarks: {}, blockTypes: { paragraph: true } }, t,
      onDraftRestoreFailed: vi.fn(), onDraftRestored: vi.fn(), onDraftDiscarded: vi.fn(),
      onSaveFailed: vi.fn(), onSaveSuccess: vi.fn() }))
    await waitFor(() => expect(result.current.draftCandidate?.formValues).toEqual(draft.formValues))
    expect(result.current.form.getValues("title")).toBe("Other session saved")
    expect(await readPageEditorDraft(key)).toEqual(draft)
    act(() => result.current.restorePageDraft())
    expect(result.current.form.getValues("title")).toBe("My rejected work")
  })
})
