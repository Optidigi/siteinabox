"use client"

import * as React from "react"
import { SYSTEM_DARK_QUERY } from "@siteinabox/site-renderer/theme"

/** Tracks `prefers-color-scheme: dark` for resolving `appearance.mode: "system"`. */
export function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    const apply = () => setPrefersDark(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  return prefersDark
}
