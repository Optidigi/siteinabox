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
    id: "warm-sand",
    label: "Warm Sand",
    light: { accent: "#c97c2e", bg: "#faf7f2", ink: "#2c2318", muted: "#8a7966" },
    dark:  { accent: "#e09354", bg: "#1f1812", ink: "#f5ede0", muted: "#a89683" },
  },
  {
    id: "slate-sky",
    label: "Slate & Sky",
    light: { accent: "#3b82f6", bg: "#f8fafc", ink: "#1e293b", muted: "#64748b" },
    dark:  { accent: "#60a5fa", bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8" },
  },
  {
    id: "forest",
    label: "Forest",
    light: { accent: "#4a7c59", bg: "#f4f9f4", ink: "#1c2e22", muted: "#6b8f74" },
    dark:  { accent: "#6fae82", bg: "#0e1a13", ink: "#dceee0", muted: "#8aab93" },
  },
  {
    id: "mono",
    label: "Mono",
    light: { accent: "#18181b", bg: "#ffffff", ink: "#09090b", muted: "#71717a" },
    dark:  { accent: "#fafafa", bg: "#09090b", ink: "#fafafa", muted: "#a1a1aa" },
  },
  {
    id: "rose",
    label: "Rose",
    light: { accent: "#e11d48", bg: "#fff5f7", ink: "#1f0a0e", muted: "#9f4155" },
    dark:  { accent: "#fb7185", bg: "#1a070b", ink: "#fde7eb", muted: "#bb6677" },
  },
  {
    id: "midnight",
    label: "Midnight",
    light: { accent: "#6366f1", bg: "#f5f5ff", ink: "#1e1b4b", muted: "#6b6e98" },
    dark:  { accent: "#818cf8", bg: "#0f0f18", ink: "#e2e8f0", muted: "#94a3b8" },
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
// Families are chosen from Fontsource-available fonts so the tenant can load
// them via @fontsource/* packages without hitting Google Fonts in production.
//
// The "default" preset carries an empty fonts object — the UI resolves the
// actual families from the tenant's site manifest at render time.
// ---------------------------------------------------------------------------

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "default",
    label: "Default",
    fonts: {}, // empty — UI resolves from tenant manifest at render time
  },
  {
    id: "sans",
    label: "Sans",
    fonts: { title: "Inter", heading: "Inter", text: "Inter" },
  },
  {
    id: "serif",
    label: "Serif",
    fonts: { title: "Playfair Display", heading: "Lora", text: "Source Sans 3" },
  },
  {
    id: "display",
    label: "Display",
    fonts: { title: "Pacifico", heading: "Playfair Display", text: "Geist" },
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
  { id: "sharp", label: "Sharp", value: "0", icon: "square" },
  { id: "soft", label: "Soft", value: "0.5rem", icon: "squircle" },
  { id: "round", label: "Round", value: "1.5rem", icon: "circle" },
]

export const DENSITY_PRESETS: DensityLevel[] = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
]

export const STYLE_PRESETS: StylePresetLevel[] = [
  { id: "warm-care", label: "Warm Care" },
  { id: "industrial-cleaning", label: "Industrial" },
]
