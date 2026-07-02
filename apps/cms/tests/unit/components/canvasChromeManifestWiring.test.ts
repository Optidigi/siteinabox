import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("canvas chrome manifest wiring", () => {
  it("passes the tenant manifest into frame canvas block mutators", () => {
    expect(read("src/components/editor-frame/FrameCanvasSurface.tsx")).toContain("useFrameCanvasBlocks")
    expect(read("src/components/editor-frame/useFrameCanvasBlocks.ts")).toContain("manifest")
  })
})
