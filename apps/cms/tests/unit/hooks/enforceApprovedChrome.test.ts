import { describe, expect, it } from "vitest"
import type { SiteSetting } from "@/payload-types"
import { siteSettingsFixture } from "../../_helpers/generatedDocs"
import { enforceApprovedChrome } from "@/hooks/enforceApprovedChrome"
import { hookArgsFor, hookCollection, hookRequest } from "../../_helpers/hookFixtures"

const unavailable = { navbar: { variant: "navbar-99", placement: "normal" } }
const args = (data: Parameters<typeof enforceApprovedChrome>[0]["data"], originalDoc?: Parameters<typeof enforceApprovedChrome>[0]["originalDoc"]) => hookArgsFor(enforceApprovedChrome, { operation: originalDoc ? "update" : "create", req: hookRequest(), collection: hookCollection("site-settings"), context: {}, data, originalDoc })
// Malformed external/local JS callers can bypass TypeScript; exercise that actual
// hook boundary without weakening the generated SiteSetting contract.
const untypedHook = (data: unknown, originalDoc?: unknown): unknown => Reflect.apply(enforceApprovedChrome, undefined, [{ ...args({}), data, originalDoc }])
describe("saved approved chrome boundary", () => {
  it("rejects new unavailable designs and preserves unchanged legacy chrome for repair", () => {
    expect(() => untypedHook({ chrome: unavailable })).toThrow("approved")
    expect(untypedHook({ chrome: unavailable }, { ...siteSettingsFixture(), chrome: unavailable })).toEqual({ chrome: unavailable })
    expect(() => untypedHook({ chrome: { navbar: { variant: "navbar-98" } } }, { ...siteSettingsFixture(), chrome: unavailable })).toThrow("approved")
  })
  it("accepts current approved chrome or default chrome", () => {
    const chrome: SiteSetting["chrome"] = { navbar: { variant: "navbar-01", placement: "hero-overlay" }, footer: { variant: "footer-01" } }
    expect(enforceApprovedChrome(args({ chrome }))).toEqual({ chrome })
    expect(untypedHook({ chrome: null })).toEqual({ chrome: null })
  })
})
