import { describe, expect, it } from "vitest"
import {
  partitionBlockElementSpecs,
  type ElementSpec,
} from "@/components/editor/blockElements"
import { resolveBlockLabel } from "@/lib/editor/blockLabels"

const spec = (field: string, kind: ElementSpec["kind"] = "text"): ElementSpec => ({
  field,
  label: field,
  kind,
})

describe("partitionBlockElementSpecs", () => {
  it("puts design/anchor/metadata in advanced and content fields first", () => {
    const { content, advanced } = partitionBlockElementSpecs([
      spec("headline", "richtext"),
      spec("designVariant"),
      spec("cta", "cta"),
      spec("anchor"),
      spec("metadata"),
    ])
    expect(content.map((s) => s.field)).toEqual(["headline", "cta"])
    expect(advanced.map((s) => s.field)).toEqual(["designVariant", "anchor", "metadata"])
  })

  it("keeps active optional arrays in content and inactive ones in advanced", () => {
    const { content, advanced } = partitionBlockElementSpecs(
      [spec("headline", "richtext"), spec("pills", "array"), spec("logos", "array")],
      {
        pills: { status: "optional" },
        logos: { status: "inactive" },
      },
    )
    expect(content.map((s) => s.field)).toEqual(["headline", "pills"])
    expect(advanced.map((s) => s.field)).toEqual(["logos"])
  })

  it("omits inactive non-optional fields", () => {
    const { content, advanced } = partitionBlockElementSpecs(
      [spec("headline", "richtext"), spec("image", "image")],
      { image: { status: "inactive" } },
    )
    expect(content.map((s) => s.field)).toEqual(["headline"])
    expect(advanced).toEqual([])
  })
})

describe("resolveBlockLabel", () => {
  it("prefers manifest label over slug", () => {
    expect(resolveBlockLabel("featureList", {
      version: 1,
      blocks: [{ slug: "featureList", label: "Diensten" }],
    } as never)).toBe("Diensten")
  })

  it("uses locale fallback then title-cases slug", () => {
    expect(resolveBlockLabel("featureList", null, (slug) =>
      slug === "featureList" ? "Services" : undefined,
    )).toBe("Services")
    expect(resolveBlockLabel("featureList")).toBe("Feature List")
  })
})
