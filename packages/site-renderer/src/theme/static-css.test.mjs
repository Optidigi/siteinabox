import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { COLOR_SCHEME_IDS, FONT_SCHEME_IDS, SHAPE_SCHEME_IDS } from "@siteinabox/contracts"
import { generateStaticThemeCss } from "./static-css.ts"

const generatedUrl = new URL("../theme-presets.generated.css", import.meta.url)

test("committed theme CSS exactly matches the canonical preset generator", async () => {
  assert.equal(await readFile(generatedUrl, "utf8"), generateStaticThemeCss())
})

test("theme CSS covers every approved preset and contains no retired provider presets", () => {
  const css = generateStaticThemeCss()
  for (const id of COLOR_SCHEME_IDS) assert.match(css, new RegExp(`data-theme-color="${id}"`))
  for (const id of FONT_SCHEME_IDS) assert.match(css, new RegExp(`data-theme-font="${id}"`))
  for (const id of SHAPE_SCHEME_IDS) assert.match(css, new RegExp(`data-theme-shape="${id}"`))
  assert.deepEqual(SHAPE_SCHEME_IDS, ["rounded", "soft", "sharp"])
  assert.match(css, /data-theme-shape="soft"[^}]*--radius:0\.625rem[^}]*--radius-md:0\.5rem[^}]*--radius-2xl:1\.125rem/)
  assert.doesNotMatch(css, /shadcn-neutral|shadcn-geist|shadcn-default|color-mix/)
})

test("monochrome is the exact upstream light and dark semantic token reference", () => {
  const css = generateStaticThemeCss()
  assert.match(css, /data-theme-color="monochrome"[^}]*--background:oklch\(1 0 0\)[^}]*--primary:oklch\(0\.205 0 0\)[^}]*--provider-surface:var\(--background\)/)
  assert.match(css, /data-theme-color="monochrome"\]\[data-rt-mode="dark"\][^}]*--background:oklch\(0\.145 0 0\)[^}]*--card:oklch\(0\.205 0 0\)[^}]*--provider-surface:var\(--background\)/)
})

test("colored themes use explicit paired surface values and dark tinting", () => {
  const css = generateStaticThemeCss()
  for (const id of COLOR_SCHEME_IDS.filter((id) => id !== "monochrome")) {
    assert.match(css, new RegExp(`data-theme-color="${id}"[^}]*--background:oklch\\(0\\.992 0\\.006`))
    assert.match(css, new RegExp(`data-theme-color="${id}"\\]\\[data-rt-mode="dark"\\][^}]*--background:oklch\\(0\\.145 0\\.012`))
  }
})

test("every color scheme emits secondary accent ramps for dual-tone surfaces", () => {
  const css = generateStaticThemeCss()
  // Shared slate secondary across every scheme; primary stays scheme-specific.
  for (const id of COLOR_SCHEME_IDS) {
    assert.match(css, new RegExp(`data-theme-color="${id}"[^}]*--provider-accent-secondary-600:#475569`))
  }
  assert.match(css, /data-theme-color="monochrome"[^}]*--provider-accent-600:#475569/)
  assert.match(css, /data-theme-color="blue-professional"[^}]*--provider-accent-600:#4f46e5/)
  assert.match(css, /data-theme-color="red-confident"[^}]*--provider-accent-600:#dc2626/)
  assert.match(css, /data-theme-color="emerald-calm"[^}]*--provider-accent-600:#059669/)
})

test("colored themes keep brand continuity with a modest dark lift", () => {
  const css = generateStaticThemeCss()
  const block = (id, dark) => {
    const re = dark
      ? new RegExp(`\\[data-theme-color="${id}"\\]\\[data-rt-mode="dark"\\][^{]*\\{([^}]+)\\}`)
      : new RegExp(`\\[data-theme-color="${id}"\\]:not\\(\\[data-rt-mode="dark"\\]\\)\\{([^}]+)\\}`)
    const match = css.match(re)
    assert.ok(match, `${id} ${dark ? "dark" : "light"} block`)
    return match[1]
  }
  const token = (source, name) => {
    const match = source.match(new RegExp(`--${name}:([^;]+)`))
    assert.ok(match, `--${name}`)
    return match[1]
  }

  assert.equal(token(block("blue-professional", false), "primary"), "#4338ca")
  assert.equal(token(block("blue-professional", false), "color-accent"), "#4f46e5")
  assert.equal(token(block("blue-professional", true), "primary"), "#6366f1")
  assert.equal(token(block("blue-professional", true), "color-accent"), "#6366f1")
  assert.equal(token(block("blue-professional", true), "accent"), "#312e81")
  assert.equal(token(block("emerald-calm", true), "primary"), "#10b981")
  assert.equal(token(block("terracotta-warm", true), "primary"), "#c45f41")
  // Red / amber keep the previous soft dark 400 lift.
  assert.equal(token(block("red-confident", true), "primary"), "#f87171")
  assert.equal(token(block("red-confident", true), "color-accent"), "#f87171")
  // Amber stays yellow-gold in both modes (#f59e0b); surfaces carry the mode difference.
  assert.equal(token(block("amber-warm", false), "primary"), "#f59e0b")
  assert.equal(token(block("amber-warm", false), "color-accent"), "#f59e0b")
  assert.equal(token(block("amber-warm", false), "primary-foreground"), "oklch(0.145 0.012 75)")
  assert.equal(token(block("amber-warm", true), "primary"), "#f59e0b")
  assert.equal(token(block("amber-warm", true), "color-accent"), "#f59e0b")
})

test("monochrome provider accents stay on the same slate ramp in dark mode", () => {
  const css = generateStaticThemeCss()
  const block = (dark) => {
    const re = dark
      ? /\[data-theme-color="monochrome"\]\[data-rt-mode="dark"\][^{]*\{([^}]+)\}/
      : /\[data-theme-color="monochrome"\]:not\(\[data-rt-mode="dark"\]\)\{([^}]+)\}/
    const match = css.match(re)
    assert.ok(match, `monochrome ${dark ? "dark" : "light"} block`)
    return match[1]
  }
  const token = (source, name) => source.match(new RegExp(`--${name}:([^;]+)`))[1]

  assert.equal(token(block(false), "provider-accent-600"), "#475569")
  assert.equal(token(block(true), "provider-accent-600"), "#475569")
  assert.equal(token(block(true), "color-accent"), "#64748b")
})

test("terracotta uses the Ami-care brand color as its light primary", () => {
  const css = generateStaticThemeCss()
  assert.match(css, /data-theme-color="terracotta-warm"[^}]*--primary:#a04e32/)
})

test("semantic controls override literal rounded-full without changing structural circles", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const hero = await readFile(new URL("../providers/shadcnui-blocks/variants/hero-01/hero.tsx", import.meta.url), "utf8")
  assert.match(hero, /<Button[^>]*rounded-full/)
  assert.match(styles, /data-provider-token-mode="theme"\][^{]*\[data-slot="button"\][^{]*\{\s*border-radius: var\(--siab-radius-control\)/)
  assert.doesNotMatch(styles, /\.rounded-full\s*\{[^}]*siab-radius-control/)
})
