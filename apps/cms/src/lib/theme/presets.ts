import type { PalettePreset } from "@/components/editor/theme/palette-picker"
import type { FontPreset } from "@/components/editor/theme/font-picker"
import type { DensityLevel, RadiusLevel, StylePresetLevel } from "@/components/editor/theme/radius-control"

// ---------------------------------------------------------------------------
// Palette presets
// ---------------------------------------------------------------------------
// Each palette has 4 slots:
//   accent — primary interactive / brand colour
//   bg     — page background
//   ink    — body text
//   muted  — secondary / subdued text
// All values are CSS color strings (hex) so they pass `cssColor` validation
// and map cleanly to --color-* custom properties via toCssVars.
// Each preset ships with a hand-authored light and dark variant — no
// auto-derivation. The consumer picks the half that matches the current mode.
// ---------------------------------------------------------------------------

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: "red",
    label: "Red",
    light: { accent: "#dc2626", bg: "#fff7f7", ink: "#1f1212", muted: "#8f4a4a" },
    dark:  { accent: "#f87171", bg: "#1f0a0a", ink: "#fee2e2", muted: "#c08484" },
  },
  {
    id: "blue",
    label: "Blue",
    light: { accent: "#2563eb", bg: "#f5f9ff", ink: "#111827", muted: "#526480" },
    dark:  { accent: "#60a5fa", bg: "#081526", ink: "#dbeafe", muted: "#8aa7cf" },
  },
  {
    id: "green",
    label: "Green",
    light: { accent: "#16803c", bg: "#f3faf5", ink: "#102018", muted: "#587764" },
    dark:  { accent: "#4ade80", bg: "#07160d", ink: "#dcfce7", muted: "#86b695" },
  },
  {
    id: "amber-gold",
    label: "Amber Gold",
    light: { accent: "#b7791f", bg: "#fffaf0", ink: "#241a0c", muted: "#80683a" },
    dark:  { accent: "#fbbf24", bg: "#1c1405", ink: "#fef3c7", muted: "#c6a65a" },
  },
  {
    id: "mono-slate",
    label: "Mono Slate",
    light: { accent: "#334155", bg: "#ffffff", ink: "#0f172a", muted: "#64748b" },
    dark:  { accent: "#cbd5e1", bg: "#020617", ink: "#f8fafc", muted: "#94a3b8" },
  },
]

// ---------------------------------------------------------------------------
// Font presets
// ---------------------------------------------------------------------------
// Each preset has 3 role slots:
//   title   — large display / hero typeface
//   heading — section headings
//   text    — body / UI copy
// Values are font-family name strings; the renderer wraps them as needed.
// Families must stay limited to the variable fonts loaded by CMS and the
// site renderer: Inter Variable, Fraunces Variable, and Caveat Variable.
//
// The "default" preset carries an empty fonts object — the UI resolves the
// actual families from the tenant's site manifest at render time.
// ---------------------------------------------------------------------------

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "default",
    label: "Generated Style",
    fonts: {}, // empty — UI resolves from tenant manifest at render time
  },
  {
    id: "clear-modern",
    label: "Clear Modern",
    fonts: { title: "Inter Variable", heading: "Inter Variable", text: "Inter Variable" },
  },
  {
    id: "classic-editorial",
    label: "Classic Editorial",
    fonts: { title: "Fraunces Variable", heading: "Fraunces Variable", text: "Inter Variable" },
  },
  {
    id: "friendly-organic",
    label: "Friendly Organic",
    fonts: { title: "Caveat Variable", heading: "Fraunces Variable", text: "Inter Variable" },
  },
  {
    id: "bold-confident",
    label: "Bold Confident",
    fonts: { title: "Inter Variable", heading: "Fraunces Variable", text: "Inter Variable" },
  },
]

// ---------------------------------------------------------------------------
// Radius presets
// ---------------------------------------------------------------------------
// Radius is a tenant theme token just like palette and fonts. Keep the
// application-owned catalog here and pass it into the registry ThemeBar so
// generated tenants can seed shape character without hardcoding tiers inside
// the primitive.
// ---------------------------------------------------------------------------

export const RADIUS_PRESETS: RadiusLevel[] = [
  { id: "rounded", label: "Rounded", value: "1.25rem", icon: "circle" },
  { id: "soft", label: "Soft", value: "0.75rem", icon: "squircle" },
  { id: "subtle", label: "Subtle", value: "0.25rem", icon: "squircle" },
  { id: "square", label: "Square", value: "0", icon: "square" },
]

export const DENSITY_PRESETS: DensityLevel[] = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
]

export const STYLE_PRESETS: StylePresetLevel[] = [
  { id: "catalog-clean", label: "Catalog Clean" },
  { id: "industrial-cleaning", label: "Industrial" },
]
