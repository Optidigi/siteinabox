import type {
  ColorRamp,
  DensityScheme,
  FontScheme,
  ProviderColorScheme,
  ProviderColorSchemeMode,
  ShapeScheme,
  ThemeTokenSpec,
  ThemeTokenSpecV1,
  ThemeTokenSpecV2,
} from "@siteinabox/contracts"

const gray: ColorRamp = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
  950: "#030712",
}

const grayDark: ColorRamp = {
  50: gray[950] ?? "#030712",
  100: gray[900],
  200: gray[800],
  300: gray[700],
  400: gray[500],
  500: gray[400],
  600: gray[300],
  700: gray[200],
  800: gray[100],
  900: gray[50],
  950: "#ffffff",
}

const indigo: ColorRamp = {
  50: "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  600: "#4f46e5",
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
  950: "#1e1b4b",
}

const emerald: ColorRamp = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
  950: "#022c22",
}

const slate: ColorRamp = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617",
}

const slateDark: ColorRamp = {
  50: slate[950] ?? "#020617",
  100: slate[900],
  200: slate[800],
  300: slate[700],
  400: slate[500],
  500: slate[400],
  600: slate[300],
  700: slate[200],
  800: slate[100],
  900: slate[50],
  950: "#ffffff",
}

const defaultLight: ProviderColorSchemeMode = {
  neutral: gray,
  accent: indigo,
  surface: "#ffffff",
  ink: gray[900],
  muted: gray[600],
  rule: gray[200],
  onAccent: "#ffffff",
}

const tailwindSansStack = "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"

const defaultDark: ProviderColorSchemeMode = {
  neutral: grayDark,
  accent: indigo,
  surface: gray[950] ?? "#030712",
  ink: gray[50],
  muted: gray[300],
  rule: "rgba(255,255,255,0.12)",
  onAccent: "#ffffff",
}

export const colorSchemes = {
  "tailwind-default": {
    id: "tailwind-default",
    label: "Tailwind default",
    source: "tailwind",
    light: defaultLight,
    dark: defaultDark,
  },
  "tailwind-emerald": {
    id: "tailwind-emerald",
    label: "Tailwind emerald",
    source: "tailwind",
    light: { ...defaultLight, accent: emerald },
    dark: { ...defaultDark, accent: emerald },
  },
  "tailwind-slate": {
    id: "tailwind-slate",
    label: "Tailwind slate",
    source: "tailwind",
    light: { ...defaultLight, neutral: slate, accent: indigo, ink: slate[900], muted: slate[600], rule: slate[200] },
    dark: { ...defaultDark, neutral: slateDark, accent: indigo, surface: slate[950] ?? "#020617", ink: slate[50], muted: slate[300] },
  },
} as const satisfies Record<string, ProviderColorScheme>

export const fontSchemes = {
  "tailwind-default": {
    id: "tailwind-default",
    label: "Tailwind default",
    source: "tailwind",
    roles: { body: tailwindSansStack, heading: tailwindSansStack, display: tailwindSansStack, mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  system: {
    id: "system",
    label: "System",
    source: "system",
    roles: { body: "system-ui, sans-serif", heading: "system-ui, sans-serif", display: "system-ui, sans-serif", mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "editorial-serif": {
    id: "editorial-serif",
    label: "Editorial serif",
    source: "system",
    roles: { body: "Inter Variable", heading: "Fraunces Variable", display: "Fraunces Variable", mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
} as const satisfies Record<string, FontScheme>

export const densitySchemes = {
  "tailwind-default": { id: "tailwind-default", label: "Tailwind default", sectionPaddingY: { base: "6rem", sm: "8rem" }, interBlockGap: "0" },
  compact: { id: "compact", label: "Compact", sectionPaddingY: { base: "4rem", sm: "5rem" }, interBlockGap: "0" },
  comfortable: { id: "comfortable", label: "Comfortable", sectionPaddingY: { base: "7rem", sm: "9rem" }, interBlockGap: "0" },
} as const satisfies Record<string, DensityScheme>

export const shapeSchemes = {
  "tailwind-default": { id: "tailwind-default", label: "Tailwind default", radius: { none: "0", sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem", full: "9999px" } },
  sharp: { id: "sharp", label: "Sharp", radius: { none: "0", sm: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "9999px" } },
  soft: { id: "soft", label: "Soft", radius: { none: "0", sm: "0.375rem", md: "0.5rem", lg: "0.75rem", xl: "1rem", "2xl": "1.25rem", "3xl": "1.75rem", full: "9999px" } },
  rounded: { id: "rounded", label: "Rounded", radius: { none: "0", sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.25rem", "2xl": "1.75rem", "3xl": "2.25rem", full: "9999px" } },
} as const satisfies Record<string, ShapeScheme>

export type ResolvedTheme = {
  version: 2
  mode: "light" | "dark" | "system"
  defaultMode: "light" | "dark"
  light: ProviderColorSchemeMode
  dark: ProviderColorSchemeMode
  fonts: FontScheme
  density: DensityScheme
  shape: ShapeScheme
}

function hexToRgb(value: string | undefined | null): { r: number; g: number; b: number } | null {
  if (!value) return null
  const hex = value.trim().replace(/^#/, "")
  const expanded = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

function relativeLuminance(color: { r: number; g: number; b: number }) {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b))
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

function readableOnAccent(value: string | undefined | null, fallback: string) {
  const accent = hexToRgb(value)
  if (!accent) return fallback
  const white = { r: 255, g: 255, b: 255 }
  const ink = { r: 17, g: 24, b: 39 }
  return contrastRatio(accent, white) >= contrastRatio(accent, ink) ? "#ffffff" : "#111827"
}

function isV2(theme: ThemeTokenSpec | null | undefined): theme is ThemeTokenSpecV2 {
  return Boolean(theme && "version" in theme && theme.version === 2)
}

function v1ToColorMode(theme: ThemeTokenSpecV1 | null | undefined, mode: "light" | "dark"): ProviderColorSchemeMode {
  const source = mode === "dark" ? theme?.darkColors : theme?.colors
  const fallback = mode === "dark" ? defaultDark : defaultLight
  const accent = source?.accent
    ? {
        50: source.accent,
        100: source.accent,
        200: source.accent,
        300: source.accent,
        400: source.accent,
        500: source.accent,
        600: source.accent,
        700: source.accent,
        800: source.accent,
        900: source.accent,
        950: source.accent,
      }
    : fallback.accent
  return {
    neutral: fallback.neutral,
    accent,
    surface: source?.bg ?? fallback.surface,
    ink: source?.ink ?? fallback.ink,
    muted: source?.muted ?? fallback.muted,
    rule: source?.rule ?? fallback.rule,
    onAccent: source?.onAccent ?? readableOnAccent(source?.accent, fallback.onAccent),
  }
}

export function resolveThemeTokens(theme: ThemeTokenSpec | null | undefined): ResolvedTheme {
  if (isV2(theme)) {
    const custom = theme.colors?.custom
    const scheme = custom ?? colorSchemes[theme.colors?.schemeId as keyof typeof colorSchemes] ?? colorSchemes["tailwind-default"]
    const lightScheme = custom ?? colorSchemes[theme.colors?.lightSchemeId as keyof typeof colorSchemes] ?? scheme
    const darkScheme = custom ?? colorSchemes[theme.colors?.darkSchemeId as keyof typeof colorSchemes] ?? scheme
    const fonts = theme.fonts?.custom ?? fontSchemes[theme.fonts?.schemeId as keyof typeof fontSchemes] ?? fontSchemes["tailwind-default"]
    return {
      version: 2,
      mode: theme.appearance?.mode ?? "light",
      defaultMode: theme.appearance?.defaultMode ?? "light",
      light: lightScheme.light,
      dark: darkScheme.dark,
      fonts,
      density: densitySchemes[theme.density?.schemeId as keyof typeof densitySchemes] ?? densitySchemes["tailwind-default"],
      shape: shapeSchemes[theme.shape?.schemeId as keyof typeof shapeSchemes] ?? shapeSchemes["tailwind-default"],
    }
  }

  const radius = theme?.radius
  const density = theme?.density === "compact" ? densitySchemes.compact : theme?.density === "comfortable" || theme?.density === "spacious" ? densitySchemes.comfortable : densitySchemes["tailwind-default"]
  const shape = radius
    ? { id: "legacy-custom", label: "Legacy custom", radius: { none: "0", sm: radius, md: radius, lg: radius, xl: radius, "2xl": radius, "3xl": radius, full: "9999px" } }
    : shapeSchemes["tailwind-default"]
  return {
    version: 2,
    mode: theme?.mode ?? "light",
    defaultMode: "light",
    light: v1ToColorMode(theme, "light"),
    dark: v1ToColorMode(theme, "dark"),
    fonts: {
      id: "legacy-custom",
      label: "Legacy custom",
      source: "custom",
      roles: {
        body: theme?.fonts?.text ?? fontSchemes["tailwind-default"].roles.body,
        heading: theme?.fonts?.heading ?? fontSchemes["tailwind-default"].roles.heading,
        display: theme?.fonts?.title ?? theme?.fonts?.heading ?? fontSchemes["tailwind-default"].roles.display,
        mono: fontSchemes["tailwind-default"].roles.mono,
      },
    },
    density,
    shape,
  }
}
