import assert from "node:assert/strict"
import test from "node:test"
import { PUBLIC_RENDERER_THEME_SCOPE, themeToCssVars } from "./css-vars.ts"

const theme = {
  version: 2,
  appearance: { mode: "light" },
  colors: { schemeId: "blue-professional" },
  fonts: { schemeId: "clear-modern" },
  shape: { schemeId: "tailwind-default" },
  density: { schemeId: "tailwind-default" },
}

test("themeToCssVars keeps neutral Tailwind colors literal while bridging provider utility roles", () => {
  const css = themeToCssVars(theme, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(css, /--color-tailwindplus-surface:#ffffff/)
  assert.match(css, /--color-indigo-600:#2563eb/)
  assert.match(css, /--siab-accent-600:#2563eb/)
  assert.match(css, /--siab-neutral-900:#111827/)
  assert.equal(css.includes("--color-white:"), false)
  assert.match(css, /--color-gray-900:#111827/)
  assert.match(css, /--color-gray-500:#6b7280/)
  assert.match(css, /:where\(\[data-provider-block="tailwindplus"\]\.bg-white\)/)
  assert.match(css, /:where\(\[data-provider-block="tailwindplus"\] \.bg-white\)/)
  assert.match(css, /:where\(\[data-provider-chrome="tailwindplus"\]\.bg-white\)/)
  assert.match(css, /background-color:var\(--color-tailwindplus-surface,var\(--color-bg,#ffffff\)\)/)
  assert.match(css, /\.text-white\{color:var\(--color-on-accent,#ffffff\)/)
  assert.doesNotMatch(css, /(^|[,{])\.text-white\{/)
  assert.match(css, /\.text-gray-900/)
  assert.match(css, /color:var\(--siab-neutral-900,var\(--color-ink,#111827\)\)/)
  assert.match(css, /\.text-gray-600/)
  assert.match(css, /color:var\(--siab-neutral-600,var\(--color-ink-muted,#4b5563\)\)/)
})

test("themeToCssVars applies dark role tokens without remapping source dark panels", () => {
  const css = themeToCssVars({ ...theme, appearance: { mode: "dark" } })

  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-bg:#030712/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-ink:#f9fafb/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-ink-muted:#d1d5db/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-tailwindplus-surface:#030712/)
  assert.match(css, /data-theme-zone="fixed-dark"/)
})

test("themeToCssVars bridges source-specific dark media gaps", () => {
  const css = themeToCssVars({ ...theme, colors: { schemeId: "tailwind-default" }, appearance: { mode: "dark" } })

  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-on-accent:#ffffff/)
  assert.match(css, /\.bg-gray-900[^}]*background-color:#111827/)
  assert.match(css, /\.hover\\:bg-gray-700:hover[^}]*background-color:#374151/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--tailwindplus-logo-filter:invert\(1\) brightness\(1\.6\) grayscale\(1\)/)
  assert.match(css, /\[data-provider-variant="tailwindplus\.marketing\.logo-cloud\.simple-with-heading"\] img\[src\*="-logo-gray-900\.svg"\]/)
  assert.match(css, /\.flex\.bg-white :is\(input,select\)\{background-color:transparent\}/)
})
