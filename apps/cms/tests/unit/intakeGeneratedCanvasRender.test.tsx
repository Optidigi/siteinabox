import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CanvasBlockRenderer } from "@/components/editor/canvas/CanvasBlockRenderer"
import { CanvasSelectionProvider } from "@/components/editor/canvas/CanvasSelectionContext"
import { processIntakeSubmission } from "@/lib/intake/processIntakeSubmission"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

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
  type CollectionSlug =
    | "intake-submissions"
    | "site-generation-runs"
    | "tenants"
    | "pages"
    | "site-settings"
  const store: Record<CollectionSlug, any[]> = {
    "intake-submissions": [],
    "site-generation-runs": [],
    tenants: [],
    pages: [],
    "site-settings": [],
  }
  const payload = {
    find: async (args: any) => {
      const docs = store[args.collection as CollectionSlug].filter((doc) => matchesWhere(doc, args.where))
      return { docs: typeof args.limit === "number" ? docs.slice(0, args.limit) : docs, totalDocs: docs.length }
    },
    create: async (args: any) => {
      const doc = { ...args.data, id: nextId++ }
      store[args.collection as CollectionSlug].push(doc)
      return doc
    },
    update: async (args: any) => {
      const docs = store[args.collection as CollectionSlug]
      const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
      if (index < 0) throw new Error(`Missing ${args.collection} ${args.id}`)
      const current = docs[index]!
      docs[index] = { ...current, ...args.data, id: current.id }
      return docs[index]!
    },
  }
  return { payload: payload as any, store }
}

describe("generated intake canvas render smoke", () => {
  it("renders generated draft page blocks through the CMS canvas block components", async () => {
    const { payload, store } = createPayloadStub()
    const result = await processIntakeSubmission(payload, {
      source: "public-intake",
      businessName: "Visual Smoke Studio",
      domain: "visual-smoke-studio.test",
      contactEmail: "hello@example.com",
      language: "nl",
      goals: ["Verify generated draft rendering"],
      pages: [{ slug: "home", title: "Home" }],
    })

    expect(result.status).toBe("preview_ready")
    const tenant = store.tenants[0]
    const page = store.pages[0]
    expect(page?.blocks?.length).toBeGreaterThan(0)

    const html = renderToStaticMarkup(
      <CanvasSelectionProvider value={{ view: "sidebar", selected: null, select: () => {} }}>
        <main>
          {page.blocks.map((block: any, index: number) => (
            <CanvasBlockRenderer
              key={index}
              block={block}
              index={index}
              isActive={false}
              manifest={tenant.siteManifest}
              onActivate={() => {}}
              onUpdate={() => {}}
            />
          ))}
        </main>
      </CanvasSelectionProvider>,
    )

    expect(html).toContain("cms-block")
    expect(html).not.toContain("cms-block--unknown")
    expect(html).not.toContain("Unknown block type")
    expect(html.length).toBeGreaterThan(2_000)
  })
})
