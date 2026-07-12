import type { ThemeTokens } from "@/lib/theme/schema"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"

export function resolvePreviewSiteMode(theme: ThemeTokens | null | undefined): "light" | "dark" {
  const mode = theme?.appearance?.mode ?? DEFAULT_THEME_TOKEN_SPEC.appearance.mode
  return mode === "dark" ? "dark" : "light"
}

export const PREVIEW_MOBILE_CHROME_LIGHT_CLASS = "preview-mobile-chrome-light"

/** Invert CMS chrome against the previewed site: light site → dark tokens, dark site → light tokens. */
export function previewMobileChromeToneClass(theme: ThemeTokens | null | undefined): string {
  return resolvePreviewSiteMode(theme) === "light" ? "dark" : PREVIEW_MOBILE_CHROME_LIGHT_CLASS
}

export function previewMobileChromeWrapperClass(theme: ThemeTokens | null | undefined): string {
  return cn(previewMobileChromeToneClass(theme))
}

/** The chrome is inverted against the site, so the shine contrasts with the pill itself. */
export function previewMobileChromeShineColor(theme: ThemeTokens | null | undefined): "black" | "white" {
  return resolvePreviewSiteMode(theme) === "dark" ? "black" : "white"
}

export const PREVIEW_MOBILE_CHROME_INSET = "px-[max(env(safe-area-inset-left),0.75rem)]"

/** Shared tap target for preview chrome pills and popover option circles (52px). */
export const PREVIEW_MOBILE_CHROME_CONTROL_SIZE = "size-[3.25rem]"
