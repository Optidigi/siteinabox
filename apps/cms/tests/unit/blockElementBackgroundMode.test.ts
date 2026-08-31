import { describe, expect, it } from "vitest"
import { BACKGROUND_MODE_IDS } from "@siteinabox/contracts"
import {
  EDITOR_THEME_DEFAULT_SELECT_VALUE,
  editorSelectChangedValue,
  editorSelectValue,
  getBlockElementSpecs,
} from "@/components/editor/blockElements"
import type { RtManifest } from "@/lib/richText/manifest"

const backgroundOptions = BACKGROUND_MODE_IDS.map((value) => ({ label: value, value }))

const manifestWithFields = (fields: NonNullable<RtManifest["blocks"]>[number]["fields"]): RtManifest => ({
  version: 1,
  inlineMarks: {},
  blockTypes: { paragraph: true },
  blocks: [{ slug: "hero", fields }],
})

describe("effect override editor projection", () => {
  it("exposes a resettable background effect for every effect-capable block", () => {
    for (const blockType of ["hero", "cta"]) {
      const spec = getBlockElementSpecs(blockType).find((candidate) => candidate.field === "backgroundMode")
      expect(spec).toMatchObject({
        kind: "select",
        clearable: true,
        options: backgroundOptions,
      })
    }
  })

  it("does not add an effect override to unrelated section blocks", () => {
    expect(getBlockElementSpecs("services").some((spec) => spec.field === "backgroundMode")).toBe(false)
  })

  it("keeps the owned effect field visible when a manifest customizes block fields", () => {
    const specs = getBlockElementSpecs("hero", manifestWithFields([
      { name: "heading", kind: "text" },
    ]))
    expect(specs.map((spec) => spec.field)).toEqual(["heading", "backgroundMode"])
    expect(specs[1]).toMatchObject({
      kind: "select",
      clearable: true,
      options: backgroundOptions,
    })
  })

  it("keeps canonical effect options when a manifest supplies a duplicate field", () => {
    const specs = getBlockElementSpecs("hero", manifestWithFields([
      { name: "backgroundMode", kind: "select", options: [{ label: "Invalid", value: "invalid" }] },
    ]))
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({
      kind: "select",
      clearable: true,
      options: backgroundOptions,
    })
  })

  it("maps the editor reset sentinel to null and never persists it", () => {
    const spec = { clearable: true as const }
    expect(editorSelectValue(spec, undefined)).toBe(EDITOR_THEME_DEFAULT_SELECT_VALUE)
    expect(editorSelectValue(spec, null)).toBe(EDITOR_THEME_DEFAULT_SELECT_VALUE)
    expect(editorSelectChangedValue(spec, EDITOR_THEME_DEFAULT_SELECT_VALUE)).toBeNull()
    expect(editorSelectChangedValue(spec, "mesh")).toBe("mesh")
  })
})
