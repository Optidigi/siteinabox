"use client"

import * as React from "react"
import type { SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"
import { SiteBanner, ThemeCanvas, isViewportFixedConsentBanner } from "@siteinabox/site-renderer"

export function EditorConsentBannerOverlay({
  settings,
  theme,
  selected,
  onSelect,
}: {
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  selected: boolean
  onSelect: () => void
}) {
  if (!isViewportFixedConsentBanner(settings)) return null

  return (
    <div
      data-siab-editor-consent-overlay
      className="pointer-events-none fixed inset-x-0 z-50 px-3 sm:px-6"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <ThemeCanvas theme={theme} className="pointer-events-none">
        <div
          className="pointer-events-auto cursor-pointer"
          data-siab-editor-selected={selected ? "true" : undefined}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onSelect()
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onSelect()
          }}
          role="button"
          tabIndex={0}
        >
          <SiteBanner settings={settings} />
        </div>
      </ThemeCanvas>
    </div>
  )
}
