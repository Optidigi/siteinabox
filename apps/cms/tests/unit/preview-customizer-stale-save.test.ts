import { describe, expect, it, vi } from "vitest"
import type * as React from "react"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    reset: vi.fn(),
  }),
}))

vi.mock("@siteinabox/ui/components/button", () => ({
  Button: "button",
}))

vi.mock("@siteinabox/ui/components/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/canvas/BlockPresetsContext", () => ({
  BlockPresetsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/canvas/CanvasMode", () => ({
  CanvasMode: () => null,
}))

vi.mock("@/components/editor/canvas/CanvasSelectionContext", () => ({
  CanvasSelectionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/canvas/SiteChromePreview", () => ({
  SiteChromeActionFrame: ({ children }: { children: React.ReactNode }) => children,
  SiteChromePreview: () => null,
}))

vi.mock("@/components/editor/RtManifestContext", () => ({
  RtManifestProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/theme/theme-bar", () => ({
  ThemeBar: () => null,
}))

vi.mock("@/lib/actions/previewCustomizer", () => ({
  setPreviewTheme: vi.fn(),
}))

describe("PreviewCustomizer stale theme save guard", () => {
  it("accepts the response for the latest local theme version", async () => {
    const { shouldApplyPreviewThemeSaveResponse } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldApplyPreviewThemeSaveResponse({
      latestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      latestVersion: 2,
      requestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      requestVersion: 2,
    })).toBe(true)
  })

  it("rejects an older response after a newer local theme edit", async () => {
    const { shouldApplyPreviewThemeSaveResponse } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldApplyPreviewThemeSaveResponse({
      latestSerializedTheme: "{\"radius\":\"1.5rem\"}",
      latestVersion: 3,
      requestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      requestVersion: 2,
    })).toBe(false)
  })
})
