import assert from "node:assert/strict"
import test from "node:test"
import { PUBLIC_RENDERER_THEME_SCOPE, themeToCssVars } from "./css-vars.ts"

const theme = {
  colors: {
    accent: "#2563eb",
    onAccent: "#fff7ed",
    bg: "#f8fafc",
    ink: "#111827",
    muted: "#6b7280",
    card: "#ffffff",
    rule: "rgba(17, 24, 39, 0.1)",
  },
  darkColors: {
    accent: "#60a5fa",
    onAccent: "#020617",
    bg: "#09090b",
    ink: "#fafafa",
    muted: "#a1a1aa",
    card: "#18181b",
    rule: "rgba(255, 255, 255, 0.12)",
  },
  fonts: { heading: "Inter", text: "Inter" },
  radius: "0.375rem",
  mode: "light",
}

test("themeToCssVars keeps text-white on on-accent while bridging provider bg-white surfaces", () => {
  const css = themeToCssVars(theme, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(css, /--color-white:#fff7ed/)
  assert.match(css, /--color-tailwindplus-surface:#f8fafc/)
  assert.match(css, /--color-tailwindplus-card:#ffffff/)
  assert.match(css, /--color-indigo-600:#2563eb/)
  assert.match(css, /--color-gray-900:#111827/)
  assert.match(css, /--color-gray-500:#6b7280/)
  assert.match(css, /:where\(\[data-provider-block="tailwindplus"\]\.bg-white\)/)
  assert.match(css, /:where\(\[data-provider-block="tailwindplus"\] \.bg-white\)/)
  assert.match(css, /:where\(\[data-provider-chrome="tailwindplus"\]\.bg-white\)/)
  assert.match(css, /background-color:var\(--color-tailwindplus-surface,var\(--color-bg,#ffffff\)\)/)
  assert.equal(css.includes(".text-white"), false)
})

test("themeToCssVars applies dark provider aliases through the existing dark mode scope", () => {
  const css = themeToCssVars(theme)

  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-white:#020617/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-gray-900:#fafafa/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-gray-500:#a1a1aa/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-gray-50:#18181b/)
})
