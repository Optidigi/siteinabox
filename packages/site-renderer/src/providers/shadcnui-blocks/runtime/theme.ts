"use client"

import * as React from "react"
import { normalizeColorMode, SYSTEM_DARK_QUERY } from "../../../theme/color-mode"
import { useThemeCanvasColorMode } from "../../../theme"

const subscribe = (notify: () => void) => {
  if (typeof window === "undefined") return () => undefined
  const media = window.matchMedia(SYSTEM_DARK_QUERY)
  media.addEventListener("change", notify)
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-siab-color-mode", "data-rt-mode"] })
  return () => {
    media.removeEventListener("change", notify)
    observer.disconnect()
  }
}

const snapshot = () => {
  if (typeof document === "undefined") return "light"
  const root = document.documentElement
  return normalizeColorMode(root.dataset.siabColorMode ?? root.dataset.rtMode)
    ?? (window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light")
}

export function useTheme() {
  const canvasTheme = useThemeCanvasColorMode()
  const documentTheme = React.useSyncExternalStore(subscribe, snapshot, () => "light")
  const resolvedTheme = canvasTheme ?? documentTheme
  return { theme: resolvedTheme, resolvedTheme, systemTheme: resolvedTheme, setTheme: () => undefined }
}
