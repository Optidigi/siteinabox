import { describe, expect, it } from "vitest"
import { matchersForManifest } from "@/lib/richText/themedMatchers"
import type { RtManifest } from "@/lib/richText/manifest"

describe("matchersForManifest", () => {
  const baseManifest: RtManifest = {
    version: 1,
    inlineMarks: { bold: true, italic: true },
    blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  }

  it("does not infer retired tenant-specific HTML matchers", () => {
    const result = matchersForManifest({
      ...baseManifest,
      themedNodes: [
        { id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text" }] },
      ],
    })
    expect(result).toEqual([])
  })

  it("returns empty when manifest declares no themedNodes", () => {
    expect(matchersForManifest(baseManifest)).toHaveLength(0)
  })

  it("ignores themedNode ids without a generic registered matcher", () => {
    const result = matchersForManifest({
      ...baseManifest,
      themedNodes: [
        { id: "pullquote", label: "Pull Quote", fields: [{ name: "text", type: "text" }] },
        { id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text" }] },
      ],
    })
    expect(result).toEqual([])
  })
})
