import type {
  ColorRamp,
  DensityScheme,
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
    label: "Tailwind Native",
    source: "tailwind",
    light: defaultLight,
    dark: defaultDark,
  },
  "slate-indigo": {
    id: "slate-indigo",
    label: "Slate Indigo",
    source: "tailwind",
    light: { ...defaultLight, neutral: slate, accent: indigo, ink: slate[900], muted: slate[600], rule: slate[200] },
    dark: { ...defaultDark, neutral: slateDark, accent: indigo, surface: slate[950] ?? "#020617", ink: slate[50], muted: slate[300] },
  },
  "blue-professional": {
    id: "blue-professional",
    label: "Blue Professional",
    source: "tailwind",
    light: { ...defaultLight, accent: blue },
    dark: { ...defaultDark, accent: blue },
  },
  "emerald-calm": {
    id: "emerald-calm",
    label: "Emerald Calm",
    source: "tailwind",
    light: { ...defaultLight, accent: emerald },
    dark: { ...defaultDark, accent: emerald },
  },
  "amber-warm": {
    id: "amber-warm",
    label: "Amber Warm",
    source: "tailwind",
    light: { ...defaultLight, accent: amber },
    dark: { ...defaultDark, accent: amber },
  },
} as const satisfies Record<string, ProviderColorScheme>

export const fontSchemes = {
  "clear-modern": {
    id: "clear-modern",
    label: "Clear Modern",
    source: "tailwind",
    roles: { body: tailwindSansStack, heading: tailwindSansStack, display: tailwindSansStack, mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "classic-editorial": {
    id: "classic-editorial",
    label: "Classic Editorial",
    source: "system",
    roles: { body: tailwindSansStack, heading: "Fraunces Variable, ui-serif, Georgia, serif", display: "Fraunces Variable, ui-serif, Georgia, serif", mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "friendly-organic": {
    id: "friendly-organic",
    label: "Friendly Organic",
    source: "system",
    roles: { body: tailwindSansStack, heading: "Fraunces Variable, ui-serif, Georgia, serif", display: "Caveat Variable, ui-serif, Georgia, serif", mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
  "bold-confident": {
    id: "bold-confident",
    label: "Bold Confident",
    source: "system",
    roles: { body: tailwindSansStack, heading: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif", display: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif", mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  },
} as const satisfies Record<string, FontScheme>

export const densitySchemes = {
  "tailwind-default": { id: "tailwind-default", label: "Tailwind Native", sectionPaddingY: { base: "6rem", sm: "8rem" }, interBlockGap: "0" },
  compact: { id: "compact", label: "Compact", sectionPaddingY: { base: "4rem", sm: "5rem" }, interBlockGap: "0" },
  comfortable: { id: "comfortable", label: "Comfortable", sectionPaddingY: { base: "7rem", sm: "9rem" }, interBlockGap: "0" },
  spacious: { id: "spacious", label: "Spacious", sectionPaddingY: { base: "8rem", sm: "10rem", lg: "12rem" }, interBlockGap: "0" },
} as const satisfies Record<string, DensityScheme>

export const shapeSchemes = {
  "tailwind-default": { id: "tailwind-default", label: "Tailwind Native", radius: { none: "0", sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem", full: "9999px" } },
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

export function resolveThemeTokens(theme: ThemeTokenSpec | null | undefined): ResolvedTheme {
  const scheme = colorSchemes[theme?.colors?.schemeId as keyof typeof colorSchemes] ?? colorSchemes["tailwind-default"]
  const fonts = fontSchemes[theme?.fonts?.schemeId as keyof typeof fontSchemes] ?? fontSchemes["clear-modern"]
  return {
    version: 2,
    mode: theme?.appearance?.mode ?? "light",
    defaultMode: "light",
    light: scheme.light,
    dark: scheme.dark,
    fonts,
    density: densitySchemes[theme?.density?.schemeId as keyof typeof densitySchemes] ?? densitySchemes["tailwind-default"],
    shape: shapeSchemes[theme?.shape?.schemeId as keyof typeof shapeSchemes] ?? shapeSchemes["tailwind-default"],
  }
}
