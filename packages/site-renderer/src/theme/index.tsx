import * as React from "react"
import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { themeToCssVars, type ThemeCssVarScope } from "./css-vars"
import { resolveColorMode, SYSTEM_DARK_QUERY, themePreference } from "./color-mode"
import type { ResolvedColorMode } from "./color-mode"

export * from "./css-vars"
export * from "./color-mode"

const unsubscribeNoop = () => undefined
const ThemeCanvasColorModeContext = React.createContext<ResolvedColorMode | null>(null)

export function useThemeCanvasColorMode() {
  return React.useContext(ThemeCanvasColorModeContext)
}

function useSystemColorMode(preference: ReturnType<typeof themePreference>) {
  const subscribe = React.useCallback((notify: () => void) => {
    if (preference !== "system" || typeof window === "undefined") return unsubscribeNoop
    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    media.addEventListener("change", notify)
    return () => media.removeEventListener("change", notify)
  }, [preference])
  const snapshot = React.useCallback(
    () => resolveColorMode(preference, null, typeof window !== "undefined" && window.matchMedia(SYSTEM_DARK_QUERY).matches),
    [preference],
  )
  const serverSnapshot = React.useCallback(() => resolveColorMode(preference, null, false), [preference])
  return React.useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}

export function ThemeCanvas({ theme, ...props }: React.HTMLAttributes<HTMLDivElement> & { theme?: ThemeTokenSpec | null }) {
  const preference = themePreference(theme)
  const mode = useSystemColorMode(preference)
  return (
    <ThemeCanvasColorModeContext.Provider value={mode}>
      <div {...props} data-rt-mode={mode} data-siab-theme-mode={preference} />
    </ThemeCanvasColorModeContext.Provider>
  )
}

export function ThemeStyle({
  theme,
  scope = ".rt-canvas",
  nonce,
}: {
  theme?: ThemeTokenSpec | null
  scope?: ThemeCssVarScope
  nonce?: string
}) {
  const css = themeToCssVars(theme, scope)
  if (!css) return null

  return (
    <style
      nonce={nonce}
      suppressHydrationWarning
      data-siab-theme-overrides
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}
