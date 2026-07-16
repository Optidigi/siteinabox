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

const defaultLight: ProviderColorSchemeMode = {
  neutral: gray,
  accent: indigo,
  surface: "#ffffff",
  ink: gray[900],
  muted: gray[600],
  rule: gray[200],
  onAccent: "#ffffff",
}

const modernSansStack = "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
const editorialSerifStack = "Fraunces Variable, ui-serif, Georgia, Cambria, \"Times New Roman\", Times, serif"
const humanistSansStack = "\"Avenir Next\", Avenir, Nunito, \"Segoe UI\", ui-sans-serif, system-ui, sans-serif"

const defaultDark: ProviderColorSchemeMode = {
  neutral: grayDark,
  accent: indigo,
  surface: gray[900],
  ink: gray[50],
  muted: gray[300],
  rule: "rgba(255,255,255,0.12)",
  onAccent: "#ffffff",
}

export const colorSchemes = {
  "blue-professional": {
    id: "blue-professional",
    label: "Blue Professional",
    source: "builtin",
    light: { ...defaultLight, accent: indigo },
    dark: { ...defaultDark, accent: indigo },
  },
  "red-confident": {
    id: "red-confident",
    label: "Red Confident",
    source: "builtin",
    light: { ...defaultLight, accent: red },
    dark: { ...defaultDark, accent: red },
  },
  "emerald-calm": {
    id: "emerald-calm",
    label: "Emerald Calm",
    source: "builtin",
    light: { ...defaultLight, accent: emerald },
    dark: { ...defaultDark, accent: emerald },
  },
  "amber-warm": {
    id: "amber-warm",
    label: "Amber Warm",
    source: "builtin",
    light: { ...defaultLight, accent: amber },
    dark: { ...defaultDark, accent: amber },
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
  soft: { id: "soft", label: "Soft", radius: { none: "0", sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem", "4xl": "2rem", full: "9999px" } },
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
}

export function resolveThemeTokens(theme: ThemeTokenSpec | null | undefined): ResolvedTheme {
  const scheme = colorSchemes[theme?.colors?.schemeId as keyof typeof colorSchemes] ?? colorSchemes["blue-professional"]
  const fonts = fontSchemes[theme?.fonts?.schemeId as keyof typeof fontSchemes] ?? fontSchemes["clear-modern"]
  return {
    version: 3,
    mode: theme?.appearance?.mode ?? "light",
    systemFallbackMode: "light",
    light: scheme.light,
    dark: scheme.dark,
    fonts,
    shape: shapeSchemes[theme?.shape?.schemeId as keyof typeof shapeSchemes] ?? shapeSchemes.soft,
  }
}
