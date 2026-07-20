import type {
  ColorRamp,
  FontScheme,
  ProviderColorScheme,
  ProviderColorSchemeMode,
  ShapeScheme,
  ThemeTokenSpec,
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
  50: gray[900],
  100: gray[800],
  200: gray[700],
  300: gray[600],
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

const blue: ColorRamp = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
  950: "#172554",
}

const amber: ColorRamp = {
  50: "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  900: "#78350f",
  950: "#451a03",
}

const red: ColorRamp = {
  50: "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
  900: "#7f1d1d",
  950: "#450a0a",
}

const terracotta: ColorRamp = {
  50: "#fdf6f3",
  100: "#f8e8e1",
  200: "#f1d1c5",
  300: "#e5aa95",
  400: "#d67f61",
  500: "#c45f41",
  600: "#b04f34",
  700: "#a04e32",
  800: "#7f3b28",
  900: "#683226",
  950: "#371811",
}

/** Companion ramps for dual-tone decorative surfaces (hero blobs, beams). */
const violet: ColorRamp = {
  50: "#f5f3ff",
  100: "#ede9fe",
  200: "#ddd6fe",
  300: "#c4b5fd",
  400: "#a78bfa",
  500: "#8b5cf6",
  600: "#7c3aed",
  700: "#6d28d9",
  800: "#5b21b6",
  900: "#4c1d95",
  950: "#2e1065",
}

const orange: ColorRamp = {
  50: "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  300: "#fdba74",
  400: "#fb923c",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
  800: "#9a3412",
  900: "#7c2d12",
  950: "#431407",
}

const lime: ColorRamp = {
  50: "#f7fee7",
  100: "#ecfccb",
  200: "#d9f99d",
  300: "#bef264",
  400: "#a3e635",
  500: "#84cc16",
  600: "#65a30d",
  700: "#4d7c0f",
  800: "#3f6212",
  900: "#365314",
  950: "#1a2e05",
}

const rose: ColorRamp = {
  50: "#fff1f2",
  100: "#ffe4e6",
  200: "#fecdd3",
  300: "#fda4af",
  400: "#fb7185",
  500: "#f43f5e",
  600: "#e11d48",
  700: "#be123c",
  800: "#9f1239",
  900: "#881337",
  950: "#4c0519",
}

const modernSansStack = "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
const editorialSerifStack = "Fraunces Variable, ui-serif, Georgia, Cambria, \"Times New Roman\", Times, serif"
const humanistSansStack = "\"Nunito Variable\", Nunito, ui-sans-serif, system-ui, sans-serif"

type SemanticColors = {
  destructive: string
  destructiveForeground: string
  success: string
  successForeground: string
  warning: string
  warningForeground: string
  rating: string
  charts: readonly [string, string, string, string, string]
  overlay: string
  onMedia: string
}

const semanticColors = (accent: ColorRamp, dark: boolean): SemanticColors => ({
  destructive: dark ? "#f87171" : "#dc2626",
  destructiveForeground: "#ffffff",
  success: dark ? "#34d399" : "#059669",
  successForeground: dark ? (gray[950] ?? "#030712") : "#ffffff",
  warning: dark ? "#fbbf24" : "#d97706",
  warningForeground: gray[950] ?? "#030712",
  rating: dark ? "#fcd34d" : "#eab308",
  charts: dark
    ? [accent[400], "#34d399", "#fbbf24", "#f87171", "#a78bfa"]
    : [accent[600], "#059669", "#d97706", "#dc2626", "#7c3aed"],
  overlay: dark ? "rgba(0,0,0,0.64)" : "rgba(0,0,0,0.56)",
  onMedia: "#ffffff",
})

const tintedMode = (
  accent: ColorRamp,
  accentSecondary: ColorRamp,
  hue: number,
  dark: boolean,
): ProviderColorSchemeMode => dark
  ? {
      neutral: grayDark,
      accent,
      accentSecondary,
      surface: `oklch(0.145 0.012 ${hue})`,
      ink: "oklch(0.985 0.002 260)",
      muted: "oklch(0.708 0.012 260)",
      rule: `oklch(0.985 0.01 ${hue} / 12%)`,
      onAccent: "#ffffff",
    }
  : {
      neutral: gray,
      accent,
      accentSecondary,
      surface: `oklch(0.992 0.006 ${hue})`,
      ink: "oklch(0.145 0.004 260)",
      muted: "oklch(0.48 0.012 260)",
      rule: `oklch(0.89 0.012 ${hue})`,
      onAccent: "#ffffff",
    }

export const colorSchemes = {
  monochrome: {
    id: "monochrome",
    label: "Monochrome",
    source: "builtin",
    light: {
      neutral: gray,
      accent: gray,
      surface: "oklch(1 0 0)",
      ink: "oklch(0.145 0 0)",
      muted: "oklch(0.556 0 0)",
      rule: "oklch(0.922 0 0)",
      onAccent: "oklch(0.985 0 0)",
    },
    dark: {
      neutral: grayDark,
      accent: grayDark,
      surface: "oklch(0.145 0 0)",
      ink: "oklch(0.985 0 0)",
      muted: "oklch(0.708 0 0)",
      rule: "oklch(1 0 0 / 10%)",
      onAccent: "oklch(0.205 0 0)",
    },
  },
  "blue-professional": {
    id: "blue-professional",
    label: "Blue Professional",
    source: "builtin",
    light: tintedMode(indigo, violet, 264, false),
    dark: tintedMode(indigo, violet, 264, true),
  },
  "red-confident": {
    id: "red-confident",
    label: "Red Confident",
    source: "builtin",
    light: tintedMode(red, orange, 25, false),
    dark: tintedMode(red, orange, 25, true),
  },
  "emerald-calm": {
    id: "emerald-calm",
    label: "Emerald Calm",
    source: "builtin",
    light: tintedMode(emerald, lime, 165, false),
    dark: tintedMode(emerald, lime, 165, true),
  },
  "amber-warm": {
    id: "amber-warm",
    label: "Amber Warm",
    source: "builtin",
    light: tintedMode(amber, orange, 75, false),
    dark: tintedMode(amber, orange, 75, true),
  },
  "terracotta-warm": {
    id: "terracotta-warm",
    label: "Terracotta Warm",
    source: "builtin",
    light: tintedMode(terracotta, rose, 35, false),
    dark: tintedMode(terracotta, rose, 35, true),
  },
} as const satisfies Record<string, ProviderColorScheme>

export const fontSchemes = {
  "clear-modern": {
    id: "clear-modern",
    label: "Clear Modern",
    source: "builtin",
    roles: { body: modernSansStack, heading: modernSansStack, display: modernSansStack, mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "classic-editorial": {
    id: "classic-editorial",
    label: "Classic Editorial",
    source: "builtin",
    roles: { body: editorialSerifStack, heading: editorialSerifStack, display: editorialSerifStack, mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "friendly-organic": {
    id: "friendly-organic",
    label: "Friendly Organic",
    source: "builtin",
    roles: { body: humanistSansStack, heading: humanistSansStack, display: humanistSansStack, mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
} as const satisfies Record<string, FontScheme>

export const shapeSchemes = {
  rounded: { id: "rounded", label: "Rounded", radius: { none: "0", sm: "0.75rem", md: "1rem", lg: "1.25rem", xl: "1.75rem", "2xl": "2.25rem", "3xl": "3rem", "4xl": "3.5rem", full: "9999px" } },
  soft: { id: "soft", label: "Soft", radius: { none: "0", sm: "0.375rem", md: "0.5rem", lg: "0.625rem", xl: "0.875rem", "2xl": "1.125rem", "3xl": "1.375rem", "4xl": "1.625rem", full: "9999px" } },
  sharp: { id: "sharp", label: "Sharp", radius: { none: "0", sm: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", "4xl": "0", full: "9999px" } },
} as const satisfies Record<string, ShapeScheme>

export type ResolvedTheme = {
  version: 3
  mode: "light" | "dark" | "system"
  systemFallbackMode: "light" | "dark"
  light: ProviderColorSchemeMode
  dark: ProviderColorSchemeMode
  fonts: FontScheme
  shape: ShapeScheme
  semantic: { light: SemanticColors; dark: SemanticColors }
}

export function resolveThemeTokens(theme: ThemeTokenSpec | null | undefined): ResolvedTheme {
  const scheme = colorSchemes[theme?.colors?.schemeId as keyof typeof colorSchemes] ?? colorSchemes.monochrome
  const fonts = fontSchemes[theme?.fonts?.schemeId as keyof typeof fontSchemes] ?? fontSchemes["clear-modern"]
  return {
    version: 3,
    mode: theme?.appearance?.mode ?? "light",
    systemFallbackMode: "light",
    light: scheme.light,
    dark: scheme.dark,
    fonts,
    shape: shapeSchemes[theme?.shape?.schemeId as keyof typeof shapeSchemes] ?? shapeSchemes.soft,
    semantic: { light: semanticColors(scheme.light.accent, false), dark: semanticColors(scheme.dark.accent, true) },
  }
}
