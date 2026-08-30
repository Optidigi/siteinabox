import { describe, expect, it } from "vitest"
import {
  CURRENT_PRIVACY_MARKER,
  LEGACY_PRIVACY_MARKER,
  replaceLegacyPrivacyMarker,
} from "@/migrations/20260830_163000_remove_legacy_provider_privacy_marker"

describe("legacy provider privacy marker migration", () => {
  it("replaces the marker recursively without changing structured rich text", () => {
    const input = {
      t: "root",
      children: [
        { t: "paragraph", children: [{ t: "text", v: `Versie ${LEGACY_PRIVACY_MARKER}.` }] },
        { t: "metadata", value: LEGACY_PRIVACY_MARKER },
      ],
    }

    expect(replaceLegacyPrivacyMarker(input)).toEqual({
      t: "root",
      children: [
        { t: "paragraph", children: [{ t: "text", v: `Versie ${CURRENT_PRIVACY_MARKER}.` }] },
        { t: "metadata", value: CURRENT_PRIVACY_MARKER },
      ],
    })
  })

  it("leaves unrelated values unchanged", () => {
    const input = { t: "text", v: "Een eigen privacydocument." }
    expect(replaceLegacyPrivacyMarker(input)).toEqual(input)
  })

  it("is registered after the privacy snapshot repair", async () => {
    const { readFile } = await import("node:fs/promises")
    const index = await readFile("src/migrations/index.ts", "utf8")
    expect(index.indexOf("20260830_160000_repair_tenant_privacy_snapshot")).toBeLessThan(
      index.indexOf("20260830_163000_remove_legacy_provider_privacy_marker"),
    )
  })
})
