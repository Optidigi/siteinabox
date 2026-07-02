import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("RichText canvas selection", () => {
  it("keeps addressed block rich-text slots wrapped for canvas/sidebar hit targeting", () => {
    const rtSlot = read("src/components/editor/canvas/inline/RtSlot.tsx")
    const siabCss = read("src/styles/siab.css")

    expect(rtSlot).toContain("elementPath == null")
    expect(rtSlot).toContain("e.stopPropagation(); setEditing(true)")
    expect(siabCss).toContain(":not(:has(.rt-slot:hover, .rt-click-edit:hover, [data-rt-selected=\"true\"]))")
  })

  it("does not mirror field-level rich-text selection into a whole-section active outline", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasSurface.tsx")

    expect(canvasMode).toContain('setActiveIndex(selected?.field === "" ? selected.blockIndex : null)')
    expect(canvasMode).not.toContain("setActiveIndex(selected?.blockIndex ?? null)")
  })

  it("renders empty addressed rich-text and array block targets in the canvas", () => {
    const rtSlot = read("src/components/editor/canvas/inline/RtSlot.tsx")
    const featureList = read("src/components/editor/canvas/blocks/FeatureList.tsx")
    const faq = read("src/components/editor/canvas/blocks/FAQ.tsx")

    expect(rtSlot).toContain("const isCustomerPreview = isCustomerPreviewView(view)")
    expect(rtSlot).toContain("const shouldRenderEmptySlot = !isCustomerPreview && (!!placeholder || elementPath != null || !isReadOnly)")
    expect(rtSlot).toContain('data-rt-empty-placeholder="true"')
    expect(featureList).toContain("const next = [...(block.features ?? [])]")
    expect(featureList).toContain("next[i] = { ...(next[i] ?? {}), [key]: value }")
    expect(featureList).toContain("const visibleFeatures = features.length ? features : [{}]")
    expect(featureList).toContain('key={features.length ? i : "empty-feature"}')
    expect(featureList).toContain("const MAX_FEATURE_CARDS = 3")
    expect(featureList).toContain("const canAddFeature = !isReadOnly && features.length < MAX_FEATURE_CARDS")
    expect(featureList).toContain("onUpdate({ ...block, features: [...features, {}] })")
    expect(featureList).toContain('t("addFeatureCard")')
    expect(faq).toContain("const next = [...(block.items ?? [])]")
    expect(faq).toContain("next[i] = { ...(next[i] ?? {}), [key]: value }")
    expect(faq).toContain("const visibleItems = items.length ? items : [{}]")
    expect(faq).toContain('key={items.length ? i : "empty-faq-item"}')
  })
})
