import { describe, expect, it } from "vitest"

import {
  checkoutProfileConflict,
  checkoutVersionConflict,
} from "@/lib/checkout/previewCheckoutResults"

describe("preview checkout conflict results", () => {
  it("constructs the exact version-conflict serialization", () => {
    expect(checkoutVersionConflict("quote changed")).toEqual({
      ok: false,
      status: "version_conflict",
      message: "quote changed",
    })
    expect(checkoutVersionConflict("quote changed", {
      quotes: undefined,
    })).toEqual({
      ok: false,
      status: "version_conflict",
      message: "quote changed",
      quotes: undefined,
    })
  })

  it("constructs the exact profile-conflict serialization", () => {
    expect(checkoutProfileConflict("profile changed")).toEqual({
      ok: false,
      status: "profile_conflict",
      message: "profile changed",
    })
    expect(checkoutProfileConflict("profile changed", {
      currentProfile: undefined,
    })).toEqual({
      ok: false,
      status: "profile_conflict",
      message: "profile changed",
      currentProfile: undefined,
    })
  })
})
