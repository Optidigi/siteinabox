import type { ThemeTokens } from "@/lib/theme/schema"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"

export function resolvePreviewSiteMode(theme: ThemeTokens | null | undefined): "light" | "dark" {
  const mode = theme?.appearance?.mode ?? DEFAULT_THEME_TOKEN_SPEC.appearance.mode
  return mode === "dark" ? "dark" : "light"
}

/** Invert CMS chrome against the previewed site: light site → dark chrome tokens. */
export function previewMobileChromeWrapperClass(theme: ThemeTokens | null | undefined): string {
  return cn(resolvePreviewSiteMode(theme) === "light" && "dark")
}

export const PREVIEW_MOBILE_CHROME_INSET = "px-[max(env(safe-area-inset-left),0.75rem)]"
