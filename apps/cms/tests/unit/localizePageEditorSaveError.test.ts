import { describe, expect, it } from "vitest"
import { localizePageEditorSaveError } from "@/lib/editor/localizePageEditorSaveError"

const t = (key: string) => `nl:${key}`

describe("localizePageEditorSaveError", () => {
  it("maps known activation gate reasons to editor i18n keys", () => {
    expect(
      localizePageEditorSaveError("Activation requires verified domain ownership.", t),
    ).toBe("nl:publishErrorDomain")
  })

  it("strips API stage prefixes before mapping", () => {
    expect(
      localizePageEditorSaveError(
        "publish: Activation requires verified domain ownership.",
        t,
      ),
    ).toBe("nl:publishErrorDomain")
  })

  it("passes through unknown messages without a stage prefix", () => {
    expect(localizePageEditorSaveError("publish: Something novel", t)).toBe("Something novel")
  })
})
