import type { ThemeTokens } from "@/lib/theme/schema"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { resolveColorMode, themePreference } from "@siteinabox/site-renderer/theme"
import { cn } from "@siteinabox/ui/lib/utils"

/** Resolve the previewed site's effective light/dark mode (system follows OS). */
export function resolvePreviewSiteMode(
  theme: ThemeTokens | null | undefined,
  systemPrefersDark = false,
): "light" | "dark" {
  const preference = themePreference(theme ?? DEFAULT_THEME_TOKEN_SPEC)
  return resolveColorMode(preference, null, systemPrefersDark)
}

export const PREVIEW_MOBILE_CHROME_LIGHT_CLASS = "preview-mobile-chrome-light"

/** Invert CMS chrome against the previewed site: light site → dark tokens, dark site → light tokens. */
export function previewMobileChromeToneClass(
  theme: ThemeTokens | null | undefined,
  systemPrefersDark = false,
): string {
  return resolvePreviewSiteMode(theme, systemPrefersDark) === "light" ? "dark" : PREVIEW_MOBILE_CHROME_LIGHT_CLASS
}

export function previewMobileChromeWrapperClass(
  theme: ThemeTokens | null | undefined,
  systemPrefersDark = false,
): string {
  return cn(previewMobileChromeToneClass(theme, systemPrefersDark))
}

export const PREVIEW_MOBILE_CHROME_INSET = "px-[max(env(safe-area-inset-left),0.75rem)]"

/** Shared tap target for preview chrome pills and popover option circles (52px). */
export const PREVIEW_MOBILE_CHROME_CONTROL_SIZE = "size-[3.25rem]"
