import { describe, expect, it } from "vitest"
import { splitBuilderSpeech } from "@/lib/builder/chatSpeech"

describe("builder chat speech", () => {
  it("turns leftover markdown bold into strong parts and leaves the rest as text", () => {
    expect(splitBuilderSpeech("Ik zet **terracotta** klaar.")).toEqual([
      { kind: "text", value: "Ik zet " },
      { kind: "strong", value: "terracotta" },
      { kind: "text", value: " klaar." },
    ])
    expect(splitBuilderSpeech("Geen sterretjes hier.")).toEqual([
      { kind: "text", value: "Geen sterretjes hier." },
    ])
  })
})
