import assert from "node:assert/strict"
import test from "node:test"
import { themeToCssVars } from "./css-vars.ts"

test("the runtime default preserves the exact upstream light and dark tokens", () => {
  const css = themeToCssVars(undefined)
  assert.doesNotMatch(css, /data-provider-token-mode="reference"/)
  assert.match(css, /--background:oklch\(1 0 0\);--foreground:oklch\(0\.145 0 0\)/)
  assert.match(css, /--primary:oklch\(0\.205 0 0\);--primary-foreground:oklch\(0\.985 0 0\)/)
  assert.match(css, /data-rt-mode="dark"[^}]*--background:oklch\(0\.145 0 0\);--foreground:oklch\(0\.985 0 0\)/)
  assert.match(css, /--border:oklch\(1 0 0 \/ 10%\);--input:oklch\(1 0 0 \/ 15%\);--ring:oklch\(0\.556 0 0\)/)
})

test("tenant tokens remain root-scoped and do not rewrite literal provider classes", () => {
  const css = themeToCssVars({ version: 3, appearance: { mode: "light" }, colors: { schemeId: "red-confident" }, fonts: { schemeId: "clear-modern" }, shape: { schemeId: "soft" } })
  assert.match(css, /^\.rt-canvas\{/)
  assert.match(css, /--color-accent:#dc2626/)
  for (const token of ["destructive", "success", "warning", "rating", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "overlay", "on-media"]) {
    assert.match(css, new RegExp(`--${token}:`))
  }
  assert.doesNotMatch(css, /class~/)
  assert.doesNotMatch(css, /data-provider-variant/)
  assert.match(css, /--color-indigo-500:#ef4444/)
  assert.match(css, /--color-gray-900:#111827/)
  assert.match(css, /--provider-surface:var\(--background\)/)
  assert.match(css, /--provider-grid-line:color-mix/)
})

test("upstream defaults leave literal Tailwind palette values untouched", () => {
  const css = themeToCssVars(undefined)
  assert.doesNotMatch(css, /--color-indigo-500:/)
  assert.doesNotMatch(css, /--provider-surface:/)
  assert.match(css, /--radius:0.625rem/)
})

test("every approved font and shape preset emits deterministic role variables", () => {
  const fonts = [
    ["shadcn-geist", "Geist Variable"],
    ["clear-modern", "Inter Variable"],
    ["classic-editorial", "Fraunces Variable"],
    ["friendly-organic", "Nunito Variable"],
  ]
  const shapes = [
    ["shadcn-default", "--siab-radius-lg:0.625rem"],
    ["rounded", "--siab-radius-lg:1.25rem"],
    ["soft", "--siab-radius-lg:0.5rem"],
    ["sharp", "--siab-radius-lg:0"],
  ]
  for (const [font, expected] of fonts) for (const [shape, radius] of shapes) {
    const css = themeToCssVars({ version: 3, appearance: { mode: "light" }, colors: { schemeId: "emerald-calm" }, fonts: { schemeId: font }, shape: { schemeId: shape } })
    assert.ok(css.includes(expected), `${font} emits ${expected}`)
    assert.ok(css.includes(radius), `${shape} emits ${radius}`)
    assert.match(css, /--siab-font-body:/)
    assert.match(css, /--siab-font-heading:/)
    assert.match(css, /--siab-font-display:/)
    assert.match(css, /--siab-font-mono:/)
  }
})

test("resolved mode drives tenant, public-root and native browser colors", () => {
  const css = themeToCssVars(undefined)
  assert.match(css, /color-scheme:light/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\],html\[data-siab-color-mode="dark"\] \.rt-canvas\{/)
  assert.match(css, /color-scheme:dark/)
  assert.doesNotMatch(css, /data-provider-token-mode="reference"/)
})
