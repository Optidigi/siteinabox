import test from "node:test"
import assert from "node:assert/strict"
import { builtBrowserOptions } from "./built-app-options.mjs"

test("default and CI reuse remain full qualification; focused runs are diagnostic", () => {
  assert.deepEqual(builtBrowserOptions([]), { reuse: false, scenario: "full", qualification: "full" })
  assert.equal(builtBrowserOptions(["--reuse-built"]).qualification, "full")
  assert.deepEqual(builtBrowserOptions(["--scenario=workspace-settings", "--reuse-built"]),
    { reuse: true, scenario: "workspace-settings", qualification: "diagnostic" })
  for (const args of [["--scenario=unknown"], ["--reuse-built", "--reuse-built"], ["--skip-auth"]]) {
    assert.throws(() => builtBrowserOptions(args))
  }
})
