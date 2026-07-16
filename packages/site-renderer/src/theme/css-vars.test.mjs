import assert from "node:assert/strict"
import test from "node:test"
import { themeToCssVars } from "./css-vars.ts"

test("reference-token mode preserves the exact upstream light and dark tokens", () => {
  const css = themeToCssVars(undefined)
  assert.match(css, /\[data-provider-token-mode="reference"\]/)
  assert.match(css, /--background:oklch\(1 0 0\);--foreground:oklch\(0\.145 0 0\)/)
  assert.match(css, /--primary:oklch\(0\.205 0 0\);--primary-foreground:oklch\(0\.985 0 0\)/)
  assert.match(css, /data-rt-mode="dark"[^}]*--background:oklch\(0\.145 0 0\);--foreground:oklch\(0\.985 0 0\)/)
  assert.match(css, /--border:oklch\(1 0 0 \/ 10%\);--input:oklch\(1 0 0 \/ 15%\);--ring:oklch\(0\.556 0 0\)/)
})

test("tenant tokens remain root-scoped and do not rewrite literal provider classes", () => {
  const css = themeToCssVars({ version: 3, colors: { schemeId: "red-bold" } })
  assert.match(css, /^\.rt-canvas\{/)
  assert.match(css, /--color-accent:#4f46e5/)
  assert.doesNotMatch(css, /class~/)
  assert.doesNotMatch(css, /data-provider-variant/)
})

test("resolved mode drives tenant, public-root and native browser colors", () => {
  const css = themeToCssVars(undefined)
  assert.match(css, /color-scheme:light/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\],html\[data-siab-color-mode="dark"\] \.rt-canvas\{/)
  assert.match(css, /color-scheme:dark/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\] :where\(\[data-provider-token-mode="reference"\]\),html\[data-siab-color-mode="dark"\] \.rt-canvas :where\(\[data-provider-token-mode="reference"\]\)/)
})
