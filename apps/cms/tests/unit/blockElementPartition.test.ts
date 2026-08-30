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
  it("keeps variant and anchor in advanced and content fields first", () => {
    const { content, advanced } = partitionBlockElementSpecs([
      spec("heading"),
      spec("variant"),
      spec("primaryAction", "cta"),
      spec("anchor"),
    ])
    expect(content.map((value) => value.field)).toEqual(["heading", "primaryAction"])
    expect(advanced.map((value) => value.field)).toEqual(["variant", "anchor"])
  })

  it("keeps semantic arrays in content", () => {
    const { content, advanced } = partitionBlockElementSpecs([
      spec("heading"),
      spec("items", "array"),
    ])
    expect(content.map((value) => value.field)).toEqual(["heading", "items"])
    expect(advanced).toEqual([])
  })
})

describe("resolveBlockLabel", () => {
  it("prefers manifest label over slug", () => {
    expect(resolveBlockLabel("services", {
      version: 1,
      blocks: [{ slug: "services", label: "Diensten" }],
    } as never)).toBe("Diensten")
  })

  it("uses locale fallback then title-cases slug", () => {
    expect(resolveBlockLabel("services", null, (slug) =>
      slug === "services" ? "Services" : undefined,
    )).toBe("Services")
    expect(resolveBlockLabel("services")).toBe("Services")
  })
})
