import type { ThemeTokens } from "./schema"

/**
 * Converts a ThemeTokens object to a CSS rule string scoped to `.rt-canvas`.
 *
 * Emits two rules when `darkPalette` is set:
 *   .rt-canvas { ... }
 *   .rt-canvas[data-rt-mode="dark"] { ...dark palette overrides... }
 *
 * `CanvasMode` stamps `data-rt-mode="dark"` on the canvas surface when
 * `theme.mode === "dark"`, so the overlay rule wins.
 *
 * Returns "" if there is nothing to emit.
 *
 * Pure function — no React, no server-only imports. Safe to use in unit tests
 * and anywhere the module graph cannot carry React.
 *
 * Mapping — the property names MUST match the custom properties the compiled
 * tenant bundle (`cms-editor.css`) actually declares and consumes via `var()`,
 * otherwise an override is emitted but nothing reads it. The block renderers
 * in `src/components/editor/canvas/blocks/` consume the role tokens directly
 * via inline style props (`var(--font-title)` etc.).
 *   palette.accent     → --color-accent
 *   palette.bg         → --color-bg
 *   palette.ink        → --color-ink
 *   palette.muted      → --color-ink-muted
 *   darkPalette.*      → same names, inside the [data-rt-mode="dark"] block
 *   fonts.title        → --font-title
 *   fonts.heading      → --font-heading
 *   fonts.text         → --font-text
 *   radius             → --radius-md (canonical); derives --radius-sm and --radius-lg
 *   density            → --site-density
 *   stylePreset        → --site-style-preset
 *   borderStyle        → --border-style
 */

function parseLength(value: string): { num: number; unit: string } | null {
  const m = value.match(/^([\d.]+)([a-z%]*)$/i)
  if (!m || m[1] === undefined) return null
  const num = parseFloat(m[1])
  if (Number.isNaN(num)) return null
  return { num, unit: (m[2] !== undefined && m[2] !== "") ? m[2] : "rem" }
}

function deriveRadii(md: string): Array<[string, string]> {
  const parsed = parseLength(md)
  if (!parsed) return []
  const { unit } = parsed
  const sm = Math.max(parsed.num - 0.25, 0)
  const lg = parsed.num + 0.5
  return [
    ["--radius-sm", `${sm}${unit}`],
    ["--radius-md", md],
    ["--radius-lg", `${lg}${unit}`],
  ]
}

// Default dark fallback — used by the site when `theme.mode === "dark"` but
// no `darkPalette` is saved (the "Default + Dark" case). Intentionally
// omits `accent` so the tenant's base accent (e.g. Amicare's coral) keeps
// shining through. The remaining tokens MUST mirror the canvas rule in
// `src/styles/globals.css` `.rt-canvas[data-rt-mode="dark"]` so canvas
// preview and published site look identical:
//   bg / ink / ink-muted → page surface + body text
//   card                 → floating cards / surfaces above the page
//   secondary            → muted surfaces (pills, chips)
//   rule                 → hairline borders / dividers
const DEFAULT_DARK = {
  bg: "#09090b",
  ink: "#fafafa",
  muted: "#a1a1aa",
  card: "#18181b",
  secondary: "#27272a",
  rule: "rgba(255, 255, 255, 0.12)",
} as const

export function toCssVars(
  theme: ThemeTokens | null | undefined,
  scope: ".rt-canvas" | ":root" = ".rt-canvas"
): string {
  if (!theme) return ""

  const baseParts: string[] = []
  const darkParts: string[] = []

  const set = (parts: string[], prop: string, value: string | undefined | null) => {
    if (value != null && value !== "") parts.push(`${prop}:${value}`)
  }

  // Site (`:root` scope) is rendered statically per deploy — there is no
  // runtime light/dark toggle, so collapse to a single ruleset based on
  // `theme.mode`. The canvas (`.rt-canvas` scope) still gets the layered
  // light + `[data-rt-mode="dark"]` overlay because the ThemeBar Switch
  // flips modes live without re-projection.
  const flatten = scope === ":root" && theme.mode === "dark"

  if (flatten) {
    // Dark wins surface + ink tokens when the site is in dark mode.
    // `--color-accent` is ONLY overridden when the user explicitly saved a
    // darkPalette — otherwise we leave it unset so the tenant's existing
    // base accent (loaded from the site's own `:root`) keeps showing.
    // This matches the canvas rule in `globals.css` and prevents the
    // "Default + Dark" pages from rendering accent-less black-and-white.
    const dp = theme.darkPalette
    if (dp?.accent) set(baseParts, "--color-accent", dp.accent)
    set(baseParts, "--color-bg", dp?.bg ?? DEFAULT_DARK.bg)
    set(baseParts, "--color-ink", dp?.ink ?? DEFAULT_DARK.ink)
    set(baseParts, "--color-ink-muted", dp?.muted ?? DEFAULT_DARK.muted)
    // Surface tokens that the site components (floating cards, pills,
    // hairline borders) consume. Tenant `darkPalette` doesn't currently
    // carry these — they have no light-mode equivalent in the schema's
    // 4-slot palette — so we always project the fallback so a "Default +
    // Dark" site doesn't leave card / secondary / rule reading their
    // base-CSS LIGHT values against a now-dark page.
    set(baseParts, "--color-card", DEFAULT_DARK.card)
    set(baseParts, "--color-secondary", DEFAULT_DARK.secondary)
    set(baseParts, "--color-rule", DEFAULT_DARK.rule)
  } else {
    if (theme.palette) {
      set(baseParts, "--color-accent", theme.palette.accent)
      set(baseParts, "--color-bg", theme.palette.bg)
      set(baseParts, "--color-ink", theme.palette.ink)
      set(baseParts, "--color-ink-muted", theme.palette.muted)
    }

    if (theme.darkPalette) {
      set(darkParts, "--color-accent", theme.darkPalette.accent)
      set(darkParts, "--color-bg", theme.darkPalette.bg)
      set(darkParts, "--color-ink", theme.darkPalette.ink)
      set(darkParts, "--color-ink-muted", theme.darkPalette.muted)
    }
  }

  // Emit role tokens ONLY when the user picked a font preset. Falling back to
  // `var(--font-serif)` etc. would resolve to the admin's ui-serif system
  // family inside .rt-canvas (OBS-46: tenant cms-editor.css is raw Tailwind
  // source, so the tenant's @theme `--font-serif: Fraunces Variable` never
  // applies to .rt-canvas — only the admin's html-level fallback does).
  // Letting the tokens stay unset means canvas elements with `var(--font-X)`
  // fall through to the admin chrome font cascade — visually the same as
  // before Phase 4c. Live site has its own :root aliases (independent path).
  if (theme.fonts) {
    set(baseParts, "--font-title", theme.fonts.title)
    set(baseParts, "--font-heading", theme.fonts.heading)
    set(baseParts, "--font-text", theme.fonts.text)
  }

  if (theme.radius) {
    for (const [prop, value] of deriveRadii(theme.radius)) {
      set(baseParts, prop, value)
    }
  }
  set(baseParts, "--site-density", theme.density)
  set(baseParts, "--site-style-preset", theme.stylePreset)
  set(baseParts, "--border-style", theme.borderStyle)

  // Site (`:root`) scope: bump specificity by emitting `html:root` instead
  // of `:root`. Astro/Vite injects the compiled Tailwind bundle's own
  // `:root { ... }` block AFTER our `<style data-tenant-theme>` tag in the
  // dev head, so at equal specificity the bundle wins the cascade and the
  // override silently does nothing. `html:root` is (0,0,1,1) vs Tailwind's
  // `:root` (0,0,1,0) → tenant override wins regardless of source order.
  // Canvas (`.rt-canvas`) scope keeps its own selector — the canvas
  // overlay is injected at runtime via React and already wins by order.
  const baseSelector = scope === ":root" ? "html:root" : scope
  const darkSelector = scope === ":root" ? `html:root[data-rt-mode="dark"]` : `${scope}[data-rt-mode="dark"]`

  const rules: string[] = []
  if (baseParts.length > 0) rules.push(`${baseSelector}{${baseParts.join(";")}}`)
  if (darkParts.length > 0) rules.push(`${darkSelector}{${darkParts.join(";")}}`)

  return rules.join(" ")
}
