import { describe, it, expect } from "vitest"
import { manifestSchema } from "@/lib/richText/manifest"

const minimalValid = {
  version: 1,
  inlineMarks: {},
  blockTypes: { paragraph: true },
}

describe("manifestSchema", () => {
  it("accepts the minimal valid manifest", () => {
    expect(() => manifestSchema.parse(minimalValid)).not.toThrow()
  })

  it("rejects missing paragraph: true in blockTypes", () => {
    expect(() => manifestSchema.parse({ ...minimalValid, blockTypes: {} })).toThrow()
  })

  it("rejects version !== 1", () => {
    expect(() => manifestSchema.parse({ ...minimalValid, version: 2 })).toThrow()
  })

  it("rejects duplicate themedNode ids", () => {
    const v = {
      ...minimalValid,
      themedNodes: [
        { id: "eyebrow", label: "A", fields: [] },
        { id: "eyebrow", label: "B", fields: [] },
      ],
    }
    expect(() => manifestSchema.parse(v)).toThrow()
  })

  it("rejects heading level outside 2-4", () => {
    const v = {
      ...minimalValid,
      blockTypes: { paragraph: true, heading: { levels: [1] } },
    }
    expect(() => manifestSchema.parse(v)).toThrow()
  })

  it("accepts themedNode with text + select + upload + url + checkbox fields", () => {
    const v = {
      ...minimalValid,
      themedNodes: [{
        id: "callout", label: "Callout",
        fields: [
          { name: "title", type: "text", required: true },
          { name: "variant", type: "select", options: [{ value: "info", label: "Info" }] },
          { name: "image", type: "upload", relationTo: "media" },
          { name: "href", type: "url" },
          { name: "pinned", type: "checkbox" },
        ],
      }],
    }
    expect(() => manifestSchema.parse(v)).not.toThrow()
  })

  it("rejects unknown themed-node field type", () => {
    const v = {
      ...minimalValid,
      themedNodes: [{
        id: "x", label: "X",
        fields: [{ name: "n", type: "color" }],
      }],
    }
    expect(() => manifestSchema.parse(v)).toThrow()
  })

  it("accepts manifest-driven footer composition contract", () => {
    expect(() => manifestSchema.parse({
      ...minimalValid,
      footer: {
        columnCounts: [1, 2, 3],
        defaultColumnCount: 3,
        items: [
          { type: "brand", label: "Brand" },
          { type: "business", label: "Details" },
          { type: "contact", label: "Contact" },
          { type: "links", label: "Links" },
        ],
      },
    })).not.toThrow()
  })

  it("rejects invalid footer composition declarations", () => {
    expect(() => manifestSchema.parse({
      ...minimalValid,
      footer: {
        columnCounts: [2],
        defaultColumnCount: 3,
        items: [{ type: "brand" }],
      },
    })).toThrow()
    expect(() => manifestSchema.parse({
      ...minimalValid,
      footer: {
        columnCounts: [2],
        items: [{ type: "brand" }, { type: "brand" }],
      },
    })).toThrow()
  })

  // OBS-32: bound the admin-only manifest field so a compromised admin
  // can't paste a pathologically large manifest that exhausts the zod or
  // downstream RtNode validator.
  describe("bounds (OBS-32)", () => {
    it("accepts a themedNodes array at the 64 limit", () => {
      const v = {
        ...minimalValid,
        themedNodes: Array.from({ length: 64 }, (_, i) => ({
          id: `n${i}`, label: `Node ${i}`, fields: [],
        })),
      }
      expect(() => manifestSchema.parse(v)).not.toThrow()
    })

    it("rejects a themedNodes array of 65", () => {
      const v = {
        ...minimalValid,
        themedNodes: Array.from({ length: 65 }, (_, i) => ({
          id: `n${i}`, label: `Node ${i}`, fields: [],
        })),
      }
      expect(() => manifestSchema.parse(v)).toThrow()
    })

    it("rejects a themedNode.fields array of 33", () => {
      const v = {
        ...minimalValid,
        themedNodes: [{
          id: "x", label: "X",
          fields: Array.from({ length: 33 }, (_, i) => ({
            name: `f${i}`, type: "text" as const,
          })),
        }],
      }
      expect(() => manifestSchema.parse(v)).toThrow()
    })

    it("rejects a themedNode id longer than 64 chars", () => {
      const v = {
        ...minimalValid,
        themedNodes: [{ id: "x".repeat(65), label: "X", fields: [] }],
      }
      expect(() => manifestSchema.parse(v)).toThrow()
    })

    it("rejects a themedNode label longer than 80 chars", () => {
      const v = {
        ...minimalValid,
        themedNodes: [{ id: "x", label: "L".repeat(81), fields: [] }],
      }
      expect(() => manifestSchema.parse(v)).toThrow()
    })
  })
})
