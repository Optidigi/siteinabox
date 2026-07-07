import assert from "node:assert/strict"
import test from "node:test"
import { PUBLIC_RENDERER_THEME_SCOPE, themeToCssVars } from "./css-vars.ts"

const theme = {
  version: 2,
  appearance: { mode: "light" },
  colors: { schemeId: "blue-professional" },
  fonts: { schemeId: "clear-modern" },
  shape: { schemeId: "soft" },
  density: { schemeId: "comfortable" },
}

test("themeToCssVars keeps Tailwind palette variables literal while bridging provider utility roles", () => {
  const css = themeToCssVars(theme, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(css, /--color-tailwindplus-surface:#ffffff/)
  assert.match(css, /--siab-accent-600:#4f46e5/)
  assert.match(css, /--siab-accent-500:#6366f1/)
  assert.match(css, /--siab-accent-100:#e0e7ff/)
  assert.match(css, /--siab-neutral-900:#111827/)
  assert.equal(css.includes("--color-white:"), false)
  assert.doesNotMatch(css, /--color-gray-\d+:/)
  assert.doesNotMatch(css, /--color-indigo-\d+:/)
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
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-tailwindplus-testimonial-panel:color-mix\(in oklab,#1e1b4b 32%,#030712\)/)
  assert.match(css, /data-theme-zone="fixed-dark"/)
})

test("themeToCssVars bridges source-specific dark media gaps", () => {
  const css = themeToCssVars({ ...theme, appearance: { mode: "dark" } })

  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--color-on-accent:#ffffff/)
  assert.match(css, /\.bg-gray-900[^}]*background-color:#111827/)
  assert.match(css, /\.hover\\:bg-gray-700:hover[^}]*background-color:#374151/)
  assert.match(css, /\.rt-canvas\[data-rt-mode="dark"\]\{[^}]*--tailwindplus-logo-filter:invert\(1\) brightness\(1\.6\) grayscale\(1\)/)
  assert.match(css, /\[data-provider-variant="tailwindplus\.marketing\.logo-cloud\.simple-with-heading"\] img\[src\*="-logo-gray-900\.svg"\]/)
  assert.match(css, /\.flex\.bg-white :is\(input,select\)\{background-color:transparent\}/)
})

test("themeToCssVars emits distinct full typography schemes", () => {
  const classicCss = themeToCssVars({ ...theme, fonts: { schemeId: "classic-editorial" } }, PUBLIC_RENDERER_THEME_SCOPE)
  const friendlyCss = themeToCssVars({ ...theme, fonts: { schemeId: "friendly-organic" } }, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(classicCss, /--font-text:Fraunces Variable, ui-serif/)
  assert.match(classicCss, /--font-heading:Fraunces Variable, ui-serif/)
  assert.match(friendlyCss, /--font-text:"Avenir Next", Avenir, Nunito/)
  assert.match(friendlyCss, /--font-heading:"Avenir Next", Avenir, Nunito/)
  assert.match(classicCss, /:is\(p,dd,li,label,input,select,textarea,button,a,span,div,time,strong,small,figcaption\)/)
  assert.match(classicCss, /:is\(h2,h3,h4,dt,legend,blockquote\)/)
})

test("themeToCssVars bridges active Tailwind Plus accent utilities without class changes", () => {
  const css = themeToCssVars({ ...theme, colors: { schemeId: "red-confident" } }, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(css, /--siab-accent-600:#dc2626/)
  assert.doesNotMatch(css, /--color-indigo-\d+:/)
  assert.match(css, /\[class~="shadow-indigo-600\/10"\][^}]*--tw-shadow-color:color-mix\(in oklab,var\(--color-accent,#4f46e5\) 10%,transparent\)/)
  assert.match(css, /\[class~="from-\[#ff80b5\]"\][^}]*--tw-gradient-from:var\(--siab-accent-300,#a5b4fc\)/)
  assert.match(css, /\[class~="to-\[#9089fc\]"\][^}]*--tw-gradient-to:var\(--siab-accent-600,var\(--color-accent,#4f46e5\)\)/)
  assert.match(css, /\[data-siab-tokenized-gradient="testimonial-radial"\][^}]*background-image:radial-gradient\(45rem 50rem at top,var\(--color-tailwindplus-testimonial-radial-from,var\(--color-indigo-100\)\),var\(--color-tailwindplus-testimonial-radial-to,var\(--color-tailwindplus-surface,var\(--color-bg,#ffffff\)\)\)\)/)
  assert.match(css, /\[class~="bg-\[radial-gradient\(45rem_50rem_at_top,var\(--color-indigo-100\),white\)\]"\][^}]*background-image:radial-gradient\(45rem 50rem at top,var\(--color-tailwindplus-testimonial-radial-from,var\(--color-indigo-100\)\),var\(--color-tailwindplus-testimonial-radial-to,var\(--color-tailwindplus-surface,var\(--color-bg,#ffffff\)\)\)\)/)
  assert.match(css, /\[data-siab-tokenized-gradient="testimonial-skew-panel"\][^}]*background-color:var\(--color-tailwindplus-testimonial-panel,var\(--color-tailwindplus-card,var\(--color-bg,#ffffff\)\)\)/)
  assert.match(css, /\[class~="fill-gray-900"\][^}]*fill:var\(--siab-neutral-900/)
  assert.match(css, /\[class~="focus-visible:outline-gray-900"\]\):focus-visible[^}]*outline-color:var\(--siab-neutral-900/)
  assert.match(css, /\[class~="bg-white\/5"\][^}]*background-color:rgb\(255 255 255 \/ 0\.05\)/)
  assert.match(css, /\[class~="ring-white\/10"\][^}]*--tw-ring-color:rgb\(255 255 255 \/ 0\.1\)/)
})

test("themeToCssVars preserves selected accent tokens inside fixed dark Tailwind Plus zones", () => {
  const css = themeToCssVars({ ...theme, colors: { schemeId: "red-confident" } }, PUBLIC_RENDERER_THEME_SCOPE)
  const fixedDarkRule = css.match(/[^{}]*data-theme-zone="fixed-dark"[^{}]*\{[^}]*\}/)?.[0] ?? ""

  assert.match(fixedDarkRule, /data-theme-zone="fixed-dark"/)
  assert.match(fixedDarkRule, /--color-bg:#ffffff/)
  assert.match(fixedDarkRule, /--color-card:#ffffff/)
  assert.match(fixedDarkRule, /--color-ink:#111827/)
  assert.match(fixedDarkRule, /--color-ink-muted:#4b5563/)
  assert.match(css, /--siab-accent-500:#ef4444/)
  assert.match(css, /--siab-accent-600:#dc2626/)
  assert.doesNotMatch(fixedDarkRule, /--siab-accent-500:#6366f1/)
  assert.doesNotMatch(fixedDarkRule, /--siab-accent-600:#4f46e5/)
  assert.doesNotMatch(fixedDarkRule, /--color-indigo-500:#6366f1/)
  assert.doesNotMatch(fixedDarkRule, /--color-indigo-600:#4f46e5/)
})

test("themeToCssVars keeps accent foregrounds readable while preserving fixed dark white text", () => {
  const css = themeToCssVars({ ...theme, colors: { schemeId: "amber-warm" } }, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(css, /--color-on-accent-500:#111827/)
  assert.match(css, /--color-on-accent-400:#111827/)
  assert.match(css, /\.bg-indigo-600\.text-white[^}]*color:var\(--color-on-accent,#ffffff\)/)
  assert.match(css, /\.bg-indigo-500\.text-white[^}]*color:var\(--color-on-accent-500,var\(--color-on-accent,#ffffff\)\)/)
  assert.match(css, /\.bg-indigo-400\.text-white[^}]*color:var\(--color-on-accent-400,var\(--color-on-accent,#ffffff\)\)/)
  assert.match(css, /data-theme-zone="fixed-dark"[^}]*\.text-white[^}]*color:#ffffff/)
  assert.match(css, /\.bg-gray-900\.text-white[^}]*color:#ffffff/)
  assert.doesNotMatch(css, /\.bg-indigo-500\.text-white[^}]*color:#000000/)
  assert.doesNotMatch(css, /\.bg-indigo-400\.text-white[^}]*color:#000000/)
})

test("themeToCssVars emits full radius scale and section-only density bridge", () => {
  const roundedCss = themeToCssVars({ ...theme, shape: { schemeId: "rounded" } }, PUBLIC_RENDERER_THEME_SCOPE)
  const softCss = themeToCssVars(theme, PUBLIC_RENDERER_THEME_SCOPE)
  const compactCss = themeToCssVars({ ...theme, density: { schemeId: "compact" } }, PUBLIC_RENDERER_THEME_SCOPE)

  assert.match(roundedCss, /--radius-md:1rem/)
  assert.match(roundedCss, /--radius-4xl:3\.5rem/)
  assert.match(softCss, /--radius-md:0\.375rem/)
  assert.match(softCss, /--radius-4xl:2rem/)
  assert.doesNotMatch(softCss, /:is\(\.py-16,\.py-24,\.py-32\)/)
  assert.match(compactCss, /--site-section-padding-y:4rem/)
  assert.match(compactCss, /:is\(\.py-16,\.py-24,\.py-32\)/)
  assert.match(compactCss, /:is\(\.sm\\:py-24,\.sm\\:py-32,\.sm\\:py-48\)/)
  assert.match(compactCss, /:is\(\.lg\\:py-32,\.lg\\:py-56\)/)
})
