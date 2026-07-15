import assert from "node:assert/strict"
import test from "node:test"
import { themeToCssVars } from "./css-vars.ts"

test("reference-token mode preserves the exact upstream light and dark tokens", () => {
  const css = themeToCssVars(undefined)
  assert.match(css, /\[data-provider-token-mode="reference"\]/)
  assert.match(css, /--background:#fff;--foreground:#09090b/)
  assert.match(css, /--primary:#18181b;--primary-foreground:#fafafa/)
  assert.match(css, /data-rt-mode="dark"[^}]*--background:#09090b;--foreground:#fafafa/)
  assert.match(css, /--border:#27272a;--input:#27272a;--ring:#71717a/)
})

test("tenant tokens remain root-scoped and do not rewrite literal provider classes", () => {
  const css = themeToCssVars({ version: 2, colors: { schemeId: "red-bold" } })
  assert.match(css, /^\.rt-canvas\{/)
  assert.match(css, /--color-accent:#4f46e5/)
  assert.doesNotMatch(css, /class~/)
  assert.doesNotMatch(css, /data-provider-variant/)
})
