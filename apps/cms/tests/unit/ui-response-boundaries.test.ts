// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clientMediaSchema, clientMediaListSchema, clientMeSchema, clientCreatedIdSchema, clientCountSchema, clientPageSaveSchema } from "@/components/clientPayload"
import { parsePageEditorDraft } from "@/lib/editor/pageDraftStore"
import { createElement } from "react"
import { cleanup, render } from "@testing-library/react"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { GeoChoroplethMap } from "@/components/analytics/GeoChoroplethMap"


describe("consumed UI response fields", () => {
  it("accepts extra media metadata while rejecting invalid consumed fields", () => {
    expect(clientMediaSchema.parse({ id: 1, filename: "hero.jpg", extra: { provider: true } })).toEqual({ id: 1, filename: "hero.jpg", extra: { provider: true } })
    for (const body of [{ id: {} }, { id: 1, url: {} }, { id: 1, width: "wide" }]) expect(clientMediaSchema.safeParse(body).success).toBe(false)
    expect(clientMediaListSchema.safeParse({ docs: "not an array" }).success).toBe(false)
  })
  it("does not accept malformed identities or counts", () => {
    expect(clientMeSchema.safeParse({ user: { role: "owner", tenants: [{ tenant: {} }] } }).success).toBe(false)
    expect(clientCreatedIdSchema.safeParse({ id: false }).success).toBe(false)
    expect(clientCountSchema.safeParse({ totalDocs: -1 }).success).toBe(false)
    expect(clientCountSchema.safeParse({ totalDocs: "100" }).success).toBe(false)
  })
  it("validates save identity and theme instead of trusting a successful HTTP status", () => {
    expect(clientPageSaveSchema.parse({ page: { id: 5, updatedAt: "2026-10-07" } })).toEqual({ page: { id: 5, updatedAt: "2026-10-07" } })
    expect(clientPageSaveSchema.safeParse({ page: { id: {} } }).success).toBe(false)
    expect(clientPageSaveSchema.safeParse({ page: { id: 5 }, theme: false }).success).toBe(false)
  })
})


describe("persisted editor draft boundary", () => {
  it("keeps opaque form and theme values but validates draft metadata", () => {
    const draft = { version: 1, key: "page:1", savedAt: 123, baselineUpdatedAt: null, formValues: { title: "Draft" }, theme: { tokens: true } }
    expect(parsePageEditorDraft(draft, "page:1")).toEqual(draft)
    expect(parsePageEditorDraft(draft, "page:2")).toBeNull()
    expect(parsePageEditorDraft({ ...draft, savedAt: "yesterday" }, "page:1")).toBeNull()
    expect(parsePageEditorDraft({ ...draft, nav: { inNavbar: "yes", inFooter: false } }, "page:1")).toBeNull()
  })
})


beforeEach(() => {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage })
})
afterEach(() => { cleanup() })

describe("rendered consumed boundaries", () => {
  it("ignores corrupt persisted completion values instead of marking a step done", () => {
    window.localStorage.setItem("ui-checklist", JSON.stringify({ first: "false" }))
    const view = render(createElement(OnboardingChecklist, { storageKey: "ui-checklist", seed: {}, steps: [{ id: "first", title: "First", description: "Configure" }] }))
    expect(view.getByRole("button", { name: "Mark done" })).toBeDefined()
  })
  it("renders actual installed world-atlas countries through validated topology", () => {
    const view = render(createElement(GeoChoroplethMap, { rows: [{ countryCode: "NL", countryName: "Netherlands", visitors: 10, pageviews: 20 }], noData: "No data" }))
    expect(view.getByRole("img", { name: "Netherlands: 10 visitors" })).toBeDefined()
    expect(view.container.querySelectorAll("path").length).toBeGreaterThan(100)
  })
})
