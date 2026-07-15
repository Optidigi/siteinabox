"use client"

import * as React from "react"

const subscribe = (notify: () => void) => {
  if (typeof window === "undefined") return () => undefined
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", notify)
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
  return () => {
    media.removeEventListener("change", notify)
    observer.disconnect()
  }
}

const snapshot = () => {
  if (typeof document === "undefined") return "light"
  const root = document.documentElement
  if (root.classList.contains("dark") || root.dataset.theme === "dark") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
  const resolvedTheme = React.useSyncExternalStore(subscribe, snapshot, () => "light")
  return { theme: resolvedTheme, resolvedTheme, systemTheme: resolvedTheme, setTheme: () => undefined }
}
